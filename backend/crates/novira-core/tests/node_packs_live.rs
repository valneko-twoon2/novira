//! Installs real custom node packs from GitHub into a ComfyUI folder, starts that ComfyUI and saves the definitions of
//! the pack nodes it loaded. Run by hand (it downloads from GitHub and starts ComfyUI on the GPU):
//!
//! ```text
//! NOVIRA_COMFY_DIR=<ComfyUI folder> NOVIRA_COMFY_PYTHON=<its python.exe> NOVIRA_COMFY_BASE=<empty folder> \
//! NOVIRA_PACKS=https://github.com/a/b,https://github.com/c/d NOVIRA_DEFS_OUT=<file.json> \
//! cargo test -p novira-core --test node_packs_live -- --ignored --nocapture
//! ```
//!
//! With `NOVIRA_COMFY_BASE` the packs go to `<base>/custom_nodes` and ComfyUI runs with `--base-directory <base>`, so
//! the ComfyUI folder itself is left as it is (packs with requirements still install them into its Python).
use novira_core::comfy::node_packs;
use novira_core::comfy::process::{ComfyProcess, OwnedProcessConfig};
use novira_core::comfy::ComfyEngine;
use novira_core::engine::Engine;
use std::path::PathBuf;
use std::time::Duration;
use tokio_util::sync::CancellationToken;

fn env(name: &str) -> String {
    std::env::var(name).unwrap_or_else(|_| panic!("set {name}"))
}

#[tokio::test]
#[ignore = "downloads packs from GitHub and starts ComfyUI"]
async fn packs_install_and_comfyui_loads_their_nodes() {
    let comfy = PathBuf::from(env("NOVIRA_COMFY_DIR"));
    let python = PathBuf::from(env("NOVIRA_COMFY_PYTHON"));
    let out = PathBuf::from(env("NOVIRA_DEFS_OUT"));
    let base = std::env::var("NOVIRA_COMFY_BASE").ok().map(PathBuf::from);
    let packs_root = base.clone().unwrap_or_else(|| comfy.clone());
    let data = out.parent().unwrap().join("node-packs-live");
    std::fs::create_dir_all(&data).unwrap();
    let http = reqwest::Client::builder()
        .user_agent("novira")
        .build()
        .unwrap();
    let cancel = CancellationToken::new();

    for url in std::env::var("NOVIRA_PACKS")
        .unwrap_or_default()
        .split(',')
        .filter(|s| !s.is_empty())
    {
        let repo = node_packs::parse_github(url).unwrap();
        let started = std::time::Instant::now();
        let report = |s: novira_core::packs::PackStatus| {
            if !matches!(s, novira_core::packs::PackStatus::Downloading { .. }) {
                println!("  {} {s:?}", repo.repo);
            }
        };
        let folder =
            node_packs::install(&http, &repo, &packs_root, &python, &data, &cancel, &report)
                .await
                .unwrap_or_else(|e| panic!("{url}: {e}"));
        println!(
            "installed {folder} in {:.1}s",
            started.elapsed().as_secs_f32()
        );
    }
    // ComfyUI reads this file at start; no extra model folders are needed to list nodes.
    std::fs::write(
        data.join("extra_model_paths.yaml"),
        format!("novira:\n  base_path: {}\n", data.display()).replace('\\', "/"),
    )
    .unwrap();
    let installed = node_packs::list(&node_packs::custom_nodes_dir(&packs_root));
    println!("custom_nodes: {installed:?}");

    let port = std::net::TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port();
    let process = ComfyProcess::new(OwnedProcessConfig {
        comfyui_dir: comfy.clone(),
        python: Some(python.clone()),
        host: "127.0.0.1".into(),
        port,
        extra_model_paths: data.join("extra_model_paths.yaml"),
        extra_args: base
            .iter()
            .flat_map(|b| {
                [
                    "--base-directory".to_string(),
                    b.to_string_lossy().into_owned(),
                ]
            })
            .collect(),
        log_file: data.join("logs").join("comfyui.log"),
    });
    let engine = ComfyEngine::new(
        &format!("http://127.0.0.1:{port}"),
        Some(process),
        Duration::from_secs(300),
    )
    .unwrap();
    let defs = engine.node_defs(&cancel).await.unwrap();
    engine.shutdown();
    let packs: serde_json::Map<String, serde_json::Value> = defs
        .as_object()
        .unwrap()
        .iter()
        .filter(|(_, d)| {
            d["python_module"]
                .as_str()
                .is_some_and(|m| m.starts_with("custom_nodes"))
        })
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect();
    let mut by_pack: std::collections::BTreeMap<String, usize> = Default::default();
    for d in packs.values() {
        *by_pack
            .entry(d["python_module"].as_str().unwrap().to_string())
            .or_default() += 1;
    }
    println!("pack nodes: {by_pack:#?}");
    std::fs::write(&out, serde_json::to_vec_pretty(&packs).unwrap()).unwrap();
    for p in installed.iter().filter(|p| p.url.is_some()) {
        assert!(
            by_pack.keys().any(|m| m.contains(&p.folder)),
            "ComfyUI did not load {} (see {})",
            p.folder,
            data.join("logs").join("comfyui.log").display()
        );
    }
}

