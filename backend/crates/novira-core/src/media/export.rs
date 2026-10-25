//! Copies of gallery pictures for sharing outside the app. A copy is always encoded again from the pixels, so none of
//! the original file's text chunks, EXIF or XMP survive unless the caller asks to keep novira's own settings (PNG only).
use crate::media::images;
use image::codecs::jpeg::JpegEncoder;
use image::codecs::png::PngEncoder;
use image::codecs::webp::WebPEncoder;
use image::imageops::FilterType;
use image::{DynamicImage, GenericImageView, ImageEncoder};
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::{Path, PathBuf};

/// File format of a shared copy.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Png,
    Jpeg,
    /// Lossless only: the `image` crate (0.25) encodes WebP losslessly and has no quality setting.
    Webp,
}

impl ExportFormat {
    pub fn extension(self) -> &'static str {
        match self {
            ExportFormat::Png => "png",
            ExportFormat::Jpeg => "jpg",
            ExportFormat::Webp => "webp",
        }
    }

    pub fn content_type(self) -> &'static str {
        match self {
            ExportFormat::Png => "image/png",
            ExportFormat::Jpeg => "image/jpeg",
            ExportFormat::Webp => "image/webp",
        }
    }
}

/// How the copies are made (`export_images`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
    pub format: ExportFormat,
    /// JPEG quality from 1 to 100; PNG and WebP ignore it.
    pub quality: u8,
    /// Longest side in pixels; `None` keeps the original size. A picture is never enlarged.
    pub max_side: Option<u32>,
    /// Leave out the generation settings (prompt, settings, workflow). When false, a PNG copy keeps novira's own
    /// settings chunks; JPEG and WebP copies never carry them.
    pub remove_info: bool,
    /// Mark every copy as made by AI: an invisible TrustMark watermark, the IPTC source type in XMP and signed C2PA
    /// content credentials.
    #[serde(default)]
    pub watermark: bool,
}

/// What an export wrote.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    /// Pictures written.
    pub count: u32,
    /// Selected items that were not written: videos, audio, or files that are gone.
    pub skipped: u32,
    /// Copies that carry the watermark and content credentials.
    #[serde(default)]
    pub watermarked: u32,
    /// The folder the user chose, for display only.
    pub folder: String,
}

/// Smallest and largest longest-side a caller may ask for.
pub const MIN_SIDE: u32 = 16;
pub const MAX_SIDE: u32 = 16_384;
/// Most pictures one export takes.
pub const MAX_NAMES: usize = 10_000;
/// Most bytes of copies one browser download carries. The download is built in memory on both sides (the server's
/// answer, the page's blob), so it stays well under what a 32-bit browser tab can hold; a larger export is refused with
/// a message to choose fewer pictures instead of exhausting memory.
pub const MAX_DOWNLOAD_BYTES: usize = 1024 * 1024 * 1024;

/// A browser export: one copy as itself, several in a zip.
#[derive(Debug, Clone, PartialEq)]
pub struct ExportDownload {
    pub file_name: String,
    pub content_type: &'static str,
    pub bytes: Vec<u8>,
    pub result: ExportResult,
}

/// `<stem>.<ext>`, or `<stem>-2.<ext>`, `<stem>-3.<ext>`, ... when `taken` holds it (the names `write_unique` gives).
pub fn unique_name(taken: &mut std::collections::HashSet<String>, stem: &str, ext: &str) -> String {
    let mut n = 1u32;
    loop {
        let name = if n == 1 {
            format!("{stem}.{ext}")
        } else {
            format!("{stem}-{n}.{ext}")
        };
        if taken.insert(name.clone()) {
            return name;
        }
        n += 1;
    }
}

/// The copies in one zip, stored as they are (they are compressed pictures already).
pub fn zip_copies(files: &[(String, Vec<u8>)]) -> std::io::Result<Vec<u8>> {
    let mut zip = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    let options =
        zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
    for (name, bytes) in files {
        zip.start_file(name.as_str(), options)
            .map_err(std::io::Error::other)?;
        zip.write_all(bytes)?;
    }
    Ok(zip.finish().map_err(std::io::Error::other)?.into_inner())
}

/// Checks options that came from the frontend.
pub fn validate(options: &ExportOptions) -> Result<(), String> {
    if !(1..=100).contains(&options.quality) {
        return Err("quality must be between 1 and 100".into());
    }
    if let Some(side) = options.max_side {
        if !(MIN_SIDE..=MAX_SIDE).contains(&side) {
            return Err(format!(
                "the longest side must be between {MIN_SIDE} and {MAX_SIDE} pixels"
            ));
        }
    }
    Ok(())
}

