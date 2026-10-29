//! `ComfyEngine` against a small fake ComfyUI that can be told to misbehave: refused uploads, a prompt without an id,
//! a missing result file, failing history, nodes that are not installed, and the engine's own start-up of a ComfyUI it
//! owns. The normal runs are in `comfy_fake_server`.
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use novira_core::comfy::client::{parse_preview, prompt_error_text};
use novira_core::comfy::process::{ComfyProcess, OwnedProcessConfig};
use novira_core::comfy::ComfyEngine;
use novira_core::engine::{
    Engine, EngineError, EngineJob, EngineOutput, EngineStatus, GraphJob, JobGuidance,
};
use novira_core::types::{ComfyRef, GenerationMetadata};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio_util::sync::CancellationToken;

/// What the fake server answers; every field is one way for a real ComfyUI to behave.
#[derive(Clone)]
struct Cfg {
    /// `ok`, `fail` (HTTP 500), `noname` (no name in the answer) or `sub` (a name inside a subfolder).
    upload: &'static str,
    /// `ok`, `noid` (accepted without an id) or `reject` (HTTP 400 with node errors).
    prompt: &'static str,
    /// The history entry of every prompt; `None` makes the history route fail with HTTP 500.
    history: Option<Value>,
    view_ok: bool,
    /// What `/view` sends back instead of a small PNG.
    view_body: Option<Vec<u8>>,
    free_ok: bool,
    /// Node classes `object_info` knows.
    nodes: Vec<&'static str>,
    /// The type of the one required input of a node class (`object_info` lists it under `input.required`); the other
    /// classes list no inputs.
    input_types: Vec<(&'static str, &'static str)>,
    /// What `/models/<folder>` lists in every folder.
    models: Vec<&'static str>,
    /// The server answers `system_stats` from the start (otherwise with HTTP 503 until `Fake::up` is set).
    up: bool,
}

impl Default for Cfg {
    fn default() -> Self {
        Self {
            upload: "ok",
            prompt: "ok",
            history: Some(done(json!({ "9": { "images": [file()] } }))),
            view_ok: true,
            view_body: None,
            free_ok: true,
            nodes: vec!["LoadImage", "PreviewImage"],
            input_types: Vec::new(),
            models: vec!["base.safetensors"],
            up: true,
        }
    }
}

#[derive(Clone)]
struct Fake {
    cfg: Arc<Cfg>,
    uploads: Arc<Mutex<Vec<String>>>,
    frees: Arc<AtomicU32>,
    up: Arc<AtomicBool>,
}

fn file() -> Value {
    file_named("r.png")
}

fn file_named(name: &str) -> Value {
    json!({ "filename": name, "subfolder": "", "type": "temp" })
}

fn done(outputs: Value) -> Value {
    json!({ "outputs": outputs, "status": { "status_str": "success", "completed": true, "messages": [] } })
}

fn png() -> Vec<u8> {
    let img = image::RgbImage::from_pixel(8, 8, image::Rgb([1, 2, 3]));
    let mut out = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(img)
        .write_to(&mut out, image::ImageFormat::Png)
        .unwrap();
    out.into_inner()
}

