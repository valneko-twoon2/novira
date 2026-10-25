//! `ComfyEngine` when ComfyUI is slow to report: a history that is empty or not finished for the first polls, a
//! WebSocket that says "done" while the history never shows a result, and the checks a video or music job makes before
//! it starts. Also a music result (audio bytes) and a job that names two models of one folder. A small scripted server
//! stands in for ComfyUI. The pause before each look at the history is shortened (debug-only seam).
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use novira_core::comfy::ComfyEngine;
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, JobGuidance};
use novira_core::types::{ComfyRef, GenerationMetadata};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio_util::sync::CancellationToken;

#[derive(Clone)]
struct Fake {
    /// `true`: the WebSocket says the job is done at once; `false`: there is no WebSocket (the route is missing).
    socket: bool,
    /// How many looks at the history answer "nothing yet" (twice: an empty answer, then an unfinished job) before it
    /// shows the finished job; `u32::MAX` never shows it.
    unfinished_looks: u32,
    /// The Wan video node is installed.
    video_node: bool,
    looks: Arc<AtomicU32>,
}

fn file() -> Value {
    json!({ "filename": "r.flac", "subfolder": "", "type": "temp" })
}

async fn socket(mut ws: WebSocket) {
    tokio::time::sleep(Duration::from_millis(100)).await;
    let _ = ws
        .send(Message::Text(
            json!({ "type": "execution_success", "data": { "prompt_id": "p1" } })
                .to_string()
                .into(),
        ))
        .await;
    tokio::time::sleep(Duration::from_secs(5)).await;
}

async fn serve(fake: Fake) -> String {
    let mut app = Router::new()
        .route(
            "/prompt",
            post(|| async { Json(json!({ "prompt_id": "p1", "node_errors": {} })) }),
        )
        .route(
            "/system_stats",
            get(|| async { Json(json!({ "system": {} })) }),
        )
        .route(
            "/history/{id}",
            get(|State(f): State<Fake>, Path(id): Path<String>| async move {
                let look = f.looks.fetch_add(1, Ordering::SeqCst);
                if look >= f.unfinished_looks {
                    // Every node id a graph might use has the audio file, so the output node is found.
                    let outputs: serde_json::Map<String, Value> = (1..40)
                        .map(|n| (n.to_string(), json!({ "audio": [file()] })))
                        .collect();
                    return Json(json!({ id: {
                            "outputs": outputs,
                            "status": { "status_str": "success", "completed": true, "messages": [] }
                        } }))
                    .into_response();
                }
                if look == 0 {
                    return Json(json!({})).into_response();
                }
                Json(json!({ id: { "outputs": {}, "status": { "completed": false } } }))
                    .into_response()
            }),
        )
        .route("/view", get(|| async { b"fLaC audio".to_vec() }))
        .route(
            "/models/{folder}",
            get(|| async {
                Json(json!([
                    "base.safetensors",
                    "a.safetensors",
                    "b.safetensors"
                ]))
            }),
        )
        .route(
            "/object_info/{node}",
            get(
                |State(f): State<Fake>, Path(node): Path<String>| async move {
                    if node == "Wan22ImageToVideoLatent" && !f.video_node {
                        return StatusCode::NOT_FOUND.into_response();
                    }
                    Json(json!({ node: {} })).into_response()
                },
            ),
        );
    if fake.socket {
        app = app.route(
            "/ws",
            get(|up: WebSocketUpgrade| async move { up.on_upgrade(socket) }),
        );
    }
    let app = app.with_state(fake);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    url
}

fn quick_pauses() {
    std::env::set_var("NOVIRA_TEST_RETRY_PAUSE_MS", "1");
}

fn params(mode: &str) -> GenerationMetadata {
    serde_json::from_value(json!({
        "generationMode": mode, "positivePrompt": "a song", "negativePrompt": "",
        "modelKey": "m", "modelName": "M", "vaeKey": null, "seed": 1, "steps": 3, "cfgScale": 7, "cfgRescale": 0,
        "scheduler": "euler", "width": 512, "height": 512, "clipSkip": 0, "seamlessX": false, "seamlessY": false,
        "loras": [],
        "music": { "lyrics": "la", "seconds": 20, "bpm": 100, "key": "C major", "timeSignature": 4,
                   "language": "en", "instrumental": false }
    }))
    .unwrap()
}

fn job(mode: &str) -> EngineJob {
    EngineJob {
        split: None,
        params: params(mode),
        checkpoint: ComfyRef {
            folder: "checkpoints".into(),
            name: "base.safetensors".into(),
        },
        vae: Some(ComfyRef {
            folder: "vae".into(),
            name: "base.safetensors".into(),
        }),
        loras: vec![],
        upscale_model: None,
        tile_controlnet: None,
        post_processing_model: None,
        text_encoder: Some(ComfyRef {
            folder: "text_encoders".into(),
            name: "base.safetensors".into(),
        }),
        init_image: None,
        graph: None,
        guidance: JobGuidance::default(),
    }
}

fn engine(url: &str) -> ComfyEngine {
    ComfyEngine::new(url, None, Duration::from_secs(1)).unwrap()
}

#[tokio::test]
async fn a_music_job_comes_back_as_audio_after_a_history_that_is_empty_then_unfinished() {
    quick_pauses();
    let url = serve(Fake {
        socket: false,
        unfinished_looks: 2,
        video_node: true,
        looks: Arc::default(),
    })
    .await;
    // No WebSocket, so the history is polled (about once a second): empty, unfinished, then done.
    let out = engine(&url)
        .generate(&job("music"), &|_| {}, &CancellationToken::new())
        .await
        .unwrap();
    assert!(
        matches!(out, EngineOutput::Audio { ref bytes, ext } if bytes == b"fLaC audio" && ext == "flac"),
        "{out:?}"
    );
}

#[tokio::test]
async fn a_job_that_comfyui_calls_done_but_the_history_never_shows_is_an_error() {
    quick_pauses();
    let url = serve(Fake {
        socket: true,
        unfinished_looks: u32::MAX,
        video_node: true,
        looks: Arc::default(),
    })
    .await;
    let err = engine(&url)
        .generate(&job("music"), &|_| {}, &CancellationToken::new())
        .await
        .unwrap_err();
    assert_eq!(
        err,
        EngineError::Failed("ComfyUI finished but the result was not found in its history".into())
    );
}

#[tokio::test]
async fn a_video_job_needs_the_video_node_and_two_models_of_one_folder_are_both_checked() {
    let missing = serve(Fake {
        socket: false,
        unfinished_looks: 0,
        video_node: false,
        looks: Arc::default(),
    })
    .await;
    let Err(EngineError::Failed(m)) = engine(&missing).validate(&job("video")).await else {
        panic!("a ComfyUI without the video node must be refused");
    };
    assert!(m.contains("too old for video"), "{m}");

    let present = serve(Fake {
        socket: false,
        unfinished_looks: 0,
        video_node: true,
        looks: Arc::default(),
    })
    .await;
    let mut two = job("txt2img");
    two.loras = vec![
        (
            ComfyRef {
                folder: "loras".into(),
                name: "a.safetensors".into(),
            },
            1.0,
        ),
        (
            ComfyRef {
                folder: "loras".into(),
                name: "b.safetensors".into(),
            },
            0.5,
        ),
    ];
    assert_eq!(engine(&present).validate(&two).await, Ok(()));
    assert_eq!(engine(&present).validate(&job("video")).await, Ok(()));
}
