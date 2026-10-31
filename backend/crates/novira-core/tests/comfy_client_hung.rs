//! `ComfyEngine` against a ComfyUI that stops answering in the middle of a job (it hangs, as a process that is stuck or
//! that a debugger stopped does): cancelling the job must still end it, and a ComfyUI that dies mid-job must fail the
//! job with words, not hold the queue.
use axum::extract::Path;
use axum::routing::{get, post};
use axum::{Json, Router};
use novira_core::comfy::ComfyEngine;
use novira_core::engine::{Engine, EngineError, EngineJob, JobGuidance};
use novira_core::types::{ComfyRef, GenerationMetadata};
use serde_json::json;
use std::time::Duration;
use tokio_util::sync::CancellationToken;

async fn serve_hanging() -> String {
    let app = Router::new()
        .route(
            "/system_stats",
            get(|| async { Json(json!({ "system": {} })) }),
        )
        .route(
            "/models/{folder}",
            get(|| async { Json(json!(["base.safetensors"])) }),
        )
        .route("/object_info", get(|| async { Json(json!({})) }))
        .route(
            "/prompt",
            post(|| async { Json(json!({ "prompt_id": "p1", "node_errors": {} })) }),
        )
        // The job is accepted, then ComfyUI never answers about it again.
        .route(
            "/history/{id}",
            get(|Path(_): Path<String>| async {
                std::future::pending::<Json<serde_json::Value>>().await
            }),
        )
        .route(
            "/interrupt",
            post(|| async { std::future::pending::<()>().await }),
        );
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
        graph: None,
        guidance: JobGuidance::default(),
    }
}

#[tokio::test]
async fn cancelling_a_job_ends_it_even_when_comfyui_has_stopped_answering() {
    let url = serve_hanging().await;
    let engine = ComfyEngine::new(&url, None, Duration::from_secs(1)).unwrap();
    let cancel = CancellationToken::new();
    let stop = cancel.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(500)).await;
        stop.cancel();
    });
    let result = tokio::time::timeout(
        Duration::from_secs(10),
        engine.generate(&job(), &|_| {}, &cancel),
    )
    .await
    .expect("the cancelled job never ended: the queue would be stuck behind it");
    assert!(matches!(result, Err(EngineError::Cancelled)), "{result:?}");
}

/// A ComfyUI that takes a job and then goes away: after `/prompt` it stops accepting connections.
fn serve_then_die() -> String {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    std::thread::spawn(move || {
        for mut s in listener.incoming().flatten() {
            let mut buf = [0u8; 8192];
            let n = s.read(&mut buf).unwrap_or(0);
            let head = String::from_utf8_lossy(&buf[..n]).to_string();
            let path = head.split_whitespace().nth(1).unwrap_or("/").to_string();
            let body = if path.starts_with("/models/") {
                r#"["base.safetensors"]"#
            } else if path.starts_with("/prompt") {
                r#"{"prompt_id":"p1","node_errors":{}}"#
            } else if path.starts_with("/system_stats") {
                r#"{"system":{}}"#
            } else {
                "{}"
            };
            let _ = write!(
                s,
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            if path.starts_with("/prompt") {
                return; // the listener is dropped with this thread
            }
        }
    });
    url
}

#[tokio::test]
async fn a_comfyui_that_dies_in_the_middle_of_a_job_fails_it_with_words() {
    let url = serve_then_die();
    let engine = ComfyEngine::new(&url, None, Duration::from_secs(1)).unwrap();
    let result = tokio::time::timeout(
        Duration::from_secs(20),
        engine.generate(&job(), &|_| {}, &CancellationToken::new()),
    )
    .await
    .expect("the job of a ComfyUI that has died never ended");
    match result {
        Err(EngineError::Failed(m)) => {
            assert!(
                m.contains("stopped answering") && m.contains("comfyui.log"),
                "{m}"
            );
        }
        other => panic!("expected a failure, got {other:?}"),
    }
}
