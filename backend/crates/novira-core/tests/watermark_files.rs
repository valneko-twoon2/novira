//! The watermark through the real TrustMark files on small pictures, so the code that needs the ONNX Runtime DLL runs in
//! the ordinary test run. The files come from `node tools/fetch-trustmark.mjs` (into `backend/target/resources/trustmark`);
//! without them each test says so and returns. `watermark_live.rs` covers the large picture and the survival checks.
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
use novira_core::BackendError;
use std::path::{Path, PathBuf};
use std::sync::Arc;

fn models_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../target/resources/trustmark")
}

fn found() -> Option<Found> {
    let found = files::locate(&[models_dir()]);
    if found.is_none() {
        eprintln!(
            "skipped: the watermark files are not in {}",
            models_dir().display()
        );
    }
    found
}

/// A textured square picture made from a formula (no file needed).
fn texture(side: u32) -> DynamicImage {
    DynamicImage::ImageRgb8(image::RgbImage::from_fn(side, side, |x, y| {
        let n = (x.wrapping_mul(2654435761) ^ y.wrapping_mul(40503)) % 64;
        image::Rgb([
            ((x * 255 / side) as u8).saturating_add(n as u8 / 2),
            ((y * 255 / side) as u8).saturating_add(n as u8 / 3),
            (((x + y) * 127 / side) as u8).saturating_add(n as u8),
        ])
    }))
}

fn png_bytes(picture: &DynamicImage) -> Vec<u8> {
    let mut out = std::io::Cursor::new(Vec::new());
    picture.write_to(&mut out, image::ImageFormat::Png).unwrap();
    out.into_inner()
}

/// Puts the files where the app downloads them (hard links, no copy of 77 MB).
fn install_files(data_dir: &Path) {
    let target = data_dir.join("models").join("trustmark");
    std::fs::create_dir_all(&target).unwrap();
    for f in files::pinned() {
        let src = models_dir().join(&f.name);
        if std::fs::hard_link(&src, target.join(&f.name)).is_err() {
            std::fs::copy(&src, target.join(&f.name)).unwrap();
        }
    }
}

fn options(format: ExportFormat) -> ExportOptions {
    ExportOptions {
        format,
        quality: 85,
        max_side: None,
        remove_info: true,
        watermark: true,
    }
}

#[test]
fn a_picture_keeps_its_type_and_size_and_gives_its_mark_back() {
    let Some(found) = found() else { return };
    let w = Watermarker::load(&found).unwrap();
    assert_eq!(format!("{w:?}"), "Watermarker");
    let id = payload::random_id();
    let base = texture(256);
    let kinds = [
        base.clone(),
        DynamicImage::ImageRgba8(base.to_rgba8()),
        DynamicImage::ImageRgb16(base.to_rgb16()),
        DynamicImage::ImageRgba16(base.to_rgba16()),
        DynamicImage::ImageLuma8(base.to_luma8()),
        DynamicImage::ImageLumaA8(base.to_luma_alpha8()),
        DynamicImage::ImageLuma16(base.to_luma16()),
        DynamicImage::ImageLumaA16(base.to_luma_alpha16()),
    ];
    for kind in kinds {
        let color = kind.color();
        let marked = w.embed(kind, id).unwrap();
        assert_eq!(marked.dimensions(), (256, 256));
        // The type comes back as the nearest one the watermark keeps (grey pictures become colour).
        if color.has_alpha() {
            assert!(marked.color().has_alpha(), "{color:?}");
        }
        if color == image::ColorType::Rgb8 {
            assert_eq!(marked.color(), color);
            assert_eq!(w.read(marked).unwrap(), Some(Decoded::Novira(id)));
        }
    }
    // A picture without a mark reads as none.
    assert_eq!(w.read(texture(256)).unwrap(), None);
}

#[test]
fn pictures_the_watermark_cannot_take_are_refused() {
    let Some(found) = found() else { return };
    let w = Watermarker::load(&found).unwrap();
    let big = DynamicImage::new_rgb8(4097, 4096);
    assert!(w.embed(big.clone(), 1).unwrap_err().contains("too large"));
    assert!(w.read(big).unwrap_err().contains("too large"));
    assert!(w
        .embed(DynamicImage::new_rgb8(1, 50), 1)
        .unwrap_err()
        .contains("too small"));
}