/// Runs `LoadImage → NKDFilmGrain → SaveImage` as an editor-built prompt on the ComfyUI the first test prepared
/// (same variables; needs ComfyUI-NKD-Basic-Tools installed in the base folder).
#[tokio::test]
#[ignore = "starts ComfyUI and runs a graph on the GPU"]
async fn a_graph_with_a_pack_node_runs() {
    use novira_core::engine::{EngineJob, EngineOutput, GraphJob};
    use novira_core::types::{ComfyRef, GenerationMetadata};
    let comfy = PathBuf::from(env("NOVIRA_COMFY_DIR"));
    let python = PathBuf::from(env("NOVIRA_COMFY_PYTHON"));
    let base = PathBuf::from(env("NOVIRA_COMFY_BASE"));
    let data = PathBuf::from(env("NOVIRA_DEFS_OUT"))
        .parent()
        .unwrap()
        .join("node-packs-live");
    let port = std::net::TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port();
    let engine = ComfyEngine::new(
        &format!("http://127.0.0.1:{port}"),
        Some(ComfyProcess::new(OwnedProcessConfig {
            comfyui_dir: comfy,
            python: Some(python),
            host: "127.0.0.1".into(),
            port,
            extra_model_paths: data.join("extra_model_paths.yaml"),
            extra_args: vec![
                "--base-directory".into(),
                base.to_string_lossy().into_owned(),
            ],
            log_file: data.join("logs").join("comfyui.log"),
        })),
        Duration::from_secs(300),
    )
    .unwrap();
    let img = image::RgbImage::from_fn(64, 48, |x, y| {
        image::Rgb([(x * 4) as u8, (y * 5) as u8, 128])
    });
    let mut png = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(img)
        .write_to(&mut png, image::ImageFormat::Png)
        .unwrap();
    let params: GenerationMetadata = serde_json::from_value(serde_json::json!({
        "generationMode": "graph", "positivePrompt": "", "negativePrompt": "", "modelKey": "", "modelName": "",
        "vaeKey": null, "seed": 5, "steps": 1, "cfgScale": 0, "cfgRescale": 0, "scheduler": "euler", "width": 0,
        "height": 0, "clipSkip": 0, "seamlessX": false, "seamlessY": false, "loras": []
    }))
    .unwrap();
    let job = EngineJob {
        split: None,
        params,
        checkpoint: ComfyRef {
            folder: String::new(),
            name: String::new(),
        },
        vae: None,
        loras: Vec::new(),
        upscale_model: None,
        tile_controlnet: None,
        post_processing_model: None,
        text_encoder: None,
        init_image: None,
        guidance: Default::default(),
        graph: Some(GraphJob {
            prompt: serde_json::json!({
                "src": { "class_type": "LoadImage", "inputs": { "image": { "$image": "gradient.png" } } },
                "grain": { "class_type": "NKDFilmGrain", "inputs": {
                    "image": ["src", 0], "amount": 60.0, "size": 1.5, "roughness": 50.0, "color": 0.0,
                    "animate": false, "seed": 5
                } },
                "save": { "class_type": "SaveImage", "inputs": { "images": ["grain", 0], "filename_prefix": "novira" } }
            }),
            outputs: vec!["save".into()],
            models: Vec::new(),
            images: vec![("gradient.png".into(), png.into_inner())],
            thumbnail: None,
            no_result: false,
        }),
    };
    let cancel = CancellationToken::new();
    engine.validate(&job).await.unwrap();
    let out = engine.generate(&job, &|_| {}, &cancel).await;
    engine.shutdown();
    let EngineOutput::Image(bytes) = out.unwrap() else {
        panic!("a picture")
    };
    let pic = image::load_from_memory(&bytes).unwrap().to_rgb8();
    assert_eq!(pic.dimensions(), (64, 48));
    let differs = pic
        .enumerate_pixels()
        .filter(|(x, y, p)| p.0 != [(*x * 4) as u8, (*y * 5) as u8, 128])
        .count();
    println!("{differs} of {} pixels changed by the grain", 64 * 48);
    assert!(differs > 64 * 48 / 4, "the grain should change the picture");
    std::fs::write(data.join("grain.png"), &bytes).unwrap();
}

