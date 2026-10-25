//! Model install, edit, delete and scan against a local HTTP server standing in for a download site.
//! Only loopback `http://` sources are used, so nothing leaves this PC.
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, ProgressFn};
use novira_core::types::*;
use novira_core::{Backend, BackendConfig, BackendError, Settings};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
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

/// A safetensors file with the given tensor names (and optional metadata).
fn safetensors(keys: &[&str], meta: Option<serde_json::Value>) -> Vec<u8> {
    let mut h = serde_json::Map::new();
    if let Some(m) = meta {
        h.insert("__metadata__".into(), m);
    }
    for k in keys {
        h.insert(
            (*k).into(),
            serde_json::json!({"dtype":"F16","shape":[1],"data_offsets":[0,2]}),
        );
    }
    let header = serde_json::to_vec(&h).unwrap();
    let mut out = (header.len() as u64).to_le_bytes().to_vec();
    out.extend_from_slice(&header);
    out.extend_from_slice(&[0, 0]);
    out
}

const NOT_FOUND: &[u8] =
    b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";

fn respond(mut s: TcpStream, files: &[(String, Vec<u8>)]) {
    let mut buf = [0u8; 4096];
    let n = s.read(&mut buf).unwrap_or(0);
    let head = String::from_utf8_lossy(&buf[..n]).to_string();
    let path = head
        .split_whitespace()
        .nth(1)
        .unwrap_or("/")
        .trim_start_matches('/')
        .to_string();
    if path.starts_with("locked") {
        let _ = s.write_all(
            b"HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
        );
    } else if path.starts_with("short") {
        let _ = s.write_all(
            b"HTTP/1.1 200 OK\r\nContent-Length: 100\r\nConnection: close\r\n\r\nonly a bit",
        );
    } else if path.starts_with("slow") {
        let _ = s.write_all(
            b"HTTP/1.1 200 OK\r\nContent-Length: 1000\r\nConnection: close\r\n\r\n0123456789",
        );
        let _ = s.flush();
        std::thread::sleep(Duration::from_secs(4));
    } else if let Some((_, body)) = files
        .iter()
        .find(|(n, _)| *n == path.split('?').next().unwrap_or(""))
    {
        let _ = write!(
            s,
            "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            body.len()
        );
        // Two pieces, so progress arrives more than once.
        let mid = body.len() / 2;
        let _ = s.write_all(&body[..mid]);
        let _ = s.flush();
        let _ = s.write_all(&body[mid..]);
    } else {
        let _ = s.write_all(NOT_FOUND);
    }
}

/// Serves `files` (by path) on a free loopback port; returns the base URL.
fn serve(files: Vec<(String, Vec<u8>)>) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let files = Arc::new(files);
    std::thread::spawn(move || {
        for s in listener.incoming().flatten() {
            let files = files.clone();
            std::thread::spawn(move || respond(s, &files));
        }
    });
    format!("http://127.0.0.1:{port}")
}

fn last_job(events: &Events, id: &str) -> Option<ModelInstallJob> {
    events.lock().unwrap().iter().rev().find_map(|e| match e {
        BackendEvent::ModelInstall { job } if job.id == id => Some(job.clone()),
        _ => None,
    })
}

