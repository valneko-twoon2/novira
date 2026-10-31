//! Deleting a model whose file another program has open: the model stays listed and the file stays. Windows only.
#![cfg(windows)]
#![allow(dead_code)]
#[path = "backend_service/common.rs"]
mod common;

use common::*;
use std::fs::OpenOptions;
use std::os::windows::fs::OpenOptionsExt;
use std::sync::Arc;

#[test]
fn a_model_whose_file_is_in_use_stays_listed_when_it_cannot_be_deleted() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let model = backend.bootstrap().models.remove(0);
    let held = OpenOptions::new()
        .read(true)
        .share_mode(3)
        .open(&model.path)
        .unwrap();
    assert!(backend.delete_model(&model.key).is_err());
    assert!(std::path::Path::new(&model.path).is_file());
    assert!(
        backend
            .bootstrap()
            .models
            .iter()
            .any(|m| m.key == model.key),
        "the model left the list with its file in place"
    );
    drop(held);
    backend.delete_model(&model.key).unwrap();
    assert!(!std::path::Path::new(&model.path).exists());
    assert!(backend
        .bootstrap()
        .models
        .iter()
        .all(|m| m.key != model.key));
    backend.shutdown();
}