async fn serve_on(listener: tokio::net::TcpListener, cfg: Cfg) -> Fake {
    let fake = Fake {
        up: Arc::new(AtomicBool::new(cfg.up)),
        cfg: Arc::new(cfg),
        uploads: Arc::default(),
        frees: Arc::default(),
    };
    let app = Router::new()
        .route(
            "/system_stats",
            get(|State(f): State<Fake>| async move {
                if f.up.load(Ordering::SeqCst) {
                    Json(json!({ "system": {} })).into_response()
                } else {
                    StatusCode::SERVICE_UNAVAILABLE.into_response()
                }
            }),
        )
        .route(
            "/models/{folder}",
            get(|State(f): State<Fake>| async move { Json(json!(f.cfg.models)) }),
        )
        .route(
            "/object_info",
            get(|State(f): State<Fake>| async move {
                let all: serde_json::Map<String, Value> = f
                    .cfg
                    .nodes
                    .iter()
                    .map(|n| {
                        let typed = f.cfg.input_types.iter().find(|(c, _)| c == n);
                        let info = match typed {
                            Some((_, t)) => json!({ "input": { "required": { "in": [t] } } }),
                            None => json!({}),
                        };
                        (n.to_string(), info)
                    })
                    .collect();
                Json(Value::Object(all))
            }),
        )
        .route(
            "/object_info/{node}",
            get(
                |State(f): State<Fake>, Path(node): Path<String>| async move {
                    if f.cfg.nodes.contains(&node.as_str()) {
                        Json(json!({ node: {} })).into_response()
                    } else {
                        StatusCode::NOT_FOUND.into_response()
                    }
                },
            ),
        )
        .route(
            "/upload/image",
            post(|State(f): State<Fake>| async move {
                f.uploads.lock().unwrap().push("upload".into());
                match f.cfg.upload {
                    "fail" => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
                    "noname" => Json(json!({})).into_response(),
                    "sub" => Json(json!({ "name": "a.png", "subfolder": "s" })).into_response(),
                    _ => Json(json!({ "name": "a.png", "subfolder": "" })).into_response(),
                }
            }),
        )
        .route(
            "/prompt",
            post(|State(f): State<Fake>| async move {
                match f.cfg.prompt {
                    "noid" => Json(json!({})).into_response(),
                    "reject" => (
                        StatusCode::BAD_REQUEST,
                        Json(json!({
                            "error": { "message": "Prompt outputs failed validation" },
                            "node_errors": { "1": { "class_type": "KSampler",
                                "errors": [{ "message": "Required input is missing", "details": "" }] } }
                        })),
                    )
                        .into_response(),
                    _ => Json(json!({ "prompt_id": "p1", "node_errors": {} })).into_response(),
                }
            }),
        )
        .route(
            "/history/{id}",
            get(|State(f): State<Fake>, Path(id): Path<String>| async move {
                match &f.cfg.history {
                    Some(entry) => Json(json!({ id: entry })).into_response(),
                    None => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
                }
            }),
        )
        .route(
            "/view",
            get(|State(f): State<Fake>| async move {
                if f.cfg.view_ok {
                    f.cfg.view_body.clone().unwrap_or_else(png).into_response()
                } else {
                    StatusCode::INTERNAL_SERVER_ERROR.into_response()
                }
            }),
        )
        .route(
            "/free",
            post(|State(f): State<Fake>| async move {
                f.frees.fetch_add(1, Ordering::SeqCst);
                if f.cfg.free_ok {
                    StatusCode::OK
                } else {
                    StatusCode::INTERNAL_SERVER_ERROR
                }
            }),
        )
        .route("/queue", post(|| async { StatusCode::OK }))
        .route("/interrupt", post(|| async { StatusCode::OK }))
        .route(
            "/pack/echo",
            post(|Json(body): Json<Value>| async move { Json(json!({ "echo": body })) }),
        )
        .route(
            "/pack/get",
            get(|| async { Json(json!({ "installed": true })) }),
        )
        .route("/pack/text", get(|| async { "this is not json" }))
        .with_state(fake.clone());
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    fake
}

async fn serve(cfg: Cfg) -> (String, Fake) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    (url, serve_on(listener, cfg).await)
}

fn engine(url: &str) -> ComfyEngine {
    ComfyEngine::new(url, None, Duration::from_secs(1)).unwrap()
}

fn params(mode: &str) -> GenerationMetadata {
    serde_json::from_value(json!({
        "generationMode": mode, "positivePrompt": "a cat", "negativePrompt": "",
        "modelKey": "m", "modelName": "M", "vaeKey": null, "seed": 1, "steps": 3, "cfgScale": 7, "cfgRescale": 0,
        "scheduler": "euler", "width": 512, "height": 512, "clipSkip": 0, "seamlessX": false, "seamlessY": false,
        "loras": []
    }))
    .unwrap()
}

fn model(name: &str) -> ComfyRef {
    ComfyRef {
        folder: "checkpoints".into(),
        name: name.into(),
    }
}

