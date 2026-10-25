//! Making a backup when the disk does not cooperate.
use super::common::*;
use std::sync::Arc;

#[tokio::test]
async fn a_backup_that_cannot_be_made_says_why() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    // A file where the working folder of the backup should go.
    std::fs::write(dir.path().join("cache"), b"not a folder").unwrap();
    let err = backend
        .create_backup("{}".into(), dir.path().join("out.zip"))
        .await
        .unwrap_err();
    assert!(
        matches!(err, novira_core::BackendError::Internal(_)),
        "{err}"
    );
    std::fs::remove_file(dir.path().join("cache")).unwrap();
    // A target in a folder that does not exist.
    let err = backend
        .create_backup("{}".into(), dir.path().join("missing").join("out.zip"))
        .await
        .unwrap_err();
    assert!(err.to_string().contains("cannot write the backup"), "{err}");
    backend.shutdown();
}

#[tokio::test]
async fn a_picture_whose_thumbnail_is_gone_is_backed_up_without_it() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    backend
        .upload_image(png(8, 8), novira_core::types::ImageOptions::default())
        .await
        .unwrap();
    // Remove every thumbnail file under the data folder.
    let mut stack = vec![dir.path().to_path_buf()];
    let mut removed = 0;
    while let Some(folder) = stack.pop() {
        for entry in std::fs::read_dir(&folder).unwrap().flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.extension().is_some_and(|e| e == "thumb") {
                std::fs::remove_file(path).unwrap();
                removed += 1;
            }
        }
    }
    assert_eq!(removed, 1);
    let target = dir.path().join("out.zip");
    backend
        .create_backup("{}".into(), target.clone())
        .await
        .unwrap();
    let archive = zip::ZipArchive::new(std::fs::File::open(&target).unwrap()).unwrap();
    let names: Vec<&str> = archive.file_names().collect();
    assert!(names.iter().any(|n| n.starts_with("outputs/")));
    assert!(!names.iter().any(|n| n.starts_with("thumbnails/")));
    backend.shutdown();
}