/// Runs the prompt in `NOVIRA_GRAPH_FILE` (`{"prompt": {...}, "outputs": [...]}`, pictures written as
/// `{"$image": "name"}`) on the same ComfyUI, with the pictures named in `NOVIRA_GRAPH_IMAGES` (`name=path;name=path`),
/// and saves the first result to `NOVIRA_GRAPH_OUT`.
#[tokio::test]
#[ignore = "starts ComfyUI and runs a graph on the GPU"]
async fn a_graph_from_a_file_runs() {
    use novira_core::engine::{EngineJob, EngineOutput, GraphJob};
    use novira_core::types::{ComfyGraph, ComfyRef, GenerationMetadata};
    let comfy = PathBuf::from(env("NOVIRA_COMFY_DIR"));
    let python = PathBuf::from(env("NOVIRA_COMFY_PYTHON"));
    let base = PathBuf::from(env("NOVIRA_COMFY_BASE"));
    let data = PathBuf::from(env("NOVIRA_DEFS_OUT"))
        .parent()
        .unwrap()
        .join("node-packs-live");
    let graph: ComfyGraph =
        serde_json::from_slice(&std::fs::read(env("NOVIRA_GRAPH_FILE")).unwrap()).unwrap();
    let images: Vec<(String, Vec<u8>)> = env("NOVIRA_GRAPH_IMAGES")
        .split(';')
        .filter(|s| !s.is_empty())
        .map(|pair| {
            let (name, path) = pair.split_once('=').unwrap();
            (name.to_string(), std::fs::read(path).unwrap())
        })
        .collect();
    let port = std::net::TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port();
    let engine = ComfyEngine::new(
        &format!("http://127.0.0.1:{port}"),
        Some(ComfyProcess::new(OwnedProcessConfig {
            comfyui_dir: comfy,
            python: Some(python),
            host: "127.0.0.1".into(),
            port,
            extra_model_paths: data.join("extra_model_paths.yaml"),
            extra_args: vec![
                "--base-directory".into(),
                base.to_string_lossy().into_owned(),
            ],
            log_file: data.join("logs").join("comfyui.log"),
        })),
        Duration::from_secs(300),
    )
    .unwrap();
    let params: GenerationMetadata = serde_json::from_value(serde_json::json!({
        "generationMode": "graph", "positivePrompt": "", "negativePrompt": "", "modelKey": "", "modelName": "",
        "vaeKey": null, "seed": 5, "steps": 1, "cfgScale": 0, "cfgRescale": 0, "scheduler": "euler", "width": 0,
        "height": 0, "clipSkip": 0, "seamlessX": false, "seamlessY": false, "loras": []
    }))
    .unwrap();
    let job = EngineJob {
        split: None,
        params,
        checkpoint: ComfyRef {
            folder: String::new(),
            name: String::new(),
        },
        vae: None,
        loras: Vec::new(),
        upscale_model: None,
        tile_controlnet: None,
        post_processing_model: None,
        text_encoder: None,
        init_image: None,
        guidance: Default::default(),
        graph: Some(GraphJob {
            prompt: serde_json::Value::Object(graph.prompt),
            outputs: graph.outputs,
            models: Vec::new(),
            images,
            thumbnail: None,
            no_result: false,
        }),
    };
    let cancel = CancellationToken::new();
    engine.validate(&job).await.unwrap();
    let out = engine.generate(&job, &|_| {}, &cancel).await;
    engine.shutdown();
    let EngineOutput::Image(bytes) = out.unwrap() else {
        panic!("a picture")
    };
    std::fs::write(env("NOVIRA_GRAPH_OUT"), &bytes).unwrap();
    println!("saved {} bytes", bytes.len());
}