async fn finish(events: &Events, id: &str) -> ModelInstallJob {
    for _ in 0..250 {
        if let Some(j) = last_job(events, id) {
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
    panic!("install did not finish: {:?}", last_job(events, id));
}

#[tokio::test]
async fn a_downloaded_lora_is_placed_classified_and_announced() {
    let dir = tempfile::tempdir().unwrap();
    let lora = safetensors(
        &["lora_te2_a.lora_up.weight"],
        Some(serde_json::json!({"modelspec.trigger_phrase": "zap, boom"})),
    );
    let base = serve(vec![("style.safetensors".into(), lora)]);
    let (backend, events) = open(dir.path());
    let job = backend
        .install_model(
            &format!("{base}/style.safetensors?x=1"),
            Some("Style".into()),
        )
        .unwrap();
    assert_eq!(job.name, "Style");
    let done = finish(&events, &job.id).await;
    assert_eq!(done.status, ModelInstallStatus::Completed, "{done:?}");
    assert!(done.total_bytes > 0);
    let placed = dir.path().join("models/loras/style.safetensors");
    assert!(placed.is_file());
    let model = backend
        .bootstrap()
        .models
        .into_iter()
        .find(|m| m.path.ends_with("style.safetensors"))
        .unwrap();
    assert_eq!((model.kind, model.base), (ModelType::Lora, BaseModel::Sdxl));
    assert_eq!(
        model.trigger_phrases,
        Some(vec!["zap".to_string(), "boom".to_string()])
    );
    assert!(events
        .lock()
        .unwrap()
        .iter()
        .any(|e| matches!(e, BackendEvent::ModelAdded { .. })));
    // Same file again: refused, and the partial download is cleaned up.
    let again = backend
        .install_model(&format!("{base}/style.safetensors"), None)
        .unwrap();
    let done = finish(&events, &again.id).await;
    assert_eq!(done.status, ModelInstallStatus::Error);
    assert!(done.error.unwrap().contains("already in the models folder"));
    let parts = std::fs::read_dir(dir.path().join("models/.downloads"))
        .map(|d| d.count())
        .unwrap_or(0);
    assert_eq!(parts, 0);
}

#[tokio::test]
async fn kind_comes_from_the_header_then_from_the_file_name() {
    let dir = tempfile::tempdir().unwrap();
    let base = serve(vec![
        (
            "ckpt.safetensors".into(),
            safetensors(&["model.diffusion_model.input_blocks.0.weight"], None),
        ),
        ("up.pth".into(), b"not a header at all".to_vec()),
        ("mystery.safetensors".into(), safetensors(&["zzz"], None)),
        ("notes.txt".into(), b"hello".to_vec()),
    ]);
    let (backend, events) = open(dir.path());
    let a = backend
        .install_model(&format!("{base}/ckpt.safetensors"), None)
        .unwrap();
    let b = backend
        .install_model(&format!("{base}/up.pth"), None)
        .unwrap();
    let c = backend
        .install_model(&format!("{base}/mystery.safetensors"), None)
        .unwrap();
    let d = backend
        .install_model(&format!("{base}/notes.txt"), None)
        .unwrap();
    assert_eq!(
        finish(&events, &a.id).await.status,
        ModelInstallStatus::Completed
    );
    assert_eq!(
        finish(&events, &b.id).await.status,
        ModelInstallStatus::Completed
    );
    let c = finish(&events, &c.id).await;
    assert_eq!(c.status, ModelInstallStatus::Error);
    assert!(c.error.unwrap().contains("Cannot tell"));
    let d = finish(&events, &d.id).await;
    assert!(d.error.unwrap().contains("Unsupported file"));
    assert!(dir
        .path()
        .join("models/checkpoints/ckpt.safetensors")
        .is_file());
    let models = backend.bootstrap().models;
    assert!(models
        .iter()
        .any(|m| m.path.ends_with("up.pth") && m.kind == ModelType::SpandrelImageToImage));
}

#[tokio::test]
async fn download_failures_are_reported_in_words() {
    let dir = tempfile::tempdir().unwrap();
    let base = serve(vec![]);
    let (backend, events) = open(dir.path());
    let mut ids = Vec::new();
    for name in [
        "missing.safetensors",
        "locked.safetensors",
        "short.safetensors",
    ] {
        ids.push(
            backend
                .install_model(&format!("{base}/{name}"), None)
                .unwrap()
                .id,
        );
    }
    let missing = finish(&events, &ids[0]).await.error.unwrap();
    assert!(missing.contains("404"), "{missing}");
    let locked = finish(&events, &ids[1]).await.error.unwrap();
    assert!(locked.contains("API key"), "{locked}");
    let short = finish(&events, &ids[2]).await.error.unwrap();
    assert!(
        short.contains("ended early") || short.contains("interrupted"),
        "{short}"
    );
    // A dead address.
    let dead = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = dead.local_addr().unwrap().port();
    drop(dead);
    let job = backend
        .install_model(&format!("http://127.0.0.1:{port}/a.safetensors"), None)
        .unwrap();
    let err = finish(&events, &job.id).await.error.unwrap();
    assert!(err.contains("Download failed"), "{err}");
}

#[tokio::test]
async fn a_running_download_can_be_cancelled() {
    let dir = tempfile::tempdir().unwrap();
    let base = serve(vec![]);
    let (backend, events) = open(dir.path());
    let job = backend
        .install_model(&format!("{base}/slow.safetensors"), None)
        .unwrap();
    for _ in 0..250 {
        if last_job(&events, &job.id).is_some_and(|j| j.status == ModelInstallStatus::Downloading) {
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    tokio::time::sleep(Duration::from_millis(200)).await;
    backend.cancel_install(&job.id);
    backend.cancel_install("no-such-job");
    let done = finish(&events, &job.id).await;
    assert_eq!(done.status, ModelInstallStatus::Cancelled);
    assert!(!dir.path().join("models/loras/slow.safetensors").exists());
}

#[tokio::test]
async fn local_installs_refuse_what_is_not_a_model() {
    let dir = tempfile::tempdir().unwrap();
    let src = tempfile::tempdir().unwrap();
    let text = src.path().join("a.txt");
    std::fs::write(&text, b"x").unwrap();
    let unknown = src.path().join("unknown.safetensors");
    std::fs::write(&unknown, safetensors(&["zzz"], None)).unwrap();
    let up = src.path().join("big.pth");
    std::fs::write(&up, b"weights").unwrap();
    let (backend, events) = open(dir.path());
    let a = backend
        .install_model(&text.to_string_lossy(), None)
        .unwrap();
    let b = backend
        .install_model(&unknown.to_string_lossy(), None)
        .unwrap();
    let c = backend.install_model(&up.to_string_lossy(), None).unwrap();
    assert!(finish(&events, &a.id)
        .await
        .error
        .unwrap()
        .contains("Not a model file"));
    assert!(finish(&events, &b.id)
        .await
        .error
        .unwrap()
        .contains("Cannot tell"));
    assert_eq!(
        finish(&events, &c.id).await.status,
        ModelInstallStatus::Completed
    );
    // The display name falls back to the last part of the source.
    assert_eq!(c.name, "big.pth");
    assert!(backend.install_model("", None).is_err());
    assert!(!backend.list_starter_models().is_empty());
}

#[tokio::test]
async fn model_records_can_be_edited_deleted_and_scanned() {
    let dir = tempfile::tempdir().unwrap();
    let models = dir.path().join("models/loras");
    std::fs::create_dir_all(&models).unwrap();
    std::fs::write(
        models.join("mine.safetensors"),
        safetensors(&["lora_te_x"], None),
    )
    .unwrap();
    let (backend, _events) = open(dir.path());
    let model = backend
        .bootstrap()
        .models
        .into_iter()
        .find(|m| m.path.ends_with("mine.safetensors"))
        .unwrap();
    assert!(matches!(
        backend.update_model(&model.key, serde_json::json!([1])),
        Err(BackendError::Invalid(_))
    ));
    assert!(matches!(
        backend.update_model("nope", serde_json::json!({})),
        Err(BackendError::NotFound(_))
    ));
    assert!(matches!(
        backend.update_model(&model.key, serde_json::json!({"name": 5})),
        Err(BackendError::Invalid(_))
    ));
    let updated = backend
        .update_model(
            &model.key,
            serde_json::json!({"name": "Renamed", "path": "elsewhere", "size": 1}),
        )
        .unwrap();
    assert_eq!(updated.name, "Renamed");
    assert_eq!(updated.path, model.path, "file facts cannot be edited");
    // Scanning marks the file as installed; a relative path is refused.
    let scanned = backend
        .scan_folder(&models.to_string_lossy())
        .await
        .unwrap();
    assert!(!scanned.is_empty() && scanned.iter().all(|f| f.installed));
    assert!(backend.scan_folder("relative/dir").await.is_err());
    // Deleting an unknown key is fine; a vanished file is an error.
    backend.delete_model("nope").unwrap();
    std::fs::remove_file(&model.path).unwrap();
    assert!(matches!(
        backend.delete_model(&model.key),
        Err(BackendError::Internal(_))
    ));
}