/// The size of the copy: the longest side brought down to `max_side`, the other in proportion (at least 1 pixel).
pub fn target_size(width: u32, height: u32, max_side: Option<u32>) -> (u32, u32) {
    let longest = width.max(height);
    match max_side {
        Some(max) if longest > max && max > 0 => {
            let scale = f64::from(max) / f64::from(longest);
            let fit = |v: u32| ((f64::from(v) * scale).round() as u32).clamp(1, max);
            if width >= height {
                (max, fit(height))
            } else {
                (fit(width), max)
            }
        }
        _ => (width, height),
    }
}

/// Encodes one picture (the bytes of a gallery original) as the options say.
pub fn encode(original: &[u8], options: &ExportOptions) -> Result<Vec<u8>, String> {
    encode_with(original, options, None)
}

/// A change made to the pixels after the resize and right before encoding (the watermark).
pub type Mark<'a> = &'a dyn Fn(DynamicImage) -> Result<DynamicImage, String>;

/// As `encode`, with `mark` applied to the resized picture just before it is encoded.
pub fn encode_with(
    original: &[u8],
    options: &ExportOptions,
    mark: Option<Mark<'_>>,
) -> Result<Vec<u8>, String> {
    images::check_limits(original).map_err(|e| e.to_string())?;
    let decoded = image::load_from_memory(original).map_err(|e| e.to_string())?;
    let (w, h) = decoded.dimensions();
    let (tw, th) = target_size(w, h, options.max_side);
    let picture = if (tw, th) == (w, h) {
        decoded
    } else {
        decoded.resize_exact(tw, th, FilterType::Lanczos3)
    };
    let picture = match mark {
        Some(mark) => mark(picture)?,
        None => picture,
    };
    let alpha = picture.color().has_alpha();
    let mut out = Vec::new();
    let result = match options.format {
        ExportFormat::Png => {
            let encoder = PngEncoder::new(&mut out);
            if alpha {
                let rgba = picture.to_rgba8();
                encoder.write_image(&rgba, tw, th, image::ExtendedColorType::Rgba8)
            } else {
                let rgb = picture.to_rgb8();
                encoder.write_image(&rgb, tw, th, image::ExtendedColorType::Rgb8)
            }
        }
        ExportFormat::Jpeg => {
            let rgb = on_white(&picture);
            JpegEncoder::new_with_quality(&mut out, options.quality).write_image(
                &rgb,
                tw,
                th,
                image::ExtendedColorType::Rgb8,
            )
        }
        ExportFormat::Webp => {
            let encoder = WebPEncoder::new_lossless(&mut out);
            if alpha {
                let rgba = picture.to_rgba8();
                encoder.write_image(&rgba, tw, th, image::ExtendedColorType::Rgba8)
            } else {
                let rgb = picture.to_rgb8();
                encoder.write_image(&rgb, tw, th, image::ExtendedColorType::Rgb8)
            }
        }
    };
    result.map_err(|e| e.to_string())?;
    if options.format == ExportFormat::Png && !options.remove_info {
        for key in [images::METADATA_KEY, images::WORKFLOW_KEY] {
            if let Some(text) = images::read_text(original, key) {
                out = images::with_text(&out, key, &text).ok_or("cannot keep the settings")?;
            }
        }
    }
    Ok(out)
}

/// JPEG has no transparency: transparent parts are laid on white.
fn on_white(picture: &DynamicImage) -> image::RgbImage {
    let rgba = picture.to_rgba8();
    let mut rgb = image::RgbImage::new(rgba.width(), rgba.height());
    for (src, dst) in rgba.pixels().zip(rgb.pixels_mut()) {
        let [r, g, b, a] = src.0;
        let a = u32::from(a);
        let mix = |c: u8| ((u32::from(c) * a + 255 * (255 - a) + 127) / 255) as u8;
        dst.0 = [mix(r), mix(g), mix(b)];
    }
    rgb
}

