//! Installing a node pack through the backend service: the job runs in the background, ends as `ready`, and asks for a
//! ComfyUI restart. The archive comes from a fake GitHub and `python` is a batch file that fakes the unzip,
//! so nothing needs the network or Python. Windows only.
#![cfg(windows)]
mod fake_site;

use fake_site::{site, Route};
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, ProgressFn};
use novira_core::packs::PackStatus;
use novira_core::types::BackendEvent;
use novira_core::{Backend, BackendConfig, Settings};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio_util::sync::CancellationToken;

struct NoEngine;

#[async_trait::async_trait]
impl Engine for NoEngine {
    async fn generate(
        &self,
        _job: &EngineJob,
        _progress: ProgressFn<'_>,
        _cancel: &CancellationToken,
    ) -> Result<EngineOutput, EngineError> {
        Err(EngineError::Failed("no engine in this test".into()))
    }
}

/// A `python` that fakes `-m zipfile -e`: the archive holds one top folder with one file.
const FAKE_PYTHON: &str = r#"@echo off
setlocal EnableDelayedExpansion
if "%~2"=="zipfile" goto unzip
exit /b 9
:unzip
set "OUT=%~5"
mkdir "!OUT!"
mkdir "!OUT!\pack-abc"
echo code> "!OUT!\pack-abc\nodes.py"
exit /b 0
"#;

#[tokio::test]
async fn a_pack_installed_through_the_service_ends_ready_and_asks_for_a_restart() {
    site();
    let dir = tempfile::tempdir().unwrap();
    let comfy = dir.path().join("comfy");
    std::fs::create_dir_all(&comfy).unwrap();
    let python = dir.path().join("python.cmd");
    std::fs::write(&python, FAKE_PYTHON).unwrap();
    site().put("/owner/np-service/zip/HEAD", Route::bytes("plain"));

    let voice = Arc::new(novira_core::voice::QwenVoice::new(
        dir.path().to_path_buf(),
        dir.path().join("models"),
        Some(python.clone()),
        Some(comfy.clone()),
    ));
    let backend = Backend::open_with_engines(
        BackendConfig {
            data_dir: dir.path().to_path_buf(),
            image_url_base: "http://novira-image.localhost".into(),
            settings: Settings {
                gpu_lock: String::new(),
                ..Settings::default()
            },
        },
        Arc::new(NoEngine),
        voice,
        (Some(python), Some(comfy)),
    )
    .unwrap();
    let events: Arc<Mutex<Vec<BackendEvent>>> = Arc::default();
    let sink = events.clone();
    backend.set_event_sink(Arc::new(move |e| sink.lock().unwrap().push(e)));

    assert!(!backend.node_packs().restart_needed);
    backend
        .install_node_pack("https://github.com/owner/np-service", None)
        .await
        .unwrap();
    for _ in 0..250 {
        let ready = events.lock().unwrap().iter().any(|e| {
            matches!(
                e,
                BackendEvent::NodePack {
                    status: PackStatus::Ready,
                    ..
                }
            )
        });
        if ready {
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    let packs = backend.node_packs();
    assert!(packs.restart_needed);
    assert!(packs.installed.iter().any(|p| p.folder == "np-service"));
    backend.shutdown();
}