/// A job that runs a prompt of its own: a loader and an output node `9`.
fn graph_job(graph: GraphJob) -> EngineJob {
    EngineJob {
        split: None,
        params: params("txt2img"),
        checkpoint: model("base.safetensors"),
        vae: None,
        loras: vec![],
        upscale_model: None,
        tile_controlnet: None,
        post_processing_model: None,
        text_encoder: None,
        init_image: None,
        graph: Some(graph),
        guidance: JobGuidance::default(),
    }
}

fn plain_graph() -> GraphJob {
    GraphJob {
        prompt: json!({
            "1": { "class_type": "LoadImage", "inputs": { "image": { "$image": "pic.png" } } },
            "9": { "class_type": "PreviewImage", "inputs": { "images": ["1", 0] } }
        }),
        outputs: vec!["9".into()],
        models: vec![],
        images: vec![("pic.png".into(), png())],
        thumbnail: None,
        no_result: false,
    }
}

async fn run(engine: &ComfyEngine, job: &EngineJob) -> Result<EngineOutput, EngineError> {
    engine
        .generate(job, &|_| {}, &CancellationToken::new())
        .await
}

fn message(r: Result<EngineOutput, EngineError>) -> String {
    match r {
        Err(EngineError::Failed(m)) => m,
        other => panic!("expected a failure, got {other:?}"),
    }
}

// Pure helpers --------------------------------------------------------------------------------------------------

#[test]
fn previews_are_read_from_both_frame_layouts_and_empty_ones_are_dropped() {
    // Layout 4: the length of a JSON header, the header, then the picture.
    let header = br#"{"image_type":"image/png"}"#;
    let mut frame = 4u32.to_be_bytes().to_vec();
    frame.extend((header.len() as u32).to_be_bytes());
    frame.extend(header);
    frame.extend([1, 2, 3]);
    assert!(parse_preview(&frame)
        .unwrap()
        .starts_with("data:image/png;base64,"));
    // A frame with a header and no picture gives nothing; so does a header that is cut short or unknown.
    let mut empty = 4u32.to_be_bytes().to_vec();
    empty.extend((header.len() as u32).to_be_bytes());
    empty.extend(header);
    assert!(parse_preview(&empty).is_none());
    assert!(parse_preview(&frame[..10]).is_none());
    assert!(parse_preview(&9u32.to_be_bytes()).is_none());
    assert!(parse_preview(&[0, 0]).is_none());
}

#[test]
fn a_rejected_prompt_names_each_failing_node() {
    let body = json!({
        "error": { "message": "Prompt outputs failed validation" },
        "node_errors": { "1": { "class_type": "KSampler", "errors": [
            { "message": "Required input is missing", "details": "" },
            { "message": "Value not in list", "details": "ckpt_name" }
        ] }, "2": { "errors": [{}] } }
    });
    assert_eq!(
        prompt_error_text(&body),
        "Prompt outputs failed validation / KSampler: Required input is missing / KSampler: ckpt_name / node: "
    );
    assert_eq!(prompt_error_text(&json!({})), "ComfyUI rejected the prompt");
}

// Uploads and queueing ------------------------------------------------------------------------------------------

#[tokio::test]
async fn a_refused_upload_stops_the_job() {
    let (url, fake) = serve(Cfg {
        upload: "fail",
        ..Cfg::default()
    })
    .await;
    let err = message(run(&engine(&url), &graph_job(plain_graph())).await);
    assert!(err.contains("image upload answered 500"), "{err}");
    assert_eq!(fake.uploads.lock().unwrap().len(), 1);
}

#[tokio::test]
async fn an_upload_answered_without_a_name_stops_the_job() {
    let (url, _) = serve(Cfg {
        upload: "noname",
        ..Cfg::default()
    })
    .await;
    let err = message(run(&engine(&url), &graph_job(plain_graph())).await);
    assert!(err.contains("returned no name"), "{err}");
}

#[tokio::test]
async fn a_video_and_a_sound_in_the_graph_are_uploaded_and_a_prompt_without_an_id_is_an_error() {
    let (url, fake) = serve(Cfg {
        upload: "sub",
        prompt: "noid",
        ..Cfg::default()
    })
    .await;
    let mut graph = plain_graph();
    graph.images = vec![
        ("pic.png".into(), png()),
        ("clip.mp4".into(), vec![0; 8]),
        ("song.flac".into(), b"fLaC".to_vec()),
    ];
    let err = message(run(&engine(&url), &graph_job(graph)).await);
    assert!(err.contains("no prompt id"), "{err}");
    assert_eq!(fake.uploads.lock().unwrap().len(), 3);
}

