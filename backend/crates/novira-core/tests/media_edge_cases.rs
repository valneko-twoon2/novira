//! Edge cases of the picture, audio and export helpers: refused names and files, formats that carry transparency,
//! broken PNG and WAV structures, and the exclusive file writer.
use novira_core::media::audio;
use novira_core::media::export::{encode, write_unique, ExportFormat, ExportOptions};
use novira_core::media::images::{
    check_limits, read_text, sniff_content_type, with_text, ImageFiles, MAX_IMAGE_BYTES,
};

fn png_of(img: image::DynamicImage) -> Vec<u8> {
    let mut out = std::io::Cursor::new(Vec::new());
    img.write_to(&mut out, image::ImageFormat::Png).unwrap();
    out.into_inner()
}

fn opaque_png() -> Vec<u8> {
    png_of(image::DynamicImage::ImageRgb8(image::RgbImage::from_pixel(
        8,
        6,
        image::Rgb([10, 20, 30]),
    )))
}

fn transparent_png() -> Vec<u8> {
    png_of(image::DynamicImage::ImageRgba8(
        image::RgbaImage::from_pixel(8, 6, image::Rgba([10, 20, 30, 128])),
    ))
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

/// One PNG chunk with a correct CRC.
fn chunk(kind: &[u8; 4], data: &[u8]) -> Vec<u8> {
    let mut out = (data.len() as u32).to_be_bytes().to_vec();
    out.extend_from_slice(kind);
    out.extend_from_slice(data);
    let mut crc = crc32fast::Hasher::new();
    crc.update(kind);
    crc.update(data);
    out.extend_from_slice(&crc.finalize().to_be_bytes());
    out
}

const SIGNATURE: &[u8] = b"\x89PNG\r\n\x1a\n";

// Image files -----------------------------------------------------------------------------------------------------

#[test]
fn image_files_refuse_names_that_are_not_theirs() {
    let dir = tempfile::tempdir().unwrap();
    let files = ImageFiles::new(dir.path()).unwrap();
    let png = opaque_png();
    assert!(files.store("../evil.png", &png).is_err());
    assert!(files.store_video("photo.png", b"x", &png).is_err());
    assert!(files.store_audio("photo.png", b"RIFF").is_err());
}

#[test]
fn stored_audio_must_look_like_audio() {
    let dir = tempfile::tempdir().unwrap();
    let files = ImageFiles::new(dir.path()).unwrap();
    let name = novira_core::media::images::new_audio_name("wav");
    let err = files.store_audio(&name, b"not audio at all").unwrap_err();
    assert!(err.to_string().contains("not an audio file"), "{err}");
}

#[test]
fn a_picture_with_transparency_gets_a_png_thumbnail() {
    let dir = tempfile::tempdir().unwrap();
    let files = ImageFiles::new(dir.path()).unwrap();
    let name = novira_core::media::images::new_name();
    files.store(&name, &transparent_png()).unwrap();
    let thumb = files.read_thumbnail(&name).unwrap();
    assert_eq!(sniff_content_type(&thumb), "image/png");
}

#[test]
fn unknown_bytes_get_the_generic_content_type() {
    assert_eq!(
        sniff_content_type(b"plain text"),
        "application/octet-stream"
    );
}

#[test]
fn an_oversized_file_is_refused_before_it_is_decoded() {
    let big = vec![0u8; MAX_IMAGE_BYTES + 1];
    let err = check_limits(&big).unwrap_err();
    assert!(err.to_string().contains("too large"), "{err}");
}

// PNG text chunks -------------------------------------------------------------------------------------------------

#[test]
fn text_helpers_refuse_bytes_that_are_not_a_png() {
    assert_eq!(read_text(b"not a png", "key"), None);
    assert_eq!(with_text(b"not a png", "key", "v"), None);
}

#[test]
fn a_png_without_an_end_chunk_has_no_text() {
    let mut png = SIGNATURE.to_vec();
    png.extend(chunk(b"IHDR", &[0; 13]));
    assert_eq!(read_text(&png, "key"), None);
}

#[test]
fn a_text_chunk_is_read_and_a_compressed_international_chunk_is_not() {
    let mut png = SIGNATURE.to_vec();
    png.extend(chunk(b"tEXt", b"key\0plain value"));
    png.extend(chunk(b"zTXt", b"other\0\0whatever"));
    png.extend(chunk(b"IEND", b""));
    assert_eq!(read_text(&png, "key").as_deref(), Some("plain value"));
    // A chunk of another kind with the same keyword is skipped.
    assert_eq!(read_text(&png, "other"), None);

    let mut compressed = SIGNATURE.to_vec();
    compressed.extend(chunk(b"iTXt", b"key\0\x01\0\0\0packed"));
    compressed.extend(chunk(b"IEND", b""));
    assert_eq!(read_text(&compressed, "key"), None);
}

// Export ----------------------------------------------------------------------------------------------------------

#[test]
fn export_formats_have_their_file_extensions() {
    assert_eq!(ExportFormat::Png.extension(), "png");
    assert_eq!(ExportFormat::Jpeg.extension(), "jpg");
    assert_eq!(ExportFormat::Webp.extension(), "webp");
}

#[test]
fn png_and_webp_copies_keep_or_drop_the_alpha_channel_as_the_picture_has_it() {
    for format in [ExportFormat::Png, ExportFormat::Webp] {
        for source in [opaque_png(), transparent_png()] {
            let has_alpha = image::load_from_memory(&source)
                .unwrap()
                .color()
                .has_alpha();
            let copy = encode(&source, &options(format)).unwrap();
            let decoded = image::load_from_memory(&copy).unwrap();
            assert_eq!(decoded.color().has_alpha(), has_alpha, "{format:?}");
        }
    }
}

#[test]
fn a_file_that_is_not_a_picture_cannot_be_exported() {
    assert!(encode(b"nothing", &options(ExportFormat::Png)).is_err());
}

// Exclusive writer ------------------------------------------------------------------------------------------------

#[test]
fn writing_into_a_missing_folder_fails_with_the_io_error() {
    let dir = tempfile::tempdir().unwrap();
    let err = write_unique(&dir.path().join("missing"), "a", "png", b"x").unwrap_err();
    assert_eq!(err.kind(), std::io::ErrorKind::NotFound);
}

#[test]
fn the_writer_gives_up_when_ten_thousand_names_are_taken() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("a.png"), b"").unwrap();
    for n in 2..10_000u32 {
        std::fs::write(dir.path().join(format!("a-{n}.png")), b"").unwrap();
    }
    let err = write_unique(dir.path(), "a", "png", b"x").unwrap_err();
    assert!(err.to_string().contains("too many files"), "{err}");
}

