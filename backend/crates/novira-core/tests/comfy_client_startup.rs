//! The engine starting the ComfyUI it owns when two jobs ask for it at the same moment, and when the install it manages
//! is already in place. A small fake server answers `system_stats` only once it is told to come up. Windows only (the
//! fake Python is a batch file).
#![cfg(windows)]
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use novira_core::comfy::install::comfyui_dir;
use novira_core::comfy::process::{ComfyProcess, OwnedProcessConfig};
use novira_core::comfy::ComfyEngine;
use novira_core::engine::{Engine, EngineStatus};
use serde_json::json;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio_util::sync::CancellationToken;

/// A server that is not ready until `up` is set; returns its port.
async fn not_ready_server() -> (u16, Arc<AtomicBool>) {
    let up = Arc::new(AtomicBool::new(false));
    let app = Router::new()
        .route(
            "/system_stats",
            get(|State(up): State<Arc<AtomicBool>>| async move {
                if up.load(Ordering::SeqCst) {
                    Json(json!({ "system": {} })).into_response()
                } else {
                    StatusCode::SERVICE_UNAVAILABLE.into_response()
                }
            }),
        )
        .with_state(up.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (port, up)
}

#[tokio::test]
async fn two_jobs_that_ask_for_the_engine_together_start_it_once() {
    let (port, up) = not_ready_server().await;
    let root = tempfile::tempdir().unwrap();
    // The install the engine manages is already in place, so nothing is downloaded.
    let comfy = comfyui_dir(root.path());
    std::fs::create_dir_all(&comfy).unwrap();
    std::fs::write(comfy.join("main.py"), b"").unwrap();
    let python = root.path().join("python.cmd");
    std::fs::write(&python, "@echo off\r\nping -n 20 127.0.0.1 >nul\r\n").unwrap();
    let process = ComfyProcess::new(OwnedProcessConfig {
        comfyui_dir: comfy,
        python: Some(python),
        host: "127.0.0.1".into(),
        port,
        extra_model_paths: root.path().join("extra.yaml"),
        extra_args: vec![],
        log_file: root.path().join("logs").join("comfyui.log"),
    });
    let engine = ComfyEngine::new(
        &format!("http://127.0.0.1:{port}"),
        Some(process),
        Duration::from_secs(10),
    )
    .unwrap()
    .with_installer(root.path().to_path_buf(), "nvidia".into());
    let late = tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(600)).await;
        up.store(true, Ordering::SeqCst);
    });
    let cancel = CancellationToken::new();
    // The second caller waits for the first one's start-up and finds the server answering when it gets its turn.
    let (first, second) = tokio::join!(engine.prepare(&cancel), engine.prepare(&cancel));
    late.await.unwrap();
    assert!(first.is_ok() && second.is_ok(), "{first:?} {second:?}");
    assert_eq!(engine.status(), EngineStatus::Ready);
    engine.shutdown();
}
