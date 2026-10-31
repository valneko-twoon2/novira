//! Small refusals of the model, extension-pack and share calls: an unknown model, a version that is no tag, an engine
//! that cannot change version, a WebP export, a folder that cannot take a copy and a file over the size limit.
use super::common::*;
use novira_core::media::export::{ExportFormat, ExportOptions};
use novira_core::types::*;
use novira_core::BackendError;
use std::sync::Arc;

#[tokio::test]
async fn unknown_models_bad_tags_and_an_engine_that_was_not_installed_here_are_refused() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert!(matches!(
        backend.model_parts("no-such-model"),
        Err(BackendError::NotFound(_))
    ));
    let err = backend
        .install_node_pack("https://github.com/someone/pack", Some("v1; rm -rf"))
        .await
        .unwrap_err();
    assert!(matches!(err, BackendError::Invalid(_)), "{err}");
    assert!(err.to_string().contains("Not a version tag"), "{err}");
    // A good tag reaches the engine, which was not installed by novira here.
    let err = backend.switch_comfy_version("v0.3.0").await.unwrap_err();
    assert!(matches!(err, BackendError::Internal(_)), "{err}");
    assert!(err.to_string().contains("not installed by novira"), "{err}");
    backend.shutdown();
}

fn webp() -> ExportOptions {
    ExportOptions {
        format: ExportFormat::Webp,
        quality: 80,
        max_side: None,
        remove_info: true,
        watermark: false,
    }
}

#[tokio::test]
async fn a_picture_is_exported_as_webp() {
    let dir = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let image = backend
        .upload_image(png(16, 16), ImageOptions::default())
        .await
        .unwrap();
    let result = backend
        .export_images(vec![image.name.clone()], webp(), out.path().to_path_buf())
        .await
        .unwrap();
    assert_eq!(result.count, 1);
    let stem = image.name.rsplit_once('.').unwrap().0;
    let bytes = std::fs::read(out.path().join(format!("{stem}.webp"))).unwrap();
    assert_eq!(&bytes[..4], b"RIFF");
    assert_eq!(&bytes[8..12], b"WEBP");
    backend.shutdown();
}

#[cfg(windows)]
#[tokio::test]
async fn a_copy_that_cannot_be_written_into_the_folder_says_so() {
    let dir = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let image = backend
        .upload_image(png(16, 16), ImageOptions::default())
        .await
        .unwrap();
    // A folder where the copy's file should be: the file cannot be created there.
    let stem = image.name.rsplit_once('.').unwrap().0;
    std::fs::create_dir(out.path().join(format!("{stem}.webp"))).unwrap();
    let err = backend
        .export_images(vec![image.name.clone()], webp(), out.path().to_path_buf())
        .await
        .unwrap_err();
    assert!(
        err.to_string().contains("cannot write into the folder"),
        "{err}"
    );
    backend.shutdown();
}

#[tokio::test]
async fn a_file_over_the_size_limit_is_refused_before_it_is_read() {
    let dir = tempfile::tempdir().unwrap();
    let big = dir.path().join("big.png");
    let file = std::fs::File::create(&big).unwrap();
    file.set_len(novira_core::media::images::MAX_IMAGE_BYTES as u64 + 1)
        .unwrap();
    drop(file);
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let err = backend.check_watermark_file(big).await.unwrap_err();
    assert!(err.to_string().contains("too large"), "{err}");
    backend.shutdown();
}
