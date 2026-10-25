//! The picture store and the PNG helpers under bad conditions: folders that cannot be made or are gone, pictures whose
//! pixels cannot be decoded although their header looks fine, text chunks that are cut short, and a PNG copy that keeps
//! the settings the picture was made with.
use novira_core::media::export::{self, ExportFormat, ExportOptions};
use novira_core::media::images::{self, ImageFiles};

fn png(w: u32, h: u32) -> Vec<u8> {
    let img = image::RgbImage::from_pixel(w, h, image::Rgb([10, 20, 30]));
    let mut out = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(img)
        .write_to(&mut out, image::ImageFormat::Png)
        .unwrap();
    out.into_inner()
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

/// `png` with one more chunk in front of its `IEND`.
fn with_chunk(png: &[u8], kind: &[u8; 4], data: &[u8]) -> Vec<u8> {
    let iend = png.len() - 12;
    let mut out = png[..iend].to_vec();
    out.extend(chunk(kind, data));
    out.extend_from_slice(&png[iend..]);
    out
}

#[test]
fn the_store_cannot_be_opened_when_a_folder_is_taken_by_a_file() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("outputs"), b"a file").unwrap();
    assert!(ImageFiles::new(dir.path()).is_err());
    std::fs::remove_file(dir.path().join("outputs")).unwrap();
    std::fs::write(dir.path().join("thumbnails"), b"a file").unwrap();
    assert!(ImageFiles::new(dir.path()).is_err());
}

#[test]
fn pictures_that_cannot_be_decoded_or_written_are_refused() {
    let dir = tempfile::tempdir().unwrap();
    let files = ImageFiles::new(dir.path()).unwrap();
    let name = images::new_name();
    // A PNG header followed by nothing: it names a size but has no pixels.
    let broken = png(8, 8)[..40].to_vec();
    assert!(files.store(&name, &broken).is_err());
    let video = format!("{}.mp4", name.trim_end_matches(".png"));
    assert!(files.store_video(&video, b"mp4", &broken).is_err());

    // With the folders gone nothing can be written.
    std::fs::remove_dir_all(dir.path().join("outputs")).unwrap();
    assert!(files.store(&name, &png(8, 8)).is_err());
    assert!(files.store_video(&video, b"mp4", &png(8, 8)).is_err());
    std::fs::create_dir(dir.path().join("outputs")).unwrap();
    std::fs::remove_dir_all(dir.path().join("thumbnails")).unwrap();
    assert!(files.store(&name, &png(8, 8)).is_err());
    assert!(files.store_video(&video, b"mp4", &png(8, 8)).is_err());
    let audio = format!("{}.wav", name.trim_end_matches(".png"));
    let mut wav = b"RIFF".to_vec();
    wav.extend([36, 0, 0, 0]);
    wav.extend(b"WAVEfmt ");
    wav.extend([0; 40]);
    // Whatever the audio check says, a store without a thumbnail folder cannot succeed.
    assert!(files.store_audio(&audio, &wav).is_err());
}

#[test]
fn a_picture_that_cannot_be_decoded_is_refused_when_it_is_converted() {
    // A BMP whose header declares a size and whose pixel data is missing.
    let mut bmp = b"BM".to_vec();
    bmp.extend(1000u32.to_le_bytes());
    bmp.extend([0; 4]);
    bmp.extend(54u32.to_le_bytes());
    bmp.extend(40u32.to_le_bytes());
    bmp.extend(8i32.to_le_bytes());
    bmp.extend(8i32.to_le_bytes());
    bmp.extend(1u16.to_le_bytes());
    bmp.extend(24u16.to_le_bytes());
    bmp.extend([0; 24]);
    assert!(images::to_png(&bmp).is_err());
}

#[test]
fn text_chunks_that_are_cut_short_give_no_text() {
    let base = png(4, 4);
    // Compressed (flag 1), nothing after the flags, no end of the language tag, no end of the translated keyword.
    let compressed = with_chunk(&base, b"iTXt", b"k\0\x01\0en\0\0data");
    assert_eq!(images::read_text(&compressed, "k"), None);
    let no_flags = with_chunk(&base, b"iTXt", b"k\0\0");
    assert_eq!(images::read_text(&no_flags, "k"), None);
    let no_language_end = with_chunk(&base, b"iTXt", b"k\0\0\0en");
    assert_eq!(images::read_text(&no_language_end, "k"), None);
    let no_keyword_end = with_chunk(&base, b"iTXt", b"k\0\0\0en\0translated");
    assert_eq!(images::read_text(&no_keyword_end, "k"), None);
    // A well-formed one is read.
    let fine = with_chunk(&base, b"iTXt", b"k\0\0\0en\0\0text");
    assert_eq!(images::read_text(&fine, "k").as_deref(), Some("text"));
}

#[test]
fn a_png_copy_keeps_the_settings_the_picture_was_made_with() {
    let original = images::with_text(&png(8, 8), images::METADATA_KEY, "{\"a\":1}").unwrap();
    let options = ExportOptions {
        format: ExportFormat::Png,
        quality: 90,
        max_side: None,
        remove_info: false,
        watermark: false,
    };
    let copy = export::encode(&original, &options).unwrap();
    assert_eq!(
        images::read_text(&copy, images::METADATA_KEY).as_deref(),
        Some("{\"a\":1}")
    );
}
