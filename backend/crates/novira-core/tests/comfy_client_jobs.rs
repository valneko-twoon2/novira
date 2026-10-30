//! `ComfyEngine` jobs that the other fake-server files do not make: GGUF models listed by the GGUF pack's loaders,
//! regional prompts, reference pictures with their own region, FLUX.2 reference pictures, a video model's node check, and
//! an upload that fails part-way through a job. The fake ComfyUI is small and tells how it should misbehave.
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use novira_core::comfy::split::{Family, Loader, SplitJob};
use novira_core::comfy::ComfyEngine;
use novira_core::engine::{
    Engine, EngineError, EngineJob, EngineOutput, JobGuidance, RefJob, RegionJob,
};
use novira_core::types::{ComfyRef, GenerationMetadata, RefImageMethod};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio_util::sync::CancellationToken;

#[derive(Clone)]
struct Fake {
    /// Node classes `object_info` knows.
    nodes: Vec<&'static str>,
    /// The files the GGUF loaders list.
    gguf: Vec<&'static str>,
    /// The files the text-encoder GGUF loader lists, when it lists others than `gguf`.
    clip_gguf: Vec<&'static str>,
    /// The upload (counted from 1) that fails with HTTP 500; 0 for none.
    fail_upload_at: usize,
    uploads: Arc<AtomicUsize>,
    /// The output node ids of the last prompt.
    outputs: Arc<std::sync::Mutex<Vec<String>>>,
}

fn png() -> Vec<u8> {
    let img = image::RgbImage::from_pixel(8, 8, image::Rgb([1, 2, 3]));
    let mut out = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(img)
        .write_to(&mut out, image::ImageFormat::Png)
        .unwrap();
    out.into_inner()
}

