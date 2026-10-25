//! The model searches ask for compressed answers and read them. Its own test file: the fake site answers each path alike for
//! every test of a file, and this one sets a gzip answer for the search path.
mod fake_site;

use fake_site::{site, Route};
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, ProgressFn};
use novira_core::models::civitai::SearchParams;
use novira_core::{Backend, BackendConfig, Settings};
use serde_json::json;
use std::sync::Arc;
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

#[tokio::test]
async fn a_civitai_search_asks_for_compressed_answers_and_reads_them() {
    use std::io::Write;
    let dir = tempfile::tempdir().unwrap();
    site();
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
    let body = json!({
        "items": [{
            "id": 777, "name": "Zipped Style", "type": "LORA", "nsfw": false,
            "creator": {"username": "me"},
            "modelVersions": [{
                "id": 7771, "name": "v1", "baseModel": "Pony",
                "files": [{"id": 1, "name": "zipped.safetensors", "sizeKB": 2.0}]
            }]
        }],
        "metadata": {}
    });
    let mut gz = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
    gz.write_all(body.to_string().as_bytes()).unwrap();
    site().put(
        "/api/v1/models",
        Route::bytes(gz.finish().unwrap())
            .with_header("Content-Type", "application/json")
            .with_header("Content-Encoding", "gzip"),
    );
    let params = SearchParams {
        query: "zipped".into(),
        kind: "LoRA".into(),
        base_model: "Pony".into(),
        sort: "rating".into(),
        period: "all".into(),
        include_nsfw: false,
        cursor: None,
        source: "civitai".into(),
        licenses: Vec::new(),
        checkpoint_type: String::new(),
        safetensors_only: false,
        creator: String::new(),
    };
    let found = backend.search_civitai(params).await.unwrap();
    assert_eq!(found.items[0].name, "Zipped Style");
    let asked = site().requests("/api/v1/models");
    let sent = asked
        .iter()
        .rev()
        .find(|r| r.target.contains("query=zipped"))
        .unwrap();
    assert!(sent
        .accept_encoding
        .as_deref()
        .is_some_and(|e| e.contains("gzip")));
}