/// The Face Rig routes the editor uses: the library, then a neutral and a posed preview of `NOVIRA_FACE_IMAGE`.
/// Saves `face-neutral.jpg`, `face-posed.jpg` and `face-anchors.json` next to `NOVIRA_DEFS_OUT`.
#[tokio::test]
#[ignore = "starts ComfyUI and renders a face on the GPU"]
async fn face_rig_routes_render_a_posed_face() {
    use base64::Engine as _;
    use novira_core::engine::Engine as _;
    let comfy = PathBuf::from(env("NOVIRA_COMFY_DIR"));
    let python = PathBuf::from(env("NOVIRA_COMFY_PYTHON"));
    let base = PathBuf::from(env("NOVIRA_COMFY_BASE"));
    let out = PathBuf::from(env("NOVIRA_DEFS_OUT"));
    let data = out.parent().unwrap().join("node-packs-live");
    let face = std::fs::read(env("NOVIRA_FACE_IMAGE")).unwrap();
    let port = std::net::TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port();
    let engine = ComfyEngine::new(
        &format!("http://127.0.0.1:{port}"),
        Some(ComfyProcess::new(OwnedProcessConfig {
            comfyui_dir: comfy,
            python: Some(python),
            host: "127.0.0.1".into(),
            port,
            extra_model_paths: data.join("extra_model_paths.yaml"),
            extra_args: vec![
                "--base-directory".into(),
                base.to_string_lossy().into_owned(),
            ],
            log_file: data.join("logs").join("comfyui.log"),
        })),
        Duration::from_secs(300),
    )
    .unwrap();
    let cancel = CancellationToken::new();
    let lib = engine
        .pack_request(&cancel, "nkd/facerig/library", None)
        .await
        .unwrap();
    println!("axes: {}", lib["axes"].as_array().unwrap().len());
    let frame = format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(&face)
    );
    let run = |rig: &str, quality: &str, with_frame: bool| {
        let mut body = serde_json::json!({ "node": "live-test", "rig": rig, "quality": quality, "crop_factor": 2.0, "src_ratio": 1.0, "face_index": 0 });
        if with_frame {
            body["frame"] = serde_json::Value::String(frame.clone());
        }
        body
    };
    let neutral = engine
        .pack_request(&cancel, "nkd/facerig/preview", Some(run("", "final", true)))
        .await
        .unwrap();
    assert!(neutral["image"].is_string(), "{neutral}");
    let posed_rig =
        r#"{"v":1,"w":{"au12":0.9,"au26":0.4,"au45_L":0.8,"au63":0.7},"rot":[0.0,15.0,0.0]}"#;
    let started = std::time::Instant::now();
    let posed = engine
        .pack_request(
            &cancel,
            "nkd/facerig/preview",
            Some(run(posed_rig, "drag", false)),
        )
        .await
        .unwrap();
    println!("a posed drag frame took {:?}", started.elapsed());
    // Which way a positive yaw turns the face: the lips move relative to the eyes' middle.
    let turned = engine
        .pack_request(
            &cancel,
            "nkd/facerig/preview",
            Some(run(
                r#"{"v":1,"w":{},"rot":[0.0,20.0,0.0]}"#,
                "final",
                false,
            )),
        )
        .await
        .unwrap();
    let lips = |v: &serde_json::Value| {
        v["anchors"]["lips"][0].as_f64().unwrap() - v["anchors"]["gaze"][0].as_f64().unwrap()
    };
    println!(
        "lips minus gaze x: neutral {:.4}, yaw +20 {:.4}",
        lips(&neutral),
        lips(&turned)
    );
    assert!(posed["image"].is_string(), "{posed}");
    let looking = engine
        .pack_request(
            &cancel,
            "nkd/facerig/preview",
            Some(run(r#"{"v":1,"w":{"au61":1.0}}"#, "final", false)),
        )
        .await
        .unwrap();
    engine.shutdown();
    let jpg = |v: &serde_json::Value| {
        base64::engine::general_purpose::STANDARD
            .decode(v["image"].as_str().unwrap().split_once(',').unwrap().1)
            .unwrap()
    };
    let dir = out.parent().unwrap();
    std::fs::write(dir.join("face-neutral.jpg"), jpg(&neutral)).unwrap();
    std::fs::write(dir.join("face-posed.jpg"), jpg(&posed)).unwrap();
    std::fs::write(dir.join("face-lookright.jpg"), jpg(&looking)).unwrap();
    std::fs::write(
        dir.join("face-anchors.json"),
        serde_json::to_vec_pretty(&neutral["anchors"]).unwrap(),
    )
    .unwrap();
    println!(
        "settled: {} anchors: {:?}",
        neutral["settled"],
        neutral["anchors"]
            .as_object()
            .map(|a| a.keys().cloned().collect::<Vec<_>>())
    );
}
