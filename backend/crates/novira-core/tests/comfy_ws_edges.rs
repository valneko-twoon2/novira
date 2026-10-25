//! `ComfyEngine` listening to ComfyUI's WebSocket: a job ComfyUI interrupts, a socket that carries noise and then drops
//! (the engine goes on by polling the history), and preview pictures. A small scripted server stands in for ComfyUI.
//! The usual runs are in `comfy_fake_server`.
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use novira_core::comfy::client::parse_preview;
use novira_core::comfy::ComfyEngine;
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, GraphJob, JobGuidance};
use novira_core::types::{ComfyRef, GenerationMetadata};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio_util::sync::CancellationToken;

#[derive(Clone, Copy)]
enum Script {
    /// ComfyUI reports that the job was interrupted.
    Interrupted,
    /// A ping, a binary frame that is no preview, text that is no JSON, then the socket closes.
    NoiseThenClose,
    /// A preview picture, then the success message.
    PreviewThenSuccess,
}

#[derive(Clone)]
struct Fake {
    script: Script,
    previews: Arc<Mutex<u32>>,
}

fn png() -> Vec<u8> {
    let img = image::RgbImage::from_pixel(4, 4, image::Rgb([1, 2, 3]));
    let mut out = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(img)
        .write_to(&mut out, image::ImageFormat::Png)
        .unwrap();
    out.into_inner()
}