#[test]
fn a_model_that_fails_its_hash_is_not_loaded() {
    let Some(found) = found() else { return };
    let dir = tempfile::tempdir().unwrap();
    for name in [files::ENCODER, files::DECODER] {
        let mut bytes = std::fs::read(found.models.join(name)).unwrap();
        bytes[100] ^= 0xff;
        std::fs::write(dir.path().join(name), bytes).unwrap();
    }
    let broken = Found {
        models: dir.path().to_path_buf(),
        runtime: found.runtime.clone(),
    };
    let err = Watermarker::load(&broken).unwrap_err();
    assert!(!err.is_empty());
}

#[tokio::test]
async fn exports_with_the_watermark_download_as_one_file_or_a_zip_and_read_back() {
    let Some(_) = found() else { return };
    let dir = tempfile::tempdir().unwrap();
    install_files(dir.path());
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert_eq!(backend.watermark_status(), WatermarkStatus::Ready);
    let bytes = png_bytes(&texture(256));
    let one = backend
        .upload_image(bytes.clone(), ImageOptions::default())
        .await
        .unwrap();
    let mut other = texture(200);
    other.invert();
    let two = backend
        .upload_image(png_bytes(&other), ImageOptions::default())
        .await
        .unwrap();

    // One picture: itself, marked, and recorded.
    let single = backend
        .export_download(vec![one.name.clone()], options(ExportFormat::Png))
        .await
        .unwrap();
    assert_eq!((single.result.count, single.result.watermarked), (1, 1));
    assert!(single.file_name.ends_with(".png"));
    let file = dir.path().join("copy.png");
    std::fs::write(&file, &single.bytes).unwrap();
    let check = backend.check_watermark_file(file).await.unwrap();
    assert!(check.watermark_checked && check.watermark_found && check.novira_marker);
    assert_eq!(check.original_name.as_deref(), Some(one.name.as_str()));
    assert!(check.original_in_gallery);
    assert!(check.credentials_valid && check.credentials_this_app && check.iptc_ai);

    // Several pictures: a zip; a video name is skipped and counted.
    let several = backend
        .export_download(
            vec![one.name.clone(), two.name.clone(), "clip.mp4".into()],
            options(ExportFormat::Webp),
        )
        .await
        .unwrap();
    assert_eq!(
        (
            several.result.count,
            several.result.skipped,
            several.result.watermarked
        ),
        (2, 1, 2)
    );
    assert!(several.file_name.ends_with(".zip"));

    // A gallery picture checked by name: no mark of ours on the original.
    let plain = backend
        .check_watermark_image(one.name.clone())
        .await
        .unwrap();
    assert!(plain.watermark_checked);
    assert!(!plain.watermark_found && plain.original_name.is_none());
}

#[tokio::test]
async fn a_damaged_model_file_fails_the_export_and_is_removed_for_the_next_download() {
    let Some(found) = found() else { return };
    let dir = tempfile::tempdir().unwrap();
    let target = dir.path().join("models").join("trustmark");
    std::fs::create_dir_all(&target).unwrap();
    // Same sizes as the pinned files, wrong content: the files look complete until they are loaded.
    for f in files::pinned() {
        if f.name == files::RUNTIME {
            std::fs::hard_link(&found.runtime, target.join(&f.name))
                .or_else(|_| std::fs::copy(&found.runtime, target.join(&f.name)).map(|_| ()))
                .unwrap();
        } else {
            std::fs::write(target.join(&f.name), vec![7u8; f.bytes as usize]).unwrap();
        }
    }
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert_eq!(backend.watermark_status(), WatermarkStatus::Ready);
    let image = backend
        .upload_image(png_bytes(&texture(64)), ImageOptions::default())
        .await
        .unwrap();
    let err = backend
        .export_download(vec![image.name.clone()], options(ExportFormat::Png))
        .await
        .unwrap_err();
    assert!(matches!(err, BackendError::Invalid(_)), "{err}");
    assert!(
        matches!(backend.watermark_status(), WatermarkStatus::Failed { .. }),
        "{:?}",
        backend.watermark_status()
    );
    assert!(
        !target.join(files::ENCODER).exists(),
        "the damaged file is removed"
    );
    // The export is now refused up front, before any picture is read.
    assert!(backend
        .check_export(&[image.name], &options(ExportFormat::Png))
        .is_err());
}
