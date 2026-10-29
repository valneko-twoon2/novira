//! A finished model download that cannot be moved into place at once (a virus scanner holds the part file): the install
//! tries again, and when the file stays held it ends as an error that says why and leaves the part for the next try.
//! The pauses between tries are shortened (debug-only seam). Windows only.
#![cfg(windows)]
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, ProgressFn};
use novira_core::types::*;
use novira_core::{Backend, BackendConfig, Settings};
use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::os::windows::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};
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
    std::env::set_var("NOVIRA_TEST_RETRY_PAUSE_MS", "20");
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

fn lora() -> Vec<u8> {
    let header = serde_json::to_vec(&serde_json::json!({
        "lora_te2_a.lora_up.weight": {"dtype":"F16","shape":[1],"data_offsets":[0,2]}
    }))
    .unwrap();
    let mut out = (header.len() as u64).to_le_bytes().to_vec();
    out.extend_from_slice(&header);
    out.extend_from_slice(&[0, 0]);
    out
}

/// Serves `body` for every request on a free loopback port.
fn serve(body: Vec<u8>) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    std::thread::spawn(move || {
        for mut s in listener.incoming().flatten() {
            let body = body.clone();
            std::thread::spawn(move || {
                let mut buf = [0u8; 4096];
                let _ = s.read(&mut buf);
                let _ = write!(
                    s,
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                );
                let _ = s.write_all(&body);
            });
        }
    });
    format!("http://127.0.0.1:{port}")
}

/// Holds the part file as soon as it appears, for `how_long` (`None`: until the thread is dropped with the test).
fn hold_part(dir: PathBuf, how_long: Option<Duration>) -> std::thread::JoinHandle<bool> {
    std::thread::spawn(move || {
        let until = std::time::Instant::now() + Duration::from_secs(10);
        while std::time::Instant::now() < until {
            let part = std::fs::read_dir(dir.join("models/.downloads"))
                .into_iter()
                .flatten()
                .flatten()
                .map(|e| e.path())
                .find(|p| p.extension().is_some_and(|x| x == "part"));
            if let Some(part) = part {
                if let Ok(file) = OpenOptions::new().read(true).share_mode(3).open(&part) {
                    std::thread::sleep(how_long.unwrap_or(Duration::from_millis(600)));
                    drop(file);
                    return true;
                }
            }
            std::thread::sleep(Duration::from_micros(100));
        }
        false
    })
}

async fn finish(events: &Events, id: &str) -> ModelInstallJob {
    for _ in 0..500 {
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
    panic!("install did not finish");
}

#[tokio::test]
async fn a_part_that_is_held_for_a_moment_is_moved_in_when_it_is_free_again() {
    let dir = tempfile::tempdir().unwrap();
    let base = serve(lora());
    let (backend, events) = open(dir.path());
    // Held for about a tenth of the tries' total pause (8 tries of 20 ms and more): the move gets through.
    let holder = hold_part(dir.path().to_path_buf(), Some(Duration::from_millis(60)));
    let job = backend
        .install_model(&format!("{base}/held-a-moment.safetensors"), None)
        .unwrap();
    let done = finish(&events, &job.id).await;
    assert!(holder.join().unwrap(), "the part never appeared");
    assert_eq!(done.status, ModelInstallStatus::Completed, "{done:?}");
    assert!(dir
        .path()
        .join("models/loras/held-a-moment.safetensors")
        .is_file());
}

#[tokio::test]
async fn a_part_that_stays_held_fails_the_install_and_the_next_try_works_once_it_is_free() {
    let dir = tempfile::tempdir().unwrap();
    let base = serve(lora());
    let (backend, events) = open(dir.path());
    let holder = hold_part(dir.path().to_path_buf(), Some(Duration::from_secs(3)));
    let url = format!("{base}/held-for-good.safetensors");
    let job = backend.install_model(&url, None).unwrap();
    let done = finish(&events, &job.id).await;
    assert_eq!(done.status, ModelInstallStatus::Error, "{done:?}");
    assert!(!dir
        .path()
        .join("models/loras/held-for-good.safetensors")
        .exists());
    // Nothing is half-installed, and once the part is free the same install goes through.
    assert!(holder.join().unwrap());
    let again = backend.install_model(&url, None).unwrap();
    let done = finish(&events, &again.id).await;
    assert_eq!(done.status, ModelInstallStatus::Completed, "{done:?}");
    assert!(dir
        .path()
        .join("models/loras/held-for-good.safetensors")
        .is_file());
}
