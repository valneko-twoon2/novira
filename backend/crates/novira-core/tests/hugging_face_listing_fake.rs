//! Listing the model files of a Hugging Face repository for the install tab, against a fake site on this PC.
mod fake_site;

use fake_site::{site, Route};
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, ProgressFn};
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

fn open() -> (tempfile::TempDir, Backend) {
    let dir = tempfile::tempdir().unwrap();
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
    (dir, backend)
}

#[tokio::test]
async fn the_install_list_is_the_single_model_files_of_the_repository() {
    let site = site();
    site.put_json(
        "/api/models/listing-owner/turbo",
        &json!({ "siblings": [
            { "rfilename": "README.md" },
            { "rfilename": "turbo.safetensors" },
            { "rfilename": "unet/diffusion_pytorch_model.safetensors" },
            { "rfilename": "sub/lora.ckpt" },
        ] }),
    );
    let (_dir, backend) = open();
    let files = backend
        .hugging_face_files("listing-owner/turbo")
        .await
        .unwrap();
    assert_eq!(files, vec!["turbo.safetensors", "sub/lora.ckpt"]);
}

#[tokio::test]
async fn a_repository_that_does_not_exist_is_reported_by_name() {
    let site = site();
    site.put("/api/models/listing-owner/missing", Route::status(404));
    let (_dir, backend) = open();
    let err = backend
        .hugging_face_files("listing-owner/missing")
        .await
        .unwrap_err();
    assert!(err
        .to_string()
        .contains("No Hugging Face repository named listing-owner/missing"));
}

#[tokio::test]
async fn a_repository_that_needs_a_token_is_reported_the_same_way() {
    let site = site();
    site.put("/api/models/listing-owner/private", Route::status(401));
    let (_dir, backend) = open();
    let err = backend
        .hugging_face_files("listing-owner/private")
        .await
        .unwrap_err();
    assert!(err
        .to_string()
        .contains("No Hugging Face repository named listing-owner/private"));
}

#[tokio::test]
async fn an_address_that_is_not_a_repository_id_is_refused_before_any_request() {
    site();
    let (_dir, backend) = open();
    assert!(backend.hugging_face_files("not-a-repo").await.is_err());
    assert!(backend.hugging_face_files("owner/../x").await.is_err());
    assert!(backend.hugging_face_files("owner/a/b").await.is_err());
}

#[tokio::test]
async fn the_token_is_sent_when_one_is_set() {
    let site = site();
    site.put_json(
        "/api/models/listing-owner/gated",
        &json!({ "siblings": [{ "rfilename": "gated.safetensors" }] }),
    );
    let (_dir, backend) = open();
    backend
        .set_hf_token(Some("hf_listing_test".into()))
        .unwrap();
    backend
        .hugging_face_files("listing-owner/gated")
        .await
        .unwrap();
    let seen = site.requests("/api/models/listing-owner/gated");
    assert_eq!(
        seen.last().and_then(|s| s.authorization.as_deref()),
        Some("Bearer hf_listing_test")
    );
}