#[tokio::test]
async fn a_rejected_prompt_gives_the_reason_of_each_node() {
    let (url, _) = serve(Cfg {
        prompt: "reject",
        ..Cfg::default()
    })
    .await;
    let err = message(run(&engine(&url), &graph_job(plain_graph())).await);
    assert!(err.contains("KSampler: Required input is missing"), "{err}");
}

#[tokio::test]
async fn a_graph_without_an_output_node_is_refused() {
    let (url, _) = serve(Cfg::default()).await;
    let mut graph = plain_graph();
    graph.outputs.clear();
    let err = message(run(&engine(&url), &graph_job(graph)).await);
    assert!(err.contains("no output node"), "{err}");
}

#[tokio::test]
async fn a_picture_that_was_not_uploaded_is_named() {
    let (url, _) = serve(Cfg::default()).await;
    let mut graph = plain_graph();
    graph.images.clear();
    let err = message(run(&engine(&url), &graph_job(graph)).await);
    assert!(err.contains("pic.png"), "{err}");
}

// Results -------------------------------------------------------------------------------------------------------

#[tokio::test]
async fn a_node_that_showed_text_gives_text() {
    let (url, _) = serve(Cfg {
        history: Some(done(json!({ "9": { "text": ["1girl", 5] } }))),
        ..Cfg::default()
    })
    .await;
    let out = run(&engine(&url), &graph_job(plain_graph())).await.unwrap();
    assert_eq!(out, EngineOutput::Text("1girl\n5".into()));
}

#[tokio::test]
async fn a_text_node_that_answers_with_one_string_gives_that_string() {
    let (url, _) = serve(Cfg {
        history: Some(done(json!({ "9": { "text": "just words" } }))),
        ..Cfg::default()
    })
    .await;
    let out = run(&engine(&url), &graph_job(plain_graph())).await.unwrap();
    assert_eq!(out, EngineOutput::Text("just words".into()));
}

#[tokio::test]
async fn a_video_graph_brings_back_the_file_and_its_first_frame() {
    let (url, _) = serve(Cfg {
        history: Some(done(json!({
            "9": { "images": [file_named("clip_00001_.mp4")], "animated": [true] },
            "8": { "images": [file()] }
        }))),
        ..Cfg::default()
    })
    .await;
    let mut graph = plain_graph();
    graph.thumbnail = Some("8".into());
    let out = run(&engine(&url), &graph_job(graph)).await.unwrap();
    assert!(matches!(out, EngineOutput::Video { .. }), "{out:?}");
}

/// A graph whose output node `9` reported `file`, with the bytes `/view` sends.
async fn result_of(
    file: Value,
    body: Vec<u8>,
    thumbnail: bool,
) -> Result<EngineOutput, EngineError> {
    let (url, _) = serve(Cfg {
        history: Some(done(json!({ "9": { "audio": [file.clone()], "images": [file], }, "8": { "images": [file_named("f.png")] } }))),
        view_body: Some(body),
        ..Cfg::default()
    })
    .await;
    let mut graph = plain_graph();
    graph.thumbnail = thumbnail.then(|| "8".to_string());
    run(&engine(&url), &graph_job(graph)).await
}

#[tokio::test]
async fn a_graph_that_saved_sound_gives_the_sound_in_the_format_it_was_saved_in() {
    for (name, ext) in [
        ("a_00001_.flac", "flac"),
        ("a.MP3", "mp3"),
        ("a.wav", "wav"),
    ] {
        let out = result_of(file_named(name), b"fLaC....".to_vec(), false)
            .await
            .unwrap();
        assert_eq!(
            out,
            EngineOutput::Audio {
                bytes: b"fLaC....".to_vec(),
                ext
            },
            "{name}"
        );
    }
}