async fn socket(mut ws: WebSocket, script: Script) {
    tokio::time::sleep(Duration::from_millis(150)).await;
    match script {
        Script::Interrupted => {
            let _ = ws
                .send(Message::Text(
                    json!({ "type": "execution_interrupted", "data": { "prompt_id": "p1" } })
                        .to_string()
                        .into(),
                ))
                .await;
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
        Script::NoiseThenClose => {
            let _ = ws.send(Message::Ping(vec![1].into())).await;
            let _ = ws.send(Message::Binary(vec![0, 0, 0, 0].into())).await;
            let _ = ws.send(Message::Text("this is not json".into())).await;
            drop(ws);
        }
        Script::PreviewThenSuccess => {
            let mut frame = 1u32.to_be_bytes().to_vec();
            frame.extend(2u32.to_be_bytes());
            frame.extend([1, 2, 3, 4]);
            let _ = ws.send(Message::Binary(frame.into())).await;
            let _ = ws
                .send(Message::Text(
                    json!({ "type": "execution_success", "data": { "prompt_id": "p1" } })
                        .to_string()
                        .into(),
                ))
                .await;
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    }
}

async fn serve(script: Script) -> String {
    let fake = Fake {
        script,
        previews: Arc::default(),
    };
    let app = Router::new()
        .route(
            "/ws",
            get(|State(f): State<Fake>, up: WebSocketUpgrade| async move {
                *f.previews.lock().unwrap() += 1;
                up.on_upgrade(move |ws| socket(ws, f.script))
            }),
        )
        .route(
            "/prompt",
            post(|| async { Json(json!({ "prompt_id": "p1", "node_errors": {} })) }),
        )
        .route(
            "/system_stats",
            get(|| async { Json(json!({ "system": {} })) }),
        )
        .route("/interrupt", post(|| async { axum::http::StatusCode::OK }))
        .route(
            "/history/{id}",
            get(|Path(id): Path<String>| async move {
                Json(json!({ id: {
                    "outputs": { "9": { "images": [
                        { "filename": "r.png", "subfolder": "", "type": "temp" }
                    ] } },
                    "status": { "status_str": "success", "completed": true, "messages": [] }
                } }))
            }),
        )
        .route("/view", get(|| async { png().into_response() }))
        .route(
            "/models/{folder}",
            get(|| async { Json(json!(["base.safetensors"])) }),
        )
        .route(
            "/object_info/{node}",
            get(|Path(node): Path<String>| async move {
                // The video node is missing (not found); the music node answers without its definition.
                if node == "Wan22ImageToVideoLatent" {
                    axum::http::StatusCode::NOT_FOUND.into_response()
                } else {
                    Json(json!({})).into_response()
                }
            }),
        )
        .with_state(fake);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    url
}

fn job() -> EngineJob {
    let params: GenerationMetadata = serde_json::from_value(json!({
        "generationMode": "txt2img", "positivePrompt": "a cat", "negativePrompt": "",
        "modelKey": "m", "modelName": "M", "vaeKey": null, "seed": 1, "steps": 3, "cfgScale": 7, "cfgRescale": 0,
        "scheduler": "euler", "width": 512, "height": 512, "clipSkip": 0, "seamlessX": false, "seamlessY": false,
        "loras": []
    }))
    .unwrap();
    EngineJob {
        split: None,
        params,
        checkpoint: ComfyRef {
            folder: "checkpoints".into(),
            name: "base.safetensors".into(),
        },
        vae: None,
        loras: vec![],
        upscale_model: None,
        tile_controlnet: None,
        post_processing_model: None,
        text_encoder: None,
        init_image: None,
        graph: Some(GraphJob {
            prompt: json!({
                "1": { "class_type": "EmptyImage", "inputs": { "width": 4, "height": 4 } },
                "9": { "class_type": "PreviewImage", "inputs": { "images": ["1", 0] } }
            }),
            outputs: vec!["9".into()],
            models: vec![],
            images: vec![],
            thumbnail: None,
            no_result: false,
        }),
        guidance: JobGuidance::default(),
    }
}

async fn run(script: Script) -> (Result<EngineOutput, EngineError>, Vec<Option<String>>) {
    let url = serve(script).await;
    let engine = ComfyEngine::new(&url, None, Duration::from_secs(1)).unwrap();
    let previews = Mutex::new(Vec::new());
    let result = engine
        .generate(
            &job(),
            &|p| previews.lock().unwrap().push(p.preview),
            &CancellationToken::new(),
        )
        .await;
    (result, previews.into_inner().unwrap())
}

#[tokio::test]
async fn a_job_comfyui_interrupts_fails_with_that_reason() {
    let (result, _) = run(Script::Interrupted).await;
    match result {
        Err(EngineError::Failed(m)) => assert_eq!(m, "ComfyUI interrupted the job"),
        other => panic!("expected a failure, got {other:?}"),
    }
}

#[tokio::test]
async fn a_socket_with_noise_that_closes_does_not_stop_the_job() {
    let (result, _) = run(Script::NoiseThenClose).await;
    assert!(matches!(result, Ok(EngineOutput::Image(_))), "{result:?}");
}

#[tokio::test]
async fn a_preview_frame_is_shown_while_the_job_runs() {
    let (result, previews) = run(Script::PreviewThenSuccess).await;
    assert!(matches!(result, Ok(EngineOutput::Image(_))), "{result:?}");
    assert!(
        previews
            .iter()
            .flatten()
            .any(|p| p.starts_with("data:image/png;base64,")),
        "{previews:?}"
    );
}

#[test]
fn a_preview_header_that_names_another_type_is_shown_as_jpeg() {
    let header = br#"{"image_type":"image/webp"}"#;
    let mut frame = 4u32.to_be_bytes().to_vec();
    frame.extend((header.len() as u32).to_be_bytes());
    frame.extend(header);
    frame.extend([1, 2, 3]);
    let url: Value = json!(parse_preview(&frame));
    assert!(url.as_str().unwrap().starts_with("data:image/jpeg;base64,"));
}

/// A job with no prompt of its own, so `validate` builds the graph and asks ComfyUI what it has.
fn plain_job(mode: &str) -> EngineJob {
    let params: GenerationMetadata = serde_json::from_value(json!({
        "generationMode": mode, "positivePrompt": "a cat", "negativePrompt": "",
        "modelKey": "m", "modelName": "M", "vaeKey": null, "seed": 1, "steps": 3, "cfgScale": 7, "cfgRescale": 0,
        "scheduler": "euler", "width": 512, "height": 512, "clipSkip": 0, "seamlessX": false, "seamlessY": false,
        "loras": [],
        "music": { "lyrics": "", "seconds": 30, "bpm": 100, "key": "C major", "timeSignature": 4,
                   "language": "en", "instrumental": true }
    }))
    .unwrap();
    let file = ComfyRef {
        folder: "checkpoints".into(),
        name: "base.safetensors".into(),
    };
    EngineJob {
        split: None,
        params,
        checkpoint: file.clone(),
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

#[tokio::test]
async fn video_and_music_need_the_nodes_of_a_new_enough_comfyui() {
    let engine = ComfyEngine::new(
        &serve(Script::NoiseThenClose).await,
        None,
        Duration::from_secs(1),
    )
    .unwrap();
    let Err(EngineError::Failed(m)) = engine.validate(&plain_job("video")).await else {
        panic!("a missing video node must be refused");
    };
    assert!(m.contains("too old for video"), "{m}");
    // The music node answers, but without its definition.
    let Err(EngineError::Failed(m)) = engine.validate(&plain_job("music")).await else {
        panic!("a music node without a definition must be refused");
    };
    assert!(m.contains("too old for ACE-Step"), "{m}");
}
