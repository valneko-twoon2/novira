//! The Browse tab's two Civitai lookups through the backend: the example settings of a version and the check for newer
//! versions of the installed models. The address points at a loopback server (debug-only override).
mod fake_site;

use fake_site::{site, Route};
#[path = "key_cleanup/mod.rs"]
mod key_cleanup;
use key_cleanup::KeyCleanup;
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, ProgressFn};
use novira_core::types::*;
use novira_core::{Backend, BackendConfig, Settings};
use serde_json::json;
use std::path::Path;
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

type Events = Arc<Mutex<Vec<BackendEvent>>>;

fn open(dir: &Path) -> (Backend, Events) {
    site();
    let backend = Backend::open_with_engine(
        BackendConfig {
            data_dir: dir.to_path_buf(),
            image_url_base: "http://novira-image.localhost".into(),
            settings: Settings {
                gpu_lock: String::new(),
                ..Settings::default()
            },
        },
        Arc::new(NoEngine),
    )
    .unwrap();
    let events: Events = Arc::new(Mutex::new(Vec::new()));
    let sink = events.clone();
    backend.set_event_sink(Arc::new(move |e| sink.lock().unwrap().push(e)));
    (backend, events)
}

fn lora(tag: &str) -> Vec<u8> {
    let header = serde_json::to_vec(&json!({
        "__metadata__": {"tag": tag},
        "lora_te2_a.lora_up.weight": {"dtype": "F16", "shape": [1], "data_offsets": [0, 2]},
    }))
    .unwrap();
    let mut out = (header.len() as u64).to_le_bytes().to_vec();
    out.extend_from_slice(&header);
    out.extend_from_slice(&[0, 0]);
    out
}

async fn finish(events: &Events, id: &str) -> ModelInstallJob {
    for _ in 0..250 {
        let last = events.lock().unwrap().iter().rev().find_map(|e| match e {
            BackendEvent::ModelInstall { job } if job.id == id => Some(job.clone()),
            _ => None,
        });
        if let Some(j) = last {
            if matches!(
                j.status,
                ModelInstallStatus::Completed
                    | ModelInstallStatus::Error
                    | ModelInstallStatus::Cancelled
            ) {
                return j;
            }
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    panic!("install {id} did not finish");
}

/// One test, because the answer of a path is shared by everything in this binary that asks for it.
#[tokio::test]
async fn the_examples_and_the_newer_versions_come_through_the_backend_with_the_key() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path());
    let _keys = KeyCleanup::new(dir.path());
    backend
        .set_civitai_key(Some("civ-lookup-key".into()))
        .unwrap();
    let base = &site().base;

    // No Civitai model installed: nothing is asked.
    assert!(backend.check_model_updates().await.unwrap().is_empty());
    assert!(site().requests("/api/v1/models").is_empty());

    // The examples of a version, sent with the key; a bad id is refused.
    site().put_json(
        "/api/v1/images",
        &json!({"items": [{
            "id": 41, "type": "image", "url": "https://image.civitai.com/k/u/original=true/41.jpeg",
            "meta": {"prompt": "a lighthouse", "steps": 24, "Size": "1024x1024"}
        }]}),
    );
    let found = backend.civitai_samples("6601", false).await.unwrap();
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].prompt, "a lighthouse");
    assert!(site()
        .requests("/api/v1/images")
        .iter()
        .all(|r| r.authorization.as_deref() == Some("Bearer civ-lookup-key")));
    assert!(backend.civitai_samples("66x", false).await.is_err());

    // An installed Civitai model remembers its page; a newer version of its base model is reported, with the key.
    site().put_json(
        "/api/v1/model-versions/9701",
        &json!({
            "id": 9701, "modelId": 970, "baseModel": "SDXL 1.0",
            "model": {"type": "LORA"},
            "files": [{"id": 9, "name": "civ-update.safetensors", "primary": true, "sizeKB": 1.0,
                       "downloadUrl": format!("{base}/dl/civ-update.safetensors")}]
        }),
    );
    site().put(
        "/dl/civ-update.safetensors",
        Route::bytes(lora("civ-update")),
    );
    site().put_json("/api/v1/models/970", &json!({}));
    let job = backend.install_model("civitai:970/9701-9", None).unwrap();
    let done = finish(&events, &job.id).await;
    assert_eq!(done.status, ModelInstallStatus::Completed, "{done:?}");

    site().put_json(
        "/api/v1/models",
        &json!({"items": [{
            "id": 970, "name": "Update me",
            "modelVersions": [
                {"id": 9701, "name": "v1", "baseModel": "SDXL 1.0", "publishedAt": "2026-01-01T00:00:00.000Z", "availability": "Public"},
                {"id": 9702, "name": "v2", "baseModel": "SDXL 1.0", "publishedAt": "2026-02-01T00:00:00.000Z", "availability": "Public"},
            ]
        }]}),
    );
    let updates = backend.check_model_updates().await.unwrap();
    assert_eq!(updates.len(), 1);
    assert_eq!(updates[0].latest_version_id, "9702");
    assert_eq!(updates[0].installed_version_id, "9701");
    let asked = site().requests("/api/v1/models");
    assert_eq!(asked.len(), 1);
    assert_eq!(
        asked[0].authorization.as_deref(),
        Some("Bearer civ-lookup-key")
    );

    // Civitai refusing the request is an error, not an empty list.
    site().put("/api/v1/models", Route::status(500));
    assert!(backend.check_model_updates().await.is_err());
}
