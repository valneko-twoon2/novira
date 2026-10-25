//! Saving the Civitai key and the Hugging Face token when the secrets folder cannot be made.
use super::common::*;
use std::sync::Arc;

#[test]
fn keys_that_cannot_be_saved_are_refused_and_not_kept() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    // A file where the secrets folder should be.
    std::fs::write(dir.path().join("secrets"), b"not a folder").unwrap();
    assert!(backend.set_civitai_key(Some("civ-key".into())).is_err());
    assert!(!backend.has_civitai_key());
    assert!(backend.set_hf_token(Some("hf-token".into())).is_err());
    assert!(!backend.has_hf_token());
    backend.shutdown();
}
