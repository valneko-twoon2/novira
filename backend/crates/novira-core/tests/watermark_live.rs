//! The real TrustMark watermark on the CPU. Needs the pinned files, fetched once with
//! `node tools/fetch-trustmark.mjs` (into `backend/target/resources/trustmark`), then:
//! `cargo test -p novira-core --test watermark_live -- --ignored --nocapture`.
//! Without the files each test says so and returns.
#![allow(dead_code)]
#[path = "backend_service/common.rs"]
mod common;

use common::*;
use image::{DynamicImage, GenericImageView};
use novira_core::media::export::{ExportFormat, ExportOptions};
use novira_core::provenance::files::{self, Found};
use novira_core::provenance::payload::{self, Decoded};
use novira_core::provenance::watermark::Watermarker;
use novira_core::types::*;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;

fn models_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../target/resources/trustmark")
}

fn found() -> Option<Found> {
    let found = files::locate(&[models_dir()]);
    if found.is_none() {
        eprintln!(
            "skipped: the watermark files are not in {} (run node tools/fetch-trustmark.mjs)",
            models_dir().display()
        );
    }
    found
}

/// A 1024 x 1024 picture with texture: one of the mock gallery pictures, enlarged.
fn picture() -> DynamicImage {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../../frontend/public/mock-images/illust/01.webp");
    image::open(path)
        .unwrap()
        .resize_exact(1024, 1024, image::imageops::FilterType::Lanczos3)
}

fn jpeg(picture: &DynamicImage, quality: u8) -> DynamicImage {
    let mut out = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, quality)
        .encode_image(&DynamicImage::ImageRgb8(picture.to_rgb8()))
        .unwrap();
    image::load_from_memory(&out).unwrap()
}

fn psnr(a: &DynamicImage, b: &DynamicImage) -> f64 {
    let (a, b) = (a.to_rgb8(), b.to_rgb8());
    let se: f64 = a
        .as_raw()
        .iter()
        .zip(b.as_raw())
        .map(|(x, y)| (f64::from(*x) - f64::from(*y)).powi(2))
        .sum();
    10.0 * (255.0f64.powi(2) / (se / a.as_raw().len() as f64)).log10()
}

#[test]
#[ignore = "needs the TrustMark files (node tools/fetch-trustmark.mjs)"]
fn the_watermark_survives_jpeg_at_80_and_half_the_size() {
    let Some(found) = found() else { return };
    let t = Instant::now();
    let w = Watermarker::load(&found).unwrap();
    eprintln!("load (hashes + runtime + models): {:?}", t.elapsed());
    let original = picture();
    assert_eq!(
        w.read(original.clone()).unwrap(),
        None,
        "no watermark before"
    );
    let id = payload::random_id();
    let t = Instant::now();
    let marked = w.embed(original.clone(), id).unwrap();
    eprintln!("embed 1024x1024: {:?}", t.elapsed());
    assert_eq!(marked.dimensions(), (1024, 1024));
    eprintln!("PSNR {:.2} dB", psnr(&original, &marked));
    assert!(psnr(&original, &marked) > 38.0);

    let t = Instant::now();
    assert_eq!(w.read(marked.clone()).unwrap(), Some(Decoded::Novira(id)));
    eprintln!("read: {:?}", t.elapsed());
    let q80 = jpeg(&marked, 80);
    assert_eq!(
        w.read(q80.clone()).unwrap(),
        Some(Decoded::Novira(id)),
        "JPEG 80"
    );
    let half = q80.resize_exact(512, 512, image::imageops::FilterType::Triangle);
    assert_eq!(
        w.read(half.clone()).unwrap(),
        Some(Decoded::Novira(id)),
        "JPEG 80 + 50%"
    );
    let half_then_jpeg = jpeg(
        &marked.resize_exact(512, 512, image::imageops::FilterType::Lanczos3),
        80,
    );
    assert_eq!(
        w.read(half_then_jpeg).unwrap(),
        Some(Decoded::Novira(id)),
        "50% + JPEG 80"
    );
}

#[tokio::test]
#[ignore = "needs the TrustMark files (node tools/fetch-trustmark.mjs)"]
async fn an_exported_copy_points_back_to_its_gallery_picture() {
    let Some(_) = found() else { return };
    let dir = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    // The files go where the app downloads them (hard links, no copy of 77 MB).
    let target = dir.path().join("models").join("trustmark");
    std::fs::create_dir_all(&target).unwrap();
    for f in files::pinned() {
        let src = models_dir().join(&f.name);
        if std::fs::hard_link(&src, target.join(&f.name)).is_err() {
            std::fs::copy(&src, target.join(&f.name)).unwrap();
        }
    }
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert_eq!(backend.watermark_status(), WatermarkStatus::Ready);
    let mut bytes = std::io::Cursor::new(Vec::new());
    picture()
        .write_to(&mut bytes, image::ImageFormat::Png)
        .unwrap();
    let image = backend
        .upload_image(bytes.into_inner(), ImageOptions::default())
        .await
        .unwrap();
    for format in [ExportFormat::Jpeg, ExportFormat::Png, ExportFormat::Webp] {
        let t = Instant::now();
        let done = backend
            .export_images(
                vec![image.name.clone()],
                ExportOptions {
                    format,
                    quality: 80,
                    max_side: Some(768),
                    remove_info: true,
                    watermark: true,
                },
                out.path().to_path_buf(),
            )
            .await
            .unwrap();
        eprintln!("export {format:?} with marks: {:?}", t.elapsed());
        assert_eq!((done.count, done.watermarked), (1, 1));
    }
    let mut files: Vec<PathBuf> = std::fs::read_dir(out.path())
        .unwrap()
        .flatten()
        .map(|e| e.path())
        .collect();
    files.sort();
    assert_eq!(files.len(), 3);
    for file in files {
        let check = backend.check_watermark_file(file.clone()).await.unwrap();
        eprintln!("{check:?}");
        assert!(
            check.watermark_checked && check.watermark_found && check.novira_marker,
            "{file:?}"
        );
        assert_eq!(check.original_name.as_deref(), Some(image.name.as_str()));
        assert!(check.original_in_gallery);
        assert!(check.credentials_valid && check.credentials_ai && check.credentials_this_app);
        assert!(!check.credentials_trusted);
        assert!(check.iptc_ai);
    }
}