#[tokio::test]
async fn sound_and_video_in_formats_the_gallery_cannot_keep_are_refused_with_the_way_out() {
    for (name, wants) in [
        ("a.opus", "MP3, WAV or FLAC"),
        ("a.ogg", "MP3, WAV or FLAC"),
        ("v.webm", "save the video as MP4"),
        ("v.mkv", "save the video as MP4"),
    ] {
        let Err(EngineError::Failed(m)) = result_of(file_named(name), vec![0], true).await else {
            panic!("{name} must be refused")
        };
        assert!(m.contains(wants), "{name}: {m}");
    }
}

#[tokio::test]
async fn a_video_with_no_node_for_its_first_frame_is_refused_not_stored_as_a_picture() {
    let Err(EngineError::Failed(m)) = result_of(file_named("v.mp4"), vec![0], false).await else {
        panic!("a video without a first frame must be refused")
    };
    assert!(m.contains("first frame"), "{m}");
}

#[tokio::test]
async fn a_result_file_that_cannot_be_fetched_is_an_error() {
    let (url, _) = serve(Cfg {
        view_ok: false,
        ..Cfg::default()
    })
    .await;
    let err = message(run(&engine(&url), &graph_job(plain_graph())).await);
    assert!(err.contains("/view answered 500"), "{err}");
}

#[tokio::test]
async fn a_finished_job_without_any_file_is_an_error() {
    let (url, _) = serve(Cfg {
        history: Some(done(json!({ "9": {} }))),
        ..Cfg::default()
    })
    .await;
    let err = message(run(&engine(&url), &graph_job(plain_graph())).await);
    assert!(err.contains("without a result file"), "{err}");
}

#[tokio::test]
async fn a_loss_picture_that_cannot_be_read_is_skipped_and_the_job_still_succeeds() {
    let (url, _) = serve(Cfg {
        view_ok: false,
        ..Cfg::default()
    })
    .await;
    let mut graph = plain_graph();
    graph.no_result = true;
    let out = run(&engine(&url), &graph_job(graph)).await.unwrap();
    assert_eq!(out, EngineOutput::Nothing);
}

#[tokio::test]
async fn a_failing_history_ends_the_job_with_its_status() {
    let (url, _) = serve(Cfg {
        history: None,
        ..Cfg::default()
    })
    .await;
    let err = message(run(&engine(&url), &graph_job(plain_graph())).await);
    assert!(err.contains("history/p1 answered 500"), "{err}");
}

#[tokio::test]
async fn an_error_in_the_history_is_reported_with_the_nodes_message_or_a_general_one() {
    let with_message = json!({ "outputs": {}, "status": { "status_str": "error", "completed": false, "messages": [
        ["execution_start", {}],
        ["execution_error", { "node_type": "KSampler", "exception_message": "mat1 and mat2 shapes cannot be multiplied" }]
    ] } });
    let (url, _) = serve(Cfg {
        history: Some(with_message),
        ..Cfg::default()
    })
    .await;
    let err = message(run(&engine(&url), &graph_job(plain_graph())).await);
    assert_eq!(
        err,
        "ComfyUI KSampler: mat1 and mat2 shapes cannot be multiplied"
    );

    let without = json!({ "outputs": {}, "status": { "status_str": "error", "completed": false } });
    let (url, _) = serve(Cfg {
        history: Some(without),
        ..Cfg::default()
    })
    .await;
    let err = message(run(&engine(&url), &graph_job(plain_graph())).await);
    assert_eq!(err, "ComfyUI reported an error");
}

#[tokio::test]
async fn running_out_of_memory_asks_comfyui_to_free_it_even_when_that_fails() {
    let oom = json!({ "outputs": {}, "status": { "status_str": "error", "completed": false, "messages": [
        ["execution_error", { "node_type": "KSampler", "exception_message": "CUDA out of memory" }]
    ] } });
    for free_ok in [true, false] {
        let (url, fake) = serve(Cfg {
            history: Some(oom.clone()),
            free_ok,
            ..Cfg::default()
        })
        .await;
        let err = message(run(&engine(&url), &graph_job(plain_graph())).await);
        assert!(err.contains("out of memory"), "{err}");
        assert_eq!(fake.frees.load(Ordering::SeqCst), 1);
    }
}

// Validation ----------------------------------------------------------------------------------------------------

