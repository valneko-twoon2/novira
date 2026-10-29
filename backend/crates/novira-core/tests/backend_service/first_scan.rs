//! The one-time corrections of the first model scan after an upgrade, and the engine calls that pass through the service.
use super::common::*;
use novira_core::db::DB_FILE;
use novira_core::engine::{Engine, EngineError};
use novira_core::types::*;
use serde_json::{json, Value};
use std::path::Path;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;

fn safetensors(path: &Path, tensors: &[&str]) {
    let mut header = serde_json::Map::new();
    for t in tensors {
        header.insert(
            t.to_string(),
            json!({"dtype": "F16", "shape": [1], "data_offsets": [0, 2]}),
        );
    }
    let json = serde_json::to_vec(&header).unwrap();
    let mut bytes = (json.len() as u64).to_le_bytes().to_vec();
    bytes.extend(json);
    bytes.extend([0u8; 2]);
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, bytes).unwrap();
}

/// Rewrites every stored model record the way an older version would have left it.
fn age_records(dir: &Path, edit: impl Fn(&mut Value)) {
    // The first-scan marks live in `meta`, which `Db` can set but not remove; this one fixed statement removes them.
    rusqlite::Connection::open(dir.join(DB_FILE))
        .unwrap()
        .execute("DELETE FROM meta", [])
        .unwrap();
    let db = novira_core::db::Db::open(dir).unwrap();
    let rows: Vec<Value> = db.load(novira_core::db::Table::Models).unwrap();
    for mut v in rows {
        edit(&mut v);
        let key = v["key"].as_str().unwrap().to_string();
        db.put(novira_core::db::Table::Models, &key, 0, &v).unwrap();
    }
}

fn model(b: &novira_core::Backend, part: &str) -> ModelConfig {
    b.bootstrap()
        .models
        .into_iter()
        .find(|m| m.path.contains(part))
        .unwrap_or_else(|| panic!("{part} is listed"))
}

#[tokio::test]
async fn records_an_older_version_stored_wrongly_are_corrected_on_the_first_scan() {
    let dir = tempfile::tempdir().unwrap();
    let m = dir.path().join("models");
    safetensors(
        &m.join("loras/wan-style.safetensors"),
        &["diffusion_model.blocks.0.self_attn.q.lora_A.weight"],
    );
    std::fs::create_dir_all(m.join("diffusion_models")).unwrap();
    std::fs::write(m.join("diffusion_models/wan-q4.gguf"), b"GGUF").unwrap();
    write_lora_and_checkpoint(&m);
    {
        let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
        assert_eq!(model(&backend, "wan-style").base, BaseModel::Wan);
        assert_eq!(model(&backend, "wan-q4").base, BaseModel::Wan);
        backend.shutdown();
    }
    age_records(dir.path(), |v| {
        let path = v["path"].as_str().unwrap().to_string();
        if path.contains("wan-style") {
            v["base"] = json!("sd-1");
        } else if path.contains("wan-q4") {
            v["base"] = json!("any");
        } else if path.contains("sdxl_base") {
            v["license"] = json!({
                "site": "civitai", "commercial": "denied",
                "permissions": [
                    {"key": "sellImages", "allowed": true},
                    {"key": "generationServices", "allowed": true},
                    {"key": "sellModel", "allowed": true}
                ]
            });
        }
    });
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert_eq!(model(&backend, "wan-style").base, BaseModel::Wan);
    assert_eq!(model(&backend, "wan-q4").base, BaseModel::Wan);
    let license = model(&backend, "sdxl_base").license.unwrap();
    assert_eq!(license.commercial, "allowed");
    backend.shutdown();
}

/// An engine whose ComfyUI cannot be reached for the screen words.
struct Unreachable;

#[async_trait::async_trait]
impl Engine for Unreachable {
    async fn generate(
        &self,
        _job: &novira_core::engine::EngineJob,
        _progress: novira_core::engine::ProgressFn<'_>,
        _cancel: &CancellationToken,
    ) -> Result<novira_core::engine::EngineOutput, EngineError> {
        Err(EngineError::Cancelled)
    }

    async fn ui_locale(
        &self,
        _cancel: &CancellationToken,
        _locale: &str,
    ) -> Result<Option<novira_core::comfy::ui_locale::ComfyUiLocale>, EngineError> {
        Err(EngineError::Failed("ComfyUI is not running".into()))
    }
}

#[tokio::test]
async fn the_engines_screen_words_pass_through_the_service_and_open_is_timed() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    // The fake engine has no translation for any language.
    assert!(backend.comfy_ui_locale("ja").await.unwrap().is_none());
    let timings = backend.open_timings();
    assert!(!timings.phases.is_empty());
    assert!(timings.total() >= timings.phases[0].1);
    backend.shutdown();

    let other = tempfile::tempdir().unwrap();
    let backend = novira_core::Backend::open_with_engine(
        novira_core::BackendConfig {
            data_dir: other.path().to_path_buf(),
            image_url_base: BASE.into(),
            settings: settings(),
        },
        Arc::new(Unreachable),
    )
    .unwrap();
    let err = backend.comfy_ui_locale("ja").await.unwrap_err();
    assert!(err.to_string().contains("ComfyUI is not running"), "{err}");
    backend.shutdown();
}
