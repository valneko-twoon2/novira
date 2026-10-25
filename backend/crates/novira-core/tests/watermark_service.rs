//! Export with the watermark switch and "check a picture" through the service, without the watermark's files: the
//! export refuses before writing anything, and a check still reads the XMP label and the content credentials
//!. The watermark itself is exercised by `watermark_live.rs`.
#![allow(dead_code)]
#[path = "backend_service/common.rs"]
mod common;

use common::*;
use novira_core::media::export::{ExportFormat, ExportOptions};
use novira_core::provenance::{self, credentials::Identity};
use novira_core::types::*;
use novira_core::BackendError;
use std::sync::Arc;

fn options(watermark: bool) -> ExportOptions {
    ExportOptions {
        format: ExportFormat::Png,
        quality: 90,
        max_side: None,
        remove_info: true,
        watermark,
    }
}

#[tokio::test]
async fn an_export_with_the_watermark_is_refused_until_its_files_are_here() {
    let dir = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let image = backend
        .upload_image(png(32, 32), ImageOptions::default())
        .await
        .unwrap();
    let names = vec![image.name.clone()];
    let err = backend.check_export(&names, &options(true)).unwrap_err();
    assert!(
        matches!(&err, BackendError::Invalid(m) if m.contains("not ready")),
        "{err}"
    );
    assert!(backend
        .export_images(names.clone(), options(true), out.path().to_path_buf())
        .await
        .is_err());
    assert_eq!(std::fs::read_dir(out.path()).unwrap().count(), 0);
    // Without the switch the same export works and nothing is counted as watermarked.
    let done = backend
        .export_images(names, options(false), out.path().to_path_buf())
        .await
        .unwrap();
    assert_eq!((done.count, done.watermarked), (1, 0));
}

#[tokio::test]
async fn a_plain_gallery_picture_shows_no_marks() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let image = backend
        .upload_image(png(32, 32), ImageOptions::default())
        .await
        .unwrap();
    let check = backend
        .check_watermark_image(image.name.clone())
        .await
        .unwrap();
    assert_eq!(check.file_name, image.name);
    assert!(!check.watermark_checked, "the watermark files are not here");
    assert!(!check.watermark_found && !check.novira_marker && check.watermark_id.is_none());
    assert!(!check.credentials_present && !check.iptc_ai);
    assert_eq!(check.original_name, None);
}

#[tokio::test]
async fn a_labelled_file_shows_its_credentials_and_ai_label() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let someone = Identity::generate().unwrap();
    let labelled =
        provenance::label(&png(48, 32), image::ImageFormat::Png, &someone, Some(7)).unwrap();
    let file = dir.path().join("shared copy.png");
    std::fs::write(&file, &labelled).unwrap();
    let check = backend.check_watermark_file(file).await.unwrap();
    assert_eq!(check.file_name, "shared copy.png");
    assert!(check.credentials_present && check.credentials_valid && check.credentials_ai);
    assert!(!check.credentials_trusted);
    assert!(
        !check.credentials_this_app,
        "signed by another installation"
    );
    assert_eq!(check.credentials_signer.as_deref(), Some("novira"));
    assert!(check.iptc_ai);
    // The pixels carry no watermark (and the model is not here to look anyway).
    assert!(!check.watermark_found);
}

#[tokio::test]
async fn bad_requests_are_refused() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    for bad in ["../x.png", "", "a/b.png", "nul.png"] {
        assert!(
            matches!(
                backend.check_watermark_image(bad.into()).await,
                Err(BackendError::Invalid(_))
            ),
            "{bad}"
        );
    }
    assert!(matches!(
        backend
            .check_watermark_image(format!("{}.png", "0".repeat(32)))
            .await,
        Err(BackendError::NotFound(_) | BackendError::Invalid(_))
    ));
    assert!(backend
        .check_watermark_file(dir.path().join("missing.png"))
        .await
        .is_err());
    let not_a_picture = dir.path().join("x.png");
    std::fs::write(&not_a_picture, b"not a picture").unwrap();
    assert!(backend.check_watermark_file(not_a_picture).await.is_err());
}
