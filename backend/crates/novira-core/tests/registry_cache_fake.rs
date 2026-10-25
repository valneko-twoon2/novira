//! The extension registry (one test: the fake site and its `/nodes` route are shared) through the backend service, against a fake `api.comfy.org`: the list is kept on disk,
//! a fresh disk copy is used without asking the site, and an old one is shown at once while a background read freshens it.
mod fake_site;

use fake_site::site;
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, ProgressFn};
use novira_core::{Backend, BackendConfig, Settings};
use std::path::Path;
use std::sync::Arc;
use std::time::{Duration, SystemTime};
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

fn open(dir: &Path) -> Backend {
    let voice = Arc::new(novira_core::voice::QwenVoice::new(
        dir.to_path_buf(),
        dir.join("models"),
        None,
        None,
    ));
    Backend::open_with_engines(
        BackendConfig {
            data_dir: dir.to_path_buf(),
            image_url_base: "http://novira-image.localhost".into(),
            settings: Settings {
                gpu_lock: String::new(),
                ..Settings::default()
            },
        },
        Arc::new(NoEngine),
        voice,
        (None, None),
    )
    .unwrap()
}

fn answer(name: &str) {
    site().put_json(
        "/nodes",
        &serde_json::json!({"totalPages": 1, "nodes": [
            {"id": name, "name": name, "status": "NodeStatusActive", "repository": format!("https://github.com/ow/{name}"), "downloads": 5}
        ]}),
    );
}

fn first_name(list: &[novira_core::comfy::registry::RegistryNode]) -> &str {
    list.first().map(|n| n.id.as_str()).unwrap_or("")
}

#[tokio::test]
async fn the_registry_list_survives_a_restart_and_is_freshened_in_the_background() {
    site();
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("cache").join("registry-nodes.json");
    let reads = || site().requests("/nodes").len();

    // The first read asks the site and leaves a copy on disk.
    answer("first");
    let list = open(dir.path()).registry_nodes(false).await.unwrap();
    assert_eq!(first_name(&list), "first");
    assert_eq!(reads(), 1);
    assert!(file.exists());

    // A new start (nothing in memory) takes the fresh copy without asking the site.
    answer("second");
    let list = open(dir.path()).registry_nodes(false).await.unwrap();
    assert_eq!(first_name(&list), "first");
    assert_eq!(reads(), 1);

    // A copy older than an hour is shown as it is at once, and the site is read in the background.
    let old = SystemTime::now() - Duration::from_secs(2 * 3600);
    std::fs::File::options()
        .write(true)
        .open(&file)
        .unwrap()
        .set_modified(old)
        .unwrap();
    let backend = open(dir.path());
    let list = backend.registry_nodes(false).await.unwrap();
    assert_eq!(first_name(&list), "first");
    for _ in 0..100 {
        if reads() >= 2 {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    assert_eq!(reads(), 2);
    // The freshened list is what the next call (and the next start) gets.
    let mut seen = String::new();
    for _ in 0..100 {
        seen = first_name(&backend.registry_nodes(false).await.unwrap()).to_string();
        if seen == "second" {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    assert_eq!(seen, "second");
    assert_eq!(reads(), 2);

    // `refresh` always reads the site and waits for it.
    answer("third");
    let list = backend.registry_nodes(true).await.unwrap();
    assert_eq!(first_name(&list), "third");
    assert_eq!(reads(), 3);

    // With no copy at all, a failed read is an error.
    let empty = tempfile::tempdir().unwrap();
    site().put("/nodes", fake_site::Route::status(500));
    let err = open(empty.path()).registry_nodes(false).await.unwrap_err();
    assert!(err.to_string().contains("registry"), "{err}");
}