async fn serve(fake: Fake) -> (ComfyEngine, Fake) {
    let app = Router::new()
        .route("/system_stats", get(|| async { Json(json!({ "system": {} })) }))
        .route(
            "/models/{folder}",
            get(|| async {
                Json(json!([
                    "base.safetensors",
                    "ae.safetensors",
                    "flux2-vae.safetensors",
                    "te.safetensors",
                    "ip.safetensors",
                    "vit.safetensors"
                ]))
            }),
        )
        .route(
            "/object_info/{node}",
            get(|State(f): State<Fake>, Path(node): Path<String>| async move {
                if !f.nodes.contains(&node.as_str()) {
                    return StatusCode::NOT_FOUND.into_response();
                }
                Json(json!({ node: { "input": { "required": {
                    "unet_name": [f.gguf],
                    "clip_name": [if f.clip_gguf.is_empty() { f.gguf.clone() } else { f.clip_gguf.clone() }]
                } } } }))
                .into_response()
            }),
        )
        .route(
            "/upload/image",
            post(|State(f): State<Fake>| async move {
                let n = f.uploads.fetch_add(1, Ordering::SeqCst) + 1;
                if n == f.fail_upload_at {
                    StatusCode::INTERNAL_SERVER_ERROR.into_response()
                } else {
                    Json(json!({ "name": format!("up{n}.png"), "subfolder": "" })).into_response()
                }
            }),
        )
        .route(
            "/prompt",
            post(|State(f): State<Fake>, Json(body): Json<Value>| async move {
                let ids = body["prompt"]
                    .as_object()
                    .unwrap()
                    .iter()
                    .filter(|(_, n)| n["class_type"] == "PreviewImage")
                    .map(|(id, _)| id.clone())
                    .collect();
                *f.outputs.lock().unwrap() = ids;
                Json(json!({ "prompt_id": "p1", "node_errors": {} }))
            }),
        )
        .route(
            "/history/{id}",
            get(|State(f): State<Fake>, Path(id): Path<String>| async move {
                let file = json!({ "images": [{ "filename": "r.png", "subfolder": "", "type": "temp" }] });
                let outputs: serde_json::Map<String, Value> = f
                    .outputs
                    .lock()
                    .unwrap()
                    .iter()
                    .map(|n| (n.clone(), file.clone()))
                    .collect();
                Json(json!({ id: { "outputs": outputs, "status": { "status_str": "success", "completed": true, "messages": [] } } }))
            }),
        )
        .route("/view", get(|| async { png() }))
        .with_state(fake.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (
        ComfyEngine::new(&url, None, Duration::from_secs(1)).unwrap(),
        fake,
    )
}

fn fake() -> Fake {
    Fake {
        nodes: vec!["KSampler"],
        gguf: vec![],
        clip_gguf: vec![],
        fail_upload_at: 0,
        uploads: Arc::default(),
        outputs: Arc::default(),
    }
}

fn r(folder: &str, name: &str) -> ComfyRef {
    ComfyRef {
        folder: folder.into(),
        name: name.into(),
    }
}

fn params(extra: Value) -> GenerationMetadata {
    let mut v = json!({
        "generationMode": "txt2img", "positivePrompt": "a cat", "negativePrompt": "",
        "modelKey": "m", "modelName": "M", "vaeKey": null, "seed": 1, "steps": 3, "cfgScale": 7, "cfgRescale": 0,
        "scheduler": "euler", "width": 512, "height": 512, "clipSkip": 0, "seamlessX": false, "seamlessY": false,
        "loras": []
    });
    v.as_object_mut()
        .unwrap()
        .extend(extra.as_object().unwrap().clone());
    serde_json::from_value(v).unwrap()
}

fn job(params: GenerationMetadata) -> EngineJob {
    EngineJob {
        split: None,
        params,
        checkpoint: r("checkpoints", "base.safetensors"),
        vae: None,
        loras: vec![],
        upscale_model: None,
        tile_controlnet: None,
        post_processing_model: None,
        text_encoder: None,
        init_image: None,
        graph: None,
        guidance: JobGuidance::default(),
    }
}

async fn generate(engine: &ComfyEngine, job: &EngineJob) -> Result<EngineOutput, EngineError> {
    engine
        .generate(job, &|_| {}, &CancellationToken::new())
        .await
}

fn failure(r: Result<(), EngineError>) -> String {
    match r {
        Err(EngineError::Failed(m)) => m,
        other => panic!("expected a failure, got {other:?}"),
    }
}

/// A Z-Image job whose model and text encoder are GGUF files.
fn gguf_job(unet: &str, encoder: &str) -> EngineJob {
    let mut j = job(params(json!({})));
    j.checkpoint = r("diffusion_models", unet);
    let mut split = SplitJob::new(
        Family::ZImage,
        Loader::Unet,
        vec![r("text_encoders", encoder)],
    );
    split.text_encoders[0] = r("text_encoders", encoder);
    j.split = Some(split);
    j.vae = Some(r("vae", "ae.safetensors"));
    j
}

#[tokio::test]
async fn gguf_files_are_looked_up_in_the_lists_of_the_gguf_loaders() {
    let (engine, _) = serve(Fake {
        nodes: vec!["KSampler", "UnetLoaderGGUF", "CLIPLoaderGGUF"],
        gguf: vec!["model-Q4_K_M.gguf", "qwen-Q8.gguf"],
        ..fake()
    })
    .await;
    engine
        .validate(&gguf_job("model-Q4_K_M.gguf", "qwen-Q8.gguf"))
        .await
        .unwrap();
    // A file the loader does not list is named, as are the model and the encoder.
    let m = failure(
        engine
            .validate(&gguf_job("other-Q4.gguf", "qwen-Q8.gguf"))
            .await,
    );
    assert!(
        m.contains("other-Q4.gguf") && m.contains("diffusion_models"),
        "{m}"
    );
    let m = failure(
        engine
            .validate(&gguf_job("model-Q4_K_M.gguf", "missing.gguf"))
            .await,
    );
    assert!(
        m.contains("missing.gguf") && m.contains("text_encoders"),
        "{m}"
    );
}

#[tokio::test]
async fn each_gguf_file_is_looked_up_in_the_list_of_its_own_loader() {
    let (engine, _) = serve(Fake {
        nodes: vec!["KSampler", "UnetLoaderGGUF", "CLIPLoaderGGUF"],
        gguf: vec!["unet-only.gguf"],
        clip_gguf: vec!["clip-only.gguf"],
        ..fake()
    })
    .await;
    engine
        .validate(&gguf_job("unet-only.gguf", "clip-only.gguf"))
        .await
        .unwrap();
    // The model folder is called `unet` in older installs; it is still read from the model loader.
    let mut old = gguf_job("unet-only.gguf", "clip-only.gguf");
    old.checkpoint = r("unet", "unet-only.gguf");
    engine.validate(&old).await.unwrap();
    // Swapped, each file is missing from the list it is asked in.
    assert!(failure(
        engine
            .validate(&gguf_job("clip-only.gguf", "unet-only.gguf"))
            .await
    )
    .contains("clip-only.gguf"));
}

#[tokio::test]
async fn a_gguf_loader_that_lists_nothing_means_the_file_is_not_seen() {
    // The pack's nodes exist, but their lists hold no file.
    let (engine, _) = serve(Fake {
        nodes: vec!["KSampler", "UnetLoaderGGUF", "CLIPLoaderGGUF"],
        ..fake()
    })
    .await;
    let m = failure(
        engine
            .validate(&gguf_job("model-Q4_K_M.gguf", "qwen-Q8.gguf"))
            .await,
    );
    assert!(m.contains("does not see"), "{m}");
}

fn region() -> RegionJob {
    RegionJob {
        mask: png(),
        positive: Some("a red hat".into()),
        negative: None,
        auto_negative: true,
    }
}

fn regional_job() -> EngineJob {
    let mut j = job(params(json!({ "regionalGuidanceCount": 1 })));
    j.guidance.regions = vec![region()];
    j
}

fn ref_job(with_region: bool) -> EngineJob {
    let mut j = job(params(json!({ "refImageCount": 1 })));
    j.guidance.refs = vec![RefJob {
        model: r("ipadapter", "ip.safetensors"),
        clip_vision: r("clip_vision", "vit.safetensors"),
        image: png(),
        weight: 0.5,
        begin_end: [0.0, 1.0],
        method: RefImageMethod::Style,
        region: with_region.then(png),
    }];
    j
}

#[tokio::test]
async fn a_regional_prompt_uploads_its_mask_and_runs() {
    let (engine, fake) = serve(fake()).await;
    generate(&engine, &regional_job()).await.unwrap();
    assert_eq!(fake.uploads.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn a_failed_upload_of_a_region_a_reference_or_its_region_stops_the_job() {
    let ipa = novira_core::comfy::graph::IPADAPTER_NODE;
    let mut flux2_ref = job(params(json!({})));
    flux2_ref.checkpoint = r("diffusion_models", "base.safetensors");
    flux2_ref.split = Some(SplitJob::new(
        Family::Flux2,
        Loader::Unet,
        vec![r("text_encoders", "te.safetensors")],
    ));
    flux2_ref.vae = Some(r("vae", "flux2-vae.safetensors"));
    flux2_ref.guidance.references = vec![png()];
    let cases = [
        ("a region", regional_job(), 1),
        ("a reference", ref_job(true), 1),
        ("the region of a reference", ref_job(true), 2),
        ("a FLUX.2 reference", flux2_ref, 1),
    ];
    for (what, job, at) in cases {
        let (engine, fake) = serve(Fake {
            nodes: vec!["KSampler", ipa],
            fail_upload_at: at,
            ..fake()
        })
        .await;
        let err = generate(&engine, &job).await.unwrap_err().to_string();
        assert!(err.contains("500"), "{what}: {err}");
        assert_eq!(fake.uploads.load(Ordering::SeqCst), at, "{what}");
    }
}

#[tokio::test]
async fn a_reference_with_a_region_uploads_both_pictures() {
    let (engine, fake) = serve(Fake {
        nodes: vec!["KSampler", novira_core::comfy::graph::IPADAPTER_NODE],
        ..fake()
    })
    .await;
    generate(&engine, &ref_job(true)).await.unwrap();
    assert_eq!(fake.uploads.load(Ordering::SeqCst), 2);
}

fn video_job() -> EngineJob {
    let mut j = job(params(json!({
        "generationMode": "video", "width": 832, "height": 480, "videoFrames": 25, "videoFps": 24
    })));
    j.checkpoint = r("diffusion_models", "base.safetensors");
    j.split = Some(SplitJob::new(
        Family::HunyuanVideo,
        Loader::Unet,
        vec![
            r("text_encoders", "te.safetensors"),
            r("text_encoders", "te.safetensors"),
        ],
    ));
    j.vae = Some(r("vae", "ae.safetensors"));
    j
}

#[tokio::test]
async fn a_video_model_needs_the_node_of_its_family_in_comfyui() {
    let (engine, _) = serve(Fake {
        nodes: vec!["KSampler", "EmptyHunyuanLatentVideo"],
        ..fake()
    })
    .await;
    engine.validate(&video_job()).await.unwrap();
    let (old, _) = serve(fake()).await;
    let m = failure(old.validate(&video_job()).await);
    assert!(
        m.contains("too old for video") && m.contains("EmptyHunyuanLatentVideo"),
        "{m}"
    );
}
