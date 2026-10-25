//! Looking up the license of models whose recorded source is not a plain Civitai or Hugging Face address: every oddly
//! shaped source falls back to the lookup by the file's hash, which the fake Civitai does not know. The addresses point
//! at a fake site on this PC.
mod fake_site;

use fake_site::site;
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, ProgressFn};
use novira_core::{Backend, BackendConfig, Settings};
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

fn lora(tag: usize) -> Vec<u8> {
    let header = serde_json::to_vec(&serde_json::json!({
        "__metadata__": {"tag": format!("license-source-{tag}")},
        "lora_te2_a.lora_up.weight": {"dtype": "F16", "shape": [1], "data_offsets": [0, 2]},
    }))
    .unwrap();
    let mut out = (header.len() as u64).to_le_bytes().to_vec();
    out.extend_from_slice(&header);
    out.extend_from_slice(&[0, 0]);
    out
}

#[tokio::test]
async fn sources_that_name_no_model_page_fall_back_to_the_hash_and_end_without_a_license() {
    site();
    let sources = [
        "civitai:",
        "civitai:not-a-number/1-2",
        "relative/path/model.safetensors",
        "https://example.com/files/model.safetensors",
        "https://huggingface.co/",
        "https://huggingface.co/only-an-owner",
        "https://huggingface.co//model.safetensors",
        "not a source at all",
    ];
    let dir = tempfile::tempdir().unwrap();
    let folder = dir.path().join("models").join("loras");
    std::fs::create_dir_all(&folder).unwrap();
    for i in 0..sources.len() {
        std::fs::write(folder.join(format!("src-{i}.safetensors")), lora(i)).unwrap();
    }
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
    for model in backend.bootstrap().models {
        let i: usize = model
            .path
            .rsplit("src-")
            .next()
            .and_then(|s| s.trim_end_matches(".safetensors").parse().ok())
            .unwrap();
        backend
            .update_model(&model.key, serde_json::json!({"source": sources[i]}))
            .unwrap();
    }
    backend.clone().fill_model_licenses().await;
    assert!(backend
        .bootstrap()
        .models
        .iter()
        .all(|m| m.license.is_none()));
    backend.shutdown();
}