/// Writes `bytes` as `<stem>.<ext>` in `folder`, or `<stem>-2.<ext>`, `<stem>-3.<ext>`, ... when the name is taken.
/// The file is created with `create_new`, so an existing file is never overwritten, even one that appears meanwhile.
pub fn write_unique(
    folder: &Path,
    stem: &str,
    ext: &str,
    bytes: &[u8],
) -> std::io::Result<PathBuf> {
    for n in 1..10_000u32 {
        let name = if n == 1 {
            format!("{stem}.{ext}")
        } else {
            format!("{stem}-{n}.{ext}")
        };
        let path = folder.join(name);
        match std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
        {
            Ok(mut file) => {
                if let Err(e) = file.write_all(bytes).and_then(|_| file.sync_all()) {
                    drop(file);
                    let _ = std::fs::remove_file(&path);
                    return Err(e);
                }
                return Ok(path);
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e),
        }
    }
    Err(std::io::Error::other("too many files with this name"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn png(w: u32, h: u32, alpha: bool) -> Vec<u8> {
        let img = if alpha {
            DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
                w,
                h,
                image::Rgba([200, 10, 10, 0]),
            ))
        } else {
            DynamicImage::ImageRgb8(image::RgbImage::from_pixel(w, h, image::Rgb([10, 20, 30])))
        };
        let mut out = std::io::Cursor::new(Vec::new());
        img.write_to(&mut out, image::ImageFormat::Png).unwrap();
        let png = out.into_inner();
        let png = images::with_text(&png, images::METADATA_KEY, r#"{"positivePrompt":"secret"}"#)
            .unwrap();
        images::with_text(&png, images::WORKFLOW_KEY, r#"{"nodes":[]}"#).unwrap()
    }

    fn options(format: ExportFormat) -> ExportOptions {
        ExportOptions {
            format,
            quality: 90,
            max_side: None,
            remove_info: true,
            watermark: false,
        }
    }

    /// Every chunk type of a PNG, in order.
    fn png_chunks(bytes: &[u8]) -> Vec<String> {
        let mut out = Vec::new();
        let mut pos = 8;
        while pos + 8 <= bytes.len() {
            let len = u32::from_be_bytes(bytes[pos..pos + 4].try_into().unwrap()) as usize;
            out.push(String::from_utf8_lossy(&bytes[pos + 4..pos + 8]).into_owned());
            pos += 12 + len;
        }
        out
    }

    fn contains(haystack: &[u8], needle: &[u8]) -> bool {
        haystack.windows(needle.len()).any(|w| w == needle)
    }

    #[test]
    fn a_png_copy_has_no_text_chunks_and_the_requested_size() {
        let original = png(400, 200, false);
        assert!(png_chunks(&original).contains(&"iTXt".to_string()));
        let copy = encode(
            &original,
            &ExportOptions {
                max_side: Some(100),
                ..options(ExportFormat::Png)
            },
        )
        .unwrap();
        let chunks = png_chunks(&copy);
        assert!(
            !chunks
                .iter()
                .any(|c| matches!(c.as_str(), "tEXt" | "iTXt" | "zTXt" | "eXIf")),
            "{chunks:?}"
        );
        assert!(!contains(&copy, b"secret"));
        let decoded = image::load_from_memory(&copy).unwrap();
        assert_eq!(decoded.dimensions(), (100, 50));
        assert_eq!(image::guess_format(&copy).unwrap(), image::ImageFormat::Png);
    }

    #[test]
    fn a_png_copy_can_keep_the_settings_when_asked() {
        let copy = encode(
            &png(8, 8, false),
            &ExportOptions {
                remove_info: false,
                ..options(ExportFormat::Png)
            },
        )
        .unwrap();
        assert_eq!(
            images::read_text(&copy, images::METADATA_KEY).as_deref(),
            Some(r#"{"positivePrompt":"secret"}"#)
        );
        assert!(images::read_text(&copy, images::WORKFLOW_KEY).is_some());
    }

    #[test]
    fn a_jpeg_copy_has_no_exif_and_lays_transparency_on_white() {
        let copy = encode(&png(64, 32, true), &options(ExportFormat::Jpeg)).unwrap();
        assert_eq!(
            image::guess_format(&copy).unwrap(),
            image::ImageFormat::Jpeg
        );
        // APP1 carries EXIF and XMP; only the JFIF header (APP0) may be there.
        assert!(!contains(&copy, b"Exif\0\0"));
        assert!(!contains(&copy, b"http://ns.adobe.com/xap"));
        assert!(!contains(&copy, b"secret"));
        let decoded = image::load_from_memory(&copy).unwrap().to_rgb8();
        assert_eq!(decoded.dimensions(), (64, 32));
        let p = decoded.get_pixel(10, 10).0;
        assert!(
            p.iter().all(|&c| c > 240),
            "fully transparent reads as white: {p:?}"
        );
    }

    #[test]
    fn a_webp_copy_is_lossless_without_metadata_and_keeps_alpha() {
        let copy = encode(
            &png(300, 600, true),
            &ExportOptions {
                max_side: Some(150),
                ..options(ExportFormat::Webp)
            },
        )
        .unwrap();
        assert_eq!(
            image::guess_format(&copy).unwrap(),
            image::ImageFormat::WebP
        );
        assert!(!contains(&copy, b"EXIF") && !contains(&copy, b"XMP "));
        assert!(!contains(&copy, b"secret"));
        let decoded = image::load_from_memory(&copy).unwrap();
        assert_eq!(decoded.dimensions(), (75, 150));
        assert!(decoded.color().has_alpha());
    }

    #[test]
    fn sizes_shrink_in_proportion_and_never_grow() {
        assert_eq!(target_size(4000, 3000, Some(1024)), (1024, 768));
        assert_eq!(target_size(3000, 4000, Some(1024)), (768, 1024));
        assert_eq!(target_size(800, 600, Some(1024)), (800, 600));
        assert_eq!(target_size(800, 600, None), (800, 600));
        assert_eq!(target_size(10_000, 1, Some(100)), (100, 1));
    }

    #[test]
    fn options_out_of_range_are_refused() {
        assert!(validate(&options(ExportFormat::Png)).is_ok());
        for bad in [
            ExportOptions {
                quality: 0,
                ..options(ExportFormat::Jpeg)
            },
            ExportOptions {
                quality: 101,
                ..options(ExportFormat::Jpeg)
            },
            ExportOptions {
                max_side: Some(4),
                ..options(ExportFormat::Png)
            },
            ExportOptions {
                max_side: Some(MAX_SIDE + 1),
                ..options(ExportFormat::Png)
            },
        ] {
            assert!(validate(&bad).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn a_taken_name_gets_a_number_and_nothing_is_overwritten() {
        let dir = tempfile::tempdir().unwrap();
        let a = write_unique(dir.path(), "pic", "png", b"one").unwrap();
        let b = write_unique(dir.path(), "pic", "png", b"two").unwrap();
        let c = write_unique(dir.path(), "pic", "png", b"three").unwrap();
        assert_eq!(a.file_name().unwrap(), "pic.png");
        assert_eq!(b.file_name().unwrap(), "pic-2.png");
        assert_eq!(c.file_name().unwrap(), "pic-3.png");
        assert_eq!(std::fs::read(&a).unwrap(), b"one");
    }

    #[test]
    fn the_mark_sees_the_resized_picture_and_its_result_is_what_is_encoded() {
        let seen = std::cell::Cell::new((0, 0));
        let mark = |p: DynamicImage| -> Result<DynamicImage, String> {
            seen.set(p.dimensions());
            Ok(DynamicImage::ImageRgb8(image::RgbImage::from_pixel(
                p.width(),
                p.height(),
                image::Rgb([255, 0, 0]),
            )))
        };
        let copy = encode_with(
            &png(400, 200, false),
            &ExportOptions {
                max_side: Some(100),
                ..options(ExportFormat::Png)
            },
            Some(&mark),
        )
        .unwrap();
        assert_eq!(seen.get(), (100, 50));
        let decoded = image::load_from_memory(&copy).unwrap().to_rgb8();
        assert_eq!(decoded.get_pixel(3, 3).0, [255, 0, 0]);
        let refuse = |_: DynamicImage| -> Result<DynamicImage, String> { Err("no".into()) };
        assert_eq!(
            encode_with(
                &png(8, 8, false),
                &options(ExportFormat::Png),
                Some(&refuse)
            ),
            Err("no".into())
        );
    }

    #[test]
    fn names_in_one_download_never_repeat() {
        let mut taken = std::collections::HashSet::new();
        assert_eq!(unique_name(&mut taken, "pic", "png"), "pic.png");
        assert_eq!(unique_name(&mut taken, "pic", "png"), "pic-2.png");
        assert_eq!(unique_name(&mut taken, "pic", "jpg"), "pic.jpg");
        assert_eq!(unique_name(&mut taken, "pic", "png"), "pic-3.png");
    }

    #[test]
    fn a_zip_holds_every_copy_unchanged_under_its_name() {
        let files = vec![
            ("a.png".to_string(), b"one".to_vec()),
            ("a-2.png".to_string(), b"two".to_vec()),
        ];
        let bytes = zip_copies(&files).unwrap();
        let mut archive = zip::ZipArchive::new(std::io::Cursor::new(bytes)).unwrap();
        assert_eq!(archive.len(), 2);
        for (name, content) in &files {
            let mut entry = archive.by_name(name).unwrap();
            let mut read = Vec::new();
            std::io::Read::read_to_end(&mut entry, &mut read).unwrap();
            assert_eq!(&read, content);
        }
    }

    #[test]
    fn broken_input_is_an_error() {
        assert!(encode(b"not a picture", &options(ExportFormat::Png)).is_err());
    }
}
