//! The desktop app's download: the originals are copied as they are into the folder the user chose, never overwriting
//! a file there; bad requests are refused before anything is written.
use super::common::*;
use novira_core::types::*;
use novira_core::BackendError;
use std::sync::Arc;

// tags: scenario, condition
#[tokio::test]
async fn the_originals_are_copied_byte_for_byte_and_never_overwrite() {
    let dir = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    // An uploaded PNG is kept byte for byte, so the original is the uploaded bytes.
    let original = png(16, 16);
    let image = backend
        .upload_image(original.clone(), ImageOptions::default())
        .await
        .unwrap();
    let names = vec![image.name.clone(), "missing.png".to_string()];
    let result = backend
        .save_originals(names.clone(), out.path().to_path_buf())
        .await
        .unwrap();
    assert_eq!(
        (result.count, result.skipped, result.watermarked),
        (1, 1, 0)
    );
    assert_eq!(result.folder, out.path().display().to_string());
    assert_eq!(
        std::fs::read(out.path().join(&image.name)).unwrap(),
        original
    );
    // A second download keeps the first file and adds "-2".
    backend
        .save_originals(names, out.path().to_path_buf())
        .await
        .unwrap();
    let stem = image.name.rsplit_once('.').unwrap().0;
    assert_eq!(
        std::fs::read(out.path().join(format!("{stem}-2.png"))).unwrap(),
        original
    );
    assert_eq!(std::fs::read_dir(out.path()).unwrap().count(), 2);
    backend.shutdown();
}

// tags: error-guessing, boundary
#[tokio::test]
async fn no_names_bad_names_and_a_missing_folder_are_refused_before_writing() {
    let dir = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    for names in [
        vec![],
        vec!["../a.png".to_string()],
        vec!["a.exe".to_string()],
    ] {
        assert!(backend.check_save(&names).is_err(), "{names:?}");
        let err = backend
            .save_originals(names, out.path().to_path_buf())
            .await
            .unwrap_err();
        assert!(matches!(err, BackendError::Invalid(_)), "{err}");
    }
    let too_many = vec!["a.png".to_string(); novira_core::media::export::MAX_NAMES + 1];
    assert!(backend.check_save(&too_many).is_err());
    assert!(backend.check_save(&["a.png".to_string()]).is_ok());
    let err = backend
        .save_originals(vec!["a.png".into()], out.path().join("gone"))
        .await
        .unwrap_err();
    assert!(err.to_string().contains("does not exist"), "{err}");
    assert_eq!(std::fs::read_dir(out.path()).unwrap().count(), 0);
    backend.shutdown();
}
