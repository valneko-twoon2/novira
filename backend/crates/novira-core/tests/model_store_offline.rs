//! Background lookups and installs from Civitai and Hugging Face when the sites cannot be reached. A local proxy that
//! refuses every tunnel stands in for the network, so nothing leaves this PC.
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, ProgressFn};
use novira_core::types::*;
use novira_core::{Backend, BackendConfig, Settings};
use std::io::{Read, Write};
use std::net::TcpListener;
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

/// A proxy that answers every request with 502, so each HTTPS request fails at once.
fn refusing_proxy() -> String {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    std::thread::spawn(move || {
        for mut s in listener.incoming().flatten() {
            std::thread::spawn(move || {
                let mut buf = [0u8; 2048];
                let _ = s.read(&mut buf);
                let _ = s.write_all(
                    b"HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                );
            });
        }
    });
    format!("http://127.0.0.1:{port}")
}

#[tokio::test]
async fn unreachable_sites_stop_the_lookups_and_fail_the_installs() {
    // This file holds one test, so changing the environment cannot disturb another one.
    let proxy = refusing_proxy();
    std::env::set_var("HTTPS_PROXY", &proxy);
    std::env::set_var("https_proxy", &proxy);
    std::env::remove_var("NO_PROXY");
    std::env::remove_var("no_proxy");
    let dir = tempfile::tempdir().unwrap();
    let loras = dir.path().join("models/loras");
    std::fs::create_dir_all(&loras).unwrap();
    std::fs::write(loras.join("a.safetensors"), b"aaa").unwrap();
    std::fs::write(loras.join("b.safetensors"), b"bbb").unwrap();
    let backend = Backend::open_with_engine(
        BackendConfig {
            data_dir: dir.path().to_path_buf(),
            image_url_base: "http://novira-image.localhost".into(),
            settings: Settings {
                gpu_lock: String::new(),
                ..Settings::default()
            },
        },
        Arc::new(NoEngine),
    )
    .unwrap();
    let events: Arc<Mutex<Vec<BackendEvent>>> = Arc::new(Mutex::new(Vec::new()));
    let sink = events.clone();
    backend.set_event_sink(Arc::new(move |e| sink.lock().unwrap().push(e)));
    assert_eq!(backend.bootstrap().models.len(), 2);

    // Both background lookups give up at the first network failure and change nothing.
    tokio::time::timeout(Duration::from_secs(20), backend.clone().fill_model_covers())
        .await
        .expect("covers lookup stops");
    tokio::time::timeout(
        Duration::from_secs(20),
        backend.clone().fill_model_licenses(),
    )
    .await
    .expect("licenses lookup stops");
    assert!(backend
        .bootstrap()
        .models
        .iter()
        .all(|m| m.cover_image_url.is_none() && m.license.is_none()));

    // Installs that need a site's API fail with the reason.
    let sources = [
        "civitai:1/2-3",
        "https://civitai.com/models/5",
        "o/r::x.safetensors",
        "https://huggingface.co/o/r/resolve/main/y.safetensors",
    ];
    for source in sources {
        let job = backend.install_model(source, None).unwrap();
        let mut done = None;
        for _ in 0..500 {
            done = events.lock().unwrap().iter().rev().find_map(|e| match e {
                BackendEvent::ModelInstall { job: j }
                    if j.id == job.id && j.status == ModelInstallStatus::Error =>
                {
                    Some(j.clone())
                }
                _ => None,
            });
            if done.is_some() {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        let done = done.unwrap_or_else(|| panic!("{source} did not fail"));
        assert!(done.error.is_some(), "{source}");
    }
}