#[tokio::test]
async fn a_graph_that_uses_nodes_comfyui_does_not_have_is_refused() {
    let (url, _) = serve(Cfg::default()).await;
    let mut graph = plain_graph();
    graph.prompt["5"] = json!({ "class_type": "FilmGrain", "inputs": {} });
    let job = graph_job(graph);
    let Err(EngineError::Failed(m)) = engine(&url).validate(&job).await else {
        panic!("a missing node must be refused")
    };
    assert!(m.contains("no FilmGrain node"), "{m}");
    // With every node installed the graph passes.
    let job = graph_job(plain_graph());
    engine(&url).validate(&job).await.unwrap();
}

#[tokio::test]
async fn a_graph_whose_output_saves_audio_or_video_passes_the_check() {
    let (url, _) = serve(Cfg {
        nodes: vec![
            "LoadImage",
            "PreviewImage",
            "SaveAudioAdvanced",
            "SaveVideo",
        ],
        input_types: vec![("SaveAudioAdvanced", "AUDIO"), ("SaveVideo", "VIDEO")],
        ..Cfg::default()
    })
    .await;
    for class in ["SaveAudioAdvanced", "SaveVideo"] {
        let mut graph = plain_graph();
        graph.prompt["9"] = json!({ "class_type": class, "inputs": { "in": ["1", 0] } });
        engine(&url).validate(&graph_job(graph)).await.unwrap();
    }
}

#[tokio::test]
async fn a_graph_with_a_model_comfyui_cannot_see_is_refused() {
    let (url, _) = serve(Cfg::default()).await;
    let mut graph = plain_graph();
    graph.models = vec![model("missing.safetensors")];
    let job = graph_job(graph);
    let Err(EngineError::Failed(m)) = engine(&url).validate(&job).await else {
        panic!("a missing model must be refused")
    };
    assert!(m.contains("missing.safetensors"), "{m}");
}

#[tokio::test]
async fn video_and_music_jobs_need_the_nodes_of_a_new_enough_comfyui() {
    let (url, _) = serve(Cfg::default()).await;
    let e = engine(&url);
    let mut video = graph_job(plain_graph());
    video.graph = None;
    video.params = params("video");
    video.init_image = Some(png());
    video.text_encoder = Some(model("base.safetensors"));
    let Err(EngineError::Failed(m)) = e.validate(&video).await else {
        panic!("an old ComfyUI must be refused for video")
    };
    assert!(
        m.contains("too old for video") || m.contains("video"),
        "unexpected: {m}"
    );
    let mut music = video.clone();
    music.params = params("music");
    music.init_image = None;
    music.text_encoder = None;
    let Err(EngineError::Failed(m)) = e.validate(&music).await else {
        panic!("an old ComfyUI must be refused for music")
    };
    assert!(
        m.contains("too old for ACE-Step") || m.contains("music"),
        "{m}"
    );
}

// The engine itself ---------------------------------------------------------------------------------------------

#[tokio::test]
async fn routes_of_custom_node_packs_are_called_with_get_or_post() {
    let (url, _) = serve(Cfg::default()).await;
    let e = engine(&url);
    let cancel = CancellationToken::new();
    let got = e.pack_request(&cancel, "pack/get", None).await.unwrap();
    assert_eq!(got["installed"], true);
    let echoed = e
        .pack_request(&cancel, "pack/echo", Some(json!({ "a": 1 })))
        .await
        .unwrap();
    assert_eq!(echoed["echo"]["a"], 1);
    let Err(EngineError::Failed(m)) = e.pack_request(&cancel, "pack/none", None).await else {
        panic!("a missing route must fail")
    };
    assert!(m.contains("404") && m.contains("custom node pack"), "{m}");
    assert!(e.pack_request(&cancel, "pack/text", None).await.is_err());
}

#[tokio::test]
async fn node_definitions_come_from_object_info() {
    let (url, _) = serve(Cfg::default()).await;
    let defs = engine(&url)
        .node_defs(&CancellationToken::new())
        .await
        .unwrap();
    assert!(defs.get("LoadImage").is_some());
}

