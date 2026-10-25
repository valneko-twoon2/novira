//! Model store paths that the usual runs do not take: the background fill of covers and licenses when the app is closing
//! or a file is gone or the Civitai key is set, a hidden model that is installed again, and a folder scan that finds an
//! installed file under another path. The addresses point at a fake site on this PC.
mod fake_site;

use fake_site::{site, Route};
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, ProgressFn};
use novira_core::types::*;
use novira_core::{Backend, BackendConfig, Settings};
use sha2::{Digest, Sha256};
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

fn open_with(dir: &Path, model_roots: Vec<std::path::PathBuf>) -> (Backend, Events) {
    // Makes sure the fake site is up and every service points at it before the first request.
    site();
    let backend = Backend::open_with_engine(
        BackendConfig {
            data_dir: dir.to_path_buf(),
            image_url_base: "http://novira-image.localhost".into(),
            settings: Settings {
                gpu_lock: String::new(),
                model_roots,
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

/// A LoRA safetensors file; `tag` makes its bytes (and so its hash) unique to the test.
fn lora(tag: &str) -> Vec<u8> {
    let header = serde_json::to_vec(&serde_json::json!({
        "__metadata__": {"tag": tag},
        "lora_te2_a.lora_up.weight": {"dtype": "F16", "shape": [1], "data_offsets": [0, 2]},
    }))
    .unwrap();
    let mut out = (header.len() as u64).to_le_bytes().to_vec();
    out.extend_from_slice(&header);
    out.extend_from_slice(&[0, 0]);
    out
}

fn by_hash_path(bytes: &[u8]) -> String {
    let hash: String = Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    format!("/api/v1/model-versions/by-hash/{hash}")
}

/// A data folder holding one LoRA that has no cover and no license yet.
fn data_with_lora(tag: &str) -> (tempfile::TempDir, Vec<u8>, std::path::PathBuf) {
    let dir = tempfile::tempdir().unwrap();
    let folder = dir.path().join("models").join("loras");
    std::fs::create_dir_all(&folder).unwrap();
    let bytes = lora(tag);
    let file = folder.join(format!("{tag}.safetensors"));
    std::fs::write(&file, &bytes).unwrap();
    (dir, bytes, file)
}

#[tokio::test]
async fn the_cover_lookup_sends_the_civitai_key_and_stops_when_the_app_is_closing() {
    let (dir, bytes, _) = data_with_lora("odd-key");
    let path = by_hash_path(&bytes);
    let (backend, _) = open_with(dir.path(), vec![]);
    backend
        .set_civitai_key(Some("odd-key-secret".into()))
        .unwrap();
    site().put(&path, Route::status(404));
    backend.clone().fill_model_covers().await;
    let seen = site().requests(&path);
    assert_eq!(seen.len(), 1);
    assert_eq!(
        seen[0].authorization.as_deref(),
        Some("Bearer odd-key-secret")
    );

    // Closing the app stops both background fills before they ask anything.
    let (dir, bytes, _) = data_with_lora("odd-closing");
    let (backend, _) = open_with(dir.path(), vec![]);
    backend.shutdown();
    backend.clone().fill_model_covers().await;
    backend.clone().fill_model_licenses().await;
    assert!(site().requests(&by_hash_path(&bytes)).is_empty());
}

#[tokio::test]
async fn a_model_file_that_vanished_is_skipped_by_the_background_fills() {
    let (dir, bytes, file) = data_with_lora("odd-gone");
    let (backend, _) = open_with(dir.path(), vec![]);
    std::fs::remove_file(&file).unwrap();
    backend.clone().fill_model_covers().await;
    backend.clone().fill_model_licenses().await;
    assert!(site().requests(&by_hash_path(&bytes)).is_empty());
    let model = backend
        .bootstrap()
        .models
        .into_iter()
        .find(|m| m.path.ends_with("odd-gone.safetensors"))
        .unwrap();
    assert!(model.cover_image_url.is_none() && model.license.is_none());
}

#[tokio::test]
async fn a_hidden_model_comes_back_when_its_file_is_installed_again() {
    let dir = tempfile::tempdir().unwrap();
    let user_root = tempfile::tempdir().unwrap();
    let folder = user_root.path().join("Lora");
    std::fs::create_dir_all(&folder).unwrap();
    let user_file = folder.join("odd-hidden.safetensors");
    std::fs::write(&user_file, lora("odd-hidden")).unwrap();
    let (backend, events) = open_with(dir.path(), vec![user_root.path().to_path_buf()]);
    let mine = backend
        .bootstrap()
        .models
        .into_iter()
        .find(|m| m.path.ends_with("odd-hidden.safetensors"))
        .unwrap();
    // The user's own file is hidden, not deleted.
    backend.delete_model(&mine.key).unwrap();
    assert!(backend.bootstrap().models.iter().all(|m| m.key != mine.key));
    // Installing the same file brings novira's own copy, under the same key, so the model is no longer hidden.
    backend
        .install_model(&user_file.to_string_lossy(), None)
        .unwrap();
    for _ in 0..250 {
        if events
            .lock()
            .unwrap()
            .iter()
            .any(|e| matches!(e, BackendEvent::ModelAdded { .. }))
        {
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    let copy = backend
        .bootstrap()
        .models
        .into_iter()
        .find(|m| m.key == mine.key)
        .expect("the model is listed again");
    assert!(Path::new(&copy.path).starts_with(dir.path().join("models")));
    // The user's file now counts as installed: another path, same name and size.
    let scanned = backend
        .scan_folder(&folder.to_string_lossy())
        .await
        .unwrap();
    assert!(scanned.iter().all(|f| f.installed), "{scanned:?}");
}

async fn finished_job(events: &Events, id: &str) -> ModelInstallJob {
    for _ in 0..250 {
        let last = events.lock().unwrap().iter().rev().find_map(|e| match e {
            BackendEvent::ModelInstall { job } if job.id == id => Some(job.clone()),
            _ => None,
        });
        if let Some(job) = last {
            if matches!(
                job.status,
                ModelInstallStatus::Completed | ModelInstallStatus::Error
            ) {
                return job;
            }
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    panic!("the install did not end");
}

#[tokio::test]
async fn an_install_into_a_folder_that_cannot_be_made_fails_with_the_reason() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open_with(dir.path(), vec![]);
    // The LoRA folder is taken by a file.
    let loras = dir.path().join("models").join("loras");
    std::fs::remove_dir_all(&loras).unwrap();
    std::fs::write(&loras, b"a file").unwrap();
    // From a file on this PC ...
    let source = tempfile::tempdir().unwrap();
    let file = source.path().join("local-fail.safetensors");
    std::fs::write(&file, lora("local-fail")).unwrap();
    let job = backend
        .install_model(&file.to_string_lossy(), None)
        .unwrap();
    assert_eq!(
        finished_job(&events, &job.id).await.status,
        ModelInstallStatus::Error
    );
    // ... and from the fake site.
    site().put(
        "/files/remote-fail.safetensors",
        Route::bytes(lora("remote-fail")),
    );
    let url = format!("{}/files/remote-fail.safetensors", site().base);
    let job = backend.install_model(&url, None).unwrap();
    assert_eq!(
        finished_job(&events, &job.id).await.status,
        ModelInstallStatus::Error
    );
}

#[tokio::test]
async fn a_model_that_cannot_be_recorded_fails_its_install_and_a_starter_keeps_its_name() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open_with(dir.path(), vec![]);
    backend.shutdown();
    drop(backend);
    // The index of the model records is damaged (page 9 of the database file), so nothing can be recorded.
    {
        use std::io::{Seek, SeekFrom, Write};
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .open(dir.path().join("novira.sqlite"))
            .unwrap();
        file.seek(SeekFrom::Start(8 * 4096)).unwrap();
        file.write_all(&[0xff; 4096]).unwrap();
    }
    let (backend, events2) = open_with(dir.path(), vec![]);
    drop(events);
    let source = tempfile::tempdir().unwrap();
    let file = source.path().join("record-fail.safetensors");
    std::fs::write(&file, lora("record-fail")).unwrap();
    let job = backend
        .install_model(&file.to_string_lossy(), None)
        .unwrap();
    let ended = finished_job(&events2, &job.id).await;
    assert_eq!(ended.status, ModelInstallStatus::Error);
    // An install started from a starter model takes the starter's name.
    let starter = backend.list_starter_models().remove(0);
    let job = backend.install_model(&starter.source, None).unwrap();
    assert_eq!(job.name, starter.name);
    let _ = finished_job(&events2, &job.id).await;
    backend.shutdown();
}
