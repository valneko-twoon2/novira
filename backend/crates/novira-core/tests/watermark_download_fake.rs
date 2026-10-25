//! Downloads of the export watermark's files against the fake site: a file appears under its own name only
//! when its size and hash match, a zip gives up only the pinned entry, and a failure leaves nothing behind.
#![allow(dead_code)]
#[path = "backend_service/common.rs"]
mod common;
mod fake_site;

use fake_site::{client, site, Route};
use novira_core::provenance::files::{fetch, Archive, FetchError, PinnedFile};
use novira_core::types::WatermarkStatus;
use sha2::{Digest, Sha256};
use std::io::Write;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;

fn sha(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

fn pinned(name: &str, path: &str, body: &[u8]) -> PinnedFile {
    PinnedFile {
        name: name.into(),
        service: "trustmark".into(),
        path: path.into(),
        bytes: body.len() as u64,
        sha256: sha(body),
        archive: None,
    }
}

fn zip_with(entry: &str, body: &[u8]) -> Vec<u8> {
    let mut out = std::io::Cursor::new(Vec::new());
    {
        let mut zip = zip::ZipWriter::new(&mut out);
        zip.start_file(entry, zip::write::SimpleFileOptions::default())
            .unwrap();
        zip.write_all(body).unwrap();
        zip.finish().unwrap();
    }
    out.into_inner()
}

/// Every file name in `dir`.
fn names(dir: &std::path::Path) -> Vec<String> {
    let mut v: Vec<String> = std::fs::read_dir(dir)
        .map(|r| {
            r.flatten()
                .map(|e| e.file_name().to_string_lossy().into_owned())
                .collect()
        })
        .unwrap_or_default();
    v.sort();
    v
}

#[tokio::test]
async fn a_file_with_the_pinned_hash_is_kept_under_its_name() {
    let body = b"model bytes".repeat(1000);
    site().put("/wm-ok/encoder.onnx", Route::bytes(body.clone()));
    let dir = tempfile::tempdir().unwrap();
    let file = pinned("encoder.onnx", "/wm-ok/encoder.onnx", &body);
    let mut seen = 0u64;
    fetch(
        &client(),
        &file,
        dir.path(),
        &CancellationToken::new(),
        &mut |n| seen += n,
    )
    .await
    .unwrap();
    assert_eq!(
        std::fs::read(dir.path().join("encoder.onnx")).unwrap(),
        body
    );
    assert_eq!(seen, body.len() as u64);
    assert_eq!(names(dir.path()), ["encoder.onnx"]);
}

#[tokio::test]
async fn a_file_with_another_hash_is_refused_and_removed() {
    site().put("/wm-bad/encoder.onnx", Route::bytes(b"evil".to_vec()));
    let dir = tempfile::tempdir().unwrap();
    let mut file = pinned("encoder.onnx", "/wm-bad/encoder.onnx", b"good");
    file.bytes = 4;
    let err = fetch(
        &client(),
        &file,
        dir.path(),
        &CancellationToken::new(),
        &mut |_| {},
    )
    .await
    .unwrap_err();
    assert!(
        matches!(&err, FetchError::Failed(m) if m.contains("hash")),
        "{err}"
    );
    assert!(names(dir.path()).is_empty());
}

#[tokio::test]
async fn a_download_larger_than_pinned_stops_at_the_cap() {
    // Announced as larger: refused before reading.
    site().put("/wm-big/a.onnx", Route::bytes(vec![1u8; 5000]));
    let dir = tempfile::tempdir().unwrap();
    let file = pinned("a.onnx", "/wm-big/a.onnx", &[1u8; 100]);
    let err = fetch(
        &client(),
        &file,
        dir.path(),
        &CancellationToken::new(),
        &mut |_| {},
    )
    .await
    .unwrap_err();
    assert!(
        matches!(&err, FetchError::Failed(m) if m.contains("larger")),
        "{err}"
    );
    assert!(names(dir.path()).is_empty());
}

#[tokio::test]
async fn an_error_answer_or_a_cancel_leaves_nothing() {
    site().put("/wm-404/a.onnx", Route::status(404));
    let dir = tempfile::tempdir().unwrap();
    let file = pinned("a.onnx", "/wm-404/a.onnx", b"x");
    let err = fetch(
        &client(),
        &file,
        dir.path(),
        &CancellationToken::new(),
        &mut |_| {},
    )
    .await
    .unwrap_err();
    assert!(
        matches!(&err, FetchError::Failed(m) if m.contains("404")),
        "{err}"
    );
    let cancel = CancellationToken::new();
    cancel.cancel();
    site().put("/wm-cancel/a.onnx", Route::bytes(b"x".to_vec()));
    let file = pinned("a.onnx", "/wm-cancel/a.onnx", b"x");
    assert_eq!(
        fetch(&client(), &file, dir.path(), &cancel, &mut |_| {}).await,
        Err(FetchError::Cancelled)
    );
    assert!(names(dir.path()).is_empty());
}

#[tokio::test]
async fn the_runtime_comes_out_of_its_zip_and_the_zip_is_removed() {
    let dll = b"MZ fake runtime".repeat(50);
    let archive = zip_with("pkg/lib/onnxruntime.dll", &dll);
    site().put("/wm-zip/ort.zip", Route::bytes(archive.clone()));
    let dir = tempfile::tempdir().unwrap();
    let mut file = pinned("onnxruntime.dll", "/wm-zip/ort.zip", &dll);
    file.service = "github".into();
    file.archive = Some(Archive {
        bytes: archive.len() as u64,
        sha256: sha(&archive),
        entry: "pkg/lib/onnxruntime.dll".into(),
    });
    fetch(
        &client(),
        &file,
        dir.path(),
        &CancellationToken::new(),
        &mut |_| {},
    )
    .await
    .unwrap();
    assert_eq!(
        std::fs::read(dir.path().join("onnxruntime.dll")).unwrap(),
        dll
    );
    assert_eq!(names(dir.path()), ["onnxruntime.dll"]);

    // An archive without the entry, or whose entry has another hash, gives nothing.
    for (path, zip) in [
        ("/wm-zip/other.zip", zip_with("pkg/lib/other.dll", &dll)),
        (
            "/wm-zip/changed.zip",
            zip_with("pkg/lib/onnxruntime.dll", b"MZ other"),
        ),
    ] {
        site().put(path, Route::bytes(zip.clone()));
        let dir = tempfile::tempdir().unwrap();
        let mut f = file.clone();
        f.path = path.into();
        f.archive = Some(Archive {
            bytes: zip.len() as u64,
            sha256: sha(&zip),
            entry: "pkg/lib/onnxruntime.dll".into(),
        });
        assert!(fetch(
            &client(),
            &f,
            dir.path(),
            &CancellationToken::new(),
            &mut |_| {}
        )
        .await
        .is_err());
        assert!(names(dir.path()).is_empty(), "{path}");
    }
}

#[tokio::test]
async fn the_backend_reports_a_failed_download_and_keeps_no_partial_file() {
    // The pinned paths are not served by the fake site: the first file answers 404.
    let _ = site();
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = common::open(dir.path(), Arc::new(common::FakeEngine::default()));
    assert_eq!(backend.watermark_status(), WatermarkStatus::Missing);
    backend.prepare_watermark().await;
    match backend.watermark_status() {
        WatermarkStatus::Failed { message } => assert!(message.contains("404"), "{message}"),
        other => panic!("{other:?}"),
    }
    let folder = dir.path().join("models").join("trustmark");
    assert!(names(&folder).is_empty(), "{:?}", names(&folder));
}