#[tokio::test]
async fn a_server_that_was_not_started_by_novira_cannot_be_restarted_or_set_to_low_memory() {
    let (url, _) = serve(Cfg::default()).await;
    let e = engine(&url);
    let Err(EngineError::Failed(m)) = e.restart(&CancellationToken::new()).await else {
        panic!("restarting a foreign server must fail")
    };
    assert!(m.contains("restart it yourself"), "{m}");
    assert!(!e.set_low_memory(true));
    assert!(!e.low_memory_pending());
    e.prepare(&CancellationToken::new()).await.unwrap();
    assert_eq!(e.status(), EngineStatus::Ready);
    e.shutdown();
}

#[tokio::test]
async fn an_unreachable_server_is_an_error_status_that_reaches_the_sink() {
    // A port nobody listens on.
    let port = {
        let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        l.local_addr().unwrap().port()
    };
    let e = engine(&format!("http://127.0.0.1:{port}"));
    let seen: Arc<Mutex<Vec<EngineStatus>>> = Arc::default();
    let sink = seen.clone();
    e.set_status_sink(Arc::new(move |s| sink.lock().unwrap().push(s)));
    let err = e.prepare(&CancellationToken::new()).await.unwrap_err();
    assert!(err.to_string().contains("not reachable"), "{err}");
    assert!(matches!(e.status(), EngineStatus::Error { .. }));
    assert!(matches!(
        seen.lock().unwrap().as_slice(),
        [EngineStatus::Error { .. }]
    ));
    // A second failure with the same text is not announced again.
    let _ = e.prepare(&CancellationToken::new()).await;
    assert_eq!(seen.lock().unwrap().len(), 1);
}

#[test]
fn an_address_that_is_not_http_is_refused() {
    assert!(ComfyEngine::new("ws://127.0.0.1:8188", None, Duration::from_secs(1)).is_err());
    assert!(ComfyEngine::new("not a url", None, Duration::from_secs(1)).is_err());
}

// An engine that owns the ComfyUI process -----------------------------------------------------------------------

/// A folder with a `main.py` and a fake Python (a script that stays alive or ends at once, like a real one would).
struct Owned {
    dir: tempfile::TempDir,
    process: ComfyProcess,
}

fn owned(port: u16, python_body: (&str, &str)) -> Owned {
    let dir = tempfile::tempdir().unwrap();
    let comfy = dir.path().join("ComfyUI");
    std::fs::create_dir_all(&comfy).unwrap();
    std::fs::write(comfy.join("main.py"), b"").unwrap();
    let (name, body) = if cfg!(windows) {
        ("python.cmd", format!("@echo off\r\n{}\r\n", python_body.0))
    } else {
        ("python", format!("#!/bin/sh\n{}\n", python_body.1))
    };
    let python = dir.path().join(name);
    std::fs::write(&python, body).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&python, std::fs::Permissions::from_mode(0o755)).unwrap();
    }
    let process = ComfyProcess::new(OwnedProcessConfig {
        comfyui_dir: comfy,
        python: Some(python),
        host: "127.0.0.1".into(),
        port,
        extra_model_paths: dir.path().join("extra.yaml"),
        extra_args: vec![],
        log_file: dir.path().join("logs").join("comfyui.log"),
    });
    Owned { dir, process }
}

const STAYS_ALIVE: (&str, &str) = ("ping -n 20 127.0.0.1 >nul", "sleep 20");
const ENDS_AT_ONCE: (&str, &str) = ("exit /b 3", "exit 3");

/// A server that answers every request but says it is not ready; returns its port.
async fn not_ready_server() -> (u16, Fake) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let fake = serve_on(
        listener,
        Cfg {
            up: false,
            ..Cfg::default()
        },
    )
    .await;
    (port, fake)
}