// WAV thumbnails --------------------------------------------------------------------------------------------------

fn wav(bits: u16, samples: usize, with_data: bool) -> Vec<u8> {
    let mut body = b"WAVE".to_vec();
    let mut fmt = vec![0u8; 16];
    fmt[14..16].copy_from_slice(&bits.to_le_bytes());
    body.extend(chunk_le(b"fmt ", &fmt));
    if with_data {
        body.extend(chunk_le(b"data", &vec![0x10u8; samples * 2]));
    } else {
        body.extend(chunk_le(b"LIST", b"abc"));
    }
    let mut out = b"RIFF".to_vec();
    out.extend((body.len() as u32).to_le_bytes());
    out.extend(body);
    out
}

fn chunk_le(id: &[u8; 4], data: &[u8]) -> Vec<u8> {
    let mut out = id.to_vec();
    out.extend((data.len() as u32).to_le_bytes());
    out.extend_from_slice(data);
    if data.len() % 2 == 1 {
        out.push(0);
    }
    out
}

#[test]
fn wavs_that_cannot_be_measured_still_get_a_waveform_picture() {
    // 8-bit data, too few samples, and no data chunk at all: each falls back to the stand-in pattern.
    for bytes in [wav(8, 4800, true), wav(16, 10, true), wav(16, 0, false)] {
        let png = audio::waveform_png(&bytes);
        assert!(png.starts_with(SIGNATURE));
    }
}
