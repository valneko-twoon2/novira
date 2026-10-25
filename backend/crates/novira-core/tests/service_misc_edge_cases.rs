//! Start-up and export failures of the service: unreadable saved keys, a models folder that cannot be made, an engine
//! that cannot prepare, and a picture that cannot be exported.
#![allow(dead_code)]
#[path = "backend_service/common.rs"]
mod common;

use common::*;
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, EngineStatus, ProgressFn};
use novira_core::media::export::{ExportFormat, ExportOptions};
use novira_core::media::images;
use novira_core::{Backend, BackendConfig, BackendError, Settings};
use std::sync::Arc;
use tokio_util::sync::CancellationToken;

/// An engine that cannot start: preparing and the node list both fail.
struct Broken;

#[async_trait::async_trait]
impl Engine for Broken {
    async fn generate(
        &self,
        _job: &EngineJob,
        _progress: ProgressFn<'_>,
        _cancel: &CancellationToken,
    ) -> Result<EngineOutput, EngineError> {
        Err(EngineError::Failed("no engine".into()))
    }

    async fn prepare(&self, _cancel: &CancellationToken) -> Result<(), EngineError> {
        Err(EngineError::Failed("cannot start".into()))
    }

    async fn node_defs(
        &self,
        _cancel: &CancellationToken,
    ) -> Result<serde_json::Value, EngineError> {
        Err(EngineError::Failed("cannot list nodes".into()))
    }

    fn status(&self) -> EngineStatus {
        EngineStatus::Error {
            message: "cannot start".into(),
        }
    }
}

fn config(dir: &std::path::Path, settings: Settings) -> BackendConfig {
    BackendConfig {
        data_dir: dir.to_path_buf(),
        image_url_base: BASE.into(),
        settings,
    }
}

#[tokio::test]
async fn an_engine_that_cannot_start_is_reported_without_stopping_the_app() {
    let dir = tempfile::tempdir().unwrap();
    let backend =
        Backend::open_with_engine(config(dir.path(), settings()), Arc::new(Broken)).unwrap();
    backend.prepare_engine().await;
    assert!(matches!(
        backend.engine_status(),
        EngineStatus::Error { .. }
    ));
    let Err(BackendError::Internal(m)) = backend.node_defs().await else {
        panic!("a failing engine gives an internal error")
    };
    assert!(m.contains("cannot list nodes"), "{m}");
}

#[tokio::test]
async fn an_engine_without_node_definitions_gives_an_empty_list() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    backend.prepare_engine().await;
    assert_eq!(backend.engine_status(), EngineStatus::Ready);
    assert_eq!(backend.node_defs().await.unwrap(), serde_json::json!({}));
}

#[test]
fn saved_keys_that_cannot_be_read_are_skipped_and_the_settings_key_is_used() {
    let dir = tempfile::tempdir().unwrap();
    let secrets = dir.path().join("secrets");
    std::fs::create_dir_all(&secrets).unwrap();
    // Not something this PC's encryption wrote.
    std::fs::write(
        secrets.join("civitai.key"),
        b"garbage that is not encrypted",
    )
    .unwrap();
    std::fs::write(
        secrets.join("huggingface.key"),
        b"garbage that is not encrypted",
    )
    .unwrap();
    let settings = Settings {
        civitai_api_key: Some("from-settings".into()),
        ..settings()
    };
    let backend = Backend::open_with_engine(
        config(dir.path(), settings),
        Arc::new(FakeEngine::default()),
    )
    .unwrap();
    // The app still starts.
    assert!(backend.bootstrap().models.is_empty());
}

#[test]
fn a_models_folder_that_cannot_be_made_stops_the_start_with_an_error() {
    let dir = tempfile::tempdir().unwrap();
    // A file where the models folder should be.
    std::fs::write(dir.path().join("models"), b"not a folder").unwrap();
    let result = Backend::open_with_engine(
        config(dir.path(), settings()),
        Arc::new(FakeEngine::default()),
    );
    assert!(matches!(result, Err(BackendError::Internal(_))));
}

#[tokio::test]
async fn a_stored_picture_that_is_not_a_picture_cannot_be_exported() {
    let dir = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let name = images::new_name();
    std::fs::write(
        dir.path().join("outputs").join(&name),
        b"this is not a picture",
    )
    .unwrap();
    let options = ExportOptions {
        format: ExportFormat::Png,
        quality: 90,
        max_side: None,
        remove_info: true,
        watermark: false,
    };
    let err = backend
        .export_images(vec![name.clone()], options, out.path().to_path_buf())
        .await
        .unwrap_err();
    assert!(
        matches!(&err, BackendError::Invalid(m) if m.contains(&name)),
        "{err}"
    );
    assert_eq!(std::fs::read_dir(out.path()).unwrap().count(), 0);
}

#[tokio::test]
async fn pictures_that_are_missing_from_the_gallery_are_skipped_and_counted() {
    let dir = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let options = ExportOptions {
        format: ExportFormat::Png,
        quality: 90,
        max_side: None,
        remove_info: false,
        watermark: false,
    };
    let result = backend
        .export_images(vec![images::new_name()], options, out.path().to_path_buf())
        .await
        .unwrap();
    assert_eq!((result.count, result.skipped), (0, 1));
}