#[tokio::test]
async fn an_owned_comfyui_is_started_and_waited_for_until_it_answers() {
    let (port, fake) = not_ready_server().await;
    let owned = owned(port, STAYS_ALIVE);
    let e = ComfyEngine::new(
        &format!("http://127.0.0.1:{port}"),
        Some(owned.process),
        Duration::from_secs(10),
    )
    .unwrap();
    // The server comes up a moment after the process was started.
    let late = tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(600)).await;
        fake.up.store(true, Ordering::SeqCst);
    });
    let statuses: Arc<Mutex<Vec<EngineStatus>>> = Arc::default();
    let sink = statuses.clone();
    e.set_status_sink(Arc::new(move |s| sink.lock().unwrap().push(s)));
    e.prepare(&CancellationToken::new()).await.unwrap();
    late.await.unwrap();
    assert_eq!(e.status(), EngineStatus::Ready);
    assert!(statuses.lock().unwrap().contains(&EngineStatus::Starting));
    // Low-memory mode is applied at the next start, and the running one is told apart.
    assert!(e.set_low_memory(true));
    assert!(e.low_memory_pending());
    e.shutdown();
    assert!(!e.low_memory_pending());
    drop(owned.dir);
}

#[tokio::test]
async fn an_owned_comfyui_that_ends_while_starting_is_reported() {
    let (port, _) = not_ready_server().await;
    let owned = owned(port, ENDS_AT_ONCE);
    let e = ComfyEngine::new(
        &format!("http://127.0.0.1:{port}"),
        Some(owned.process),
        Duration::from_secs(10),
    )
    .unwrap();
    let err = e.prepare(&CancellationToken::new()).await.unwrap_err();
    assert!(err.to_string().contains("exited while starting"), "{err}");
    assert!(matches!(e.status(), EngineStatus::Error { .. }));
}

#[tokio::test]
async fn an_owned_comfyui_that_never_answers_runs_into_the_time_limit() {
    let (port, _) = not_ready_server().await;
    let owned = owned(port, STAYS_ALIVE);
    let e = ComfyEngine::new(
        &format!("http://127.0.0.1:{port}"),
        Some(owned.process),
        Duration::from_millis(1500),
    )
    .unwrap();
    let err = e.prepare(&CancellationToken::new()).await.unwrap_err();
    assert!(err.to_string().contains("did not answer in time"), "{err}");
    e.shutdown();
}

#[tokio::test]
async fn stopping_while_the_owned_comfyui_starts_is_a_cancellation() {
    let (port, _) = not_ready_server().await;
    let owned = owned(port, STAYS_ALIVE);
    let e = ComfyEngine::new(
        &format!("http://127.0.0.1:{port}"),
        Some(owned.process),
        Duration::from_secs(10),
    )
    .unwrap();
    let cancel = CancellationToken::new();
    let stopper = cancel.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(300)).await;
        stopper.cancel();
    });
    let err = e.prepare(&cancel).await.unwrap_err();
    assert!(matches!(err, EngineError::Cancelled), "{err}");
    // The screens must not go on saying "starting" for a start that was given up.
    assert_eq!(e.status(), EngineStatus::Idle);
    e.shutdown();
}

#[tokio::test]
async fn a_restart_stops_the_old_process_and_starts_a_new_one() {
    let (port, fake) = not_ready_server().await;
    let owned = owned(port, STAYS_ALIVE);
    let e = ComfyEngine::new(
        &format!("http://127.0.0.1:{port}"),
        Some(owned.process),
        Duration::from_secs(10),
    )
    .unwrap();
    let late = tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(300)).await;
        fake.up.store(true, Ordering::SeqCst);
    });
    e.restart(&CancellationToken::new()).await.unwrap();
    late.await.unwrap();
    assert_eq!(e.status(), EngineStatus::Ready);
    e.shutdown();
}

#[tokio::test]
async fn a_missing_comfyui_install_is_downloaded_first_and_a_failure_is_reported() {
    let (port, _) = not_ready_server().await;
    let root = tempfile::tempdir().unwrap();
    let owned = owned(port, STAYS_ALIVE);
    // An unknown package fails before anything is downloaded.
    let e = ComfyEngine::new(
        &format!("http://127.0.0.1:{port}"),
        Some(owned.process),
        Duration::from_secs(5),
    )
    .unwrap()
    .with_installer(root.path().to_path_buf(), "no-such-package".into());
    let err = e.prepare(&CancellationToken::new()).await.unwrap_err();
    assert!(
        err.to_string().contains("no-such-package") || err.to_string().contains("only available"),
        "{err}"
    );
    assert!(matches!(e.status(), EngineStatus::Error { .. }));
}
