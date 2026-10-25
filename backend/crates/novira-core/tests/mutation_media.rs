//! Tests added after mutation testing (cargo-mutants, `scripts\mutation.bat`) showed that a change of the media helpers went
//! unnoticed.
use novira_core::media::images::{
    check_limits, ImageFiles, MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS, MAX_IMAGE_SIDE,
};

/// A tiny but well-formed WAV file (16-bit mono, 100 samples).
fn wav() -> Vec<u8> {
    let data = vec![0x10u8; 200];
    let mut fmt = vec![0u8; 16];
    fmt[0..2].copy_from_slice(&1u16.to_le_bytes());
    fmt[2..4].copy_from_slice(&1u16.to_le_bytes());
    fmt[4..8].copy_from_slice(&8000u32.to_le_bytes());
    fmt[8..12].copy_from_slice(&16000u32.to_le_bytes());
    fmt[12..14].copy_from_slice(&2u16.to_le_bytes());
    fmt[14..16].copy_from_slice(&16u16.to_le_bytes());
    let mut body = b"WAVE".to_vec();
    body.extend(b"fmt ");
    body.extend(16u32.to_le_bytes());
    body.extend(fmt);
    body.extend(b"data");
    body.extend((data.len() as u32).to_le_bytes());
    body.extend(data);
    let mut out = b"RIFF".to_vec();
    out.extend((body.len() as u32).to_le_bytes());
    out.extend(body);
    out
}

#[test]
fn sound_is_stored_only_under_an_audio_name() {
    let dir = tempfile::tempdir().unwrap();
    let files = ImageFiles::new(dir.path()).unwrap();
    assert!(files.store_audio("a1.wav", &wav()).is_ok());
    // The same well-formed bytes under a picture name are refused for the name, and nothing is written.
    let err = files.store_audio("a2.png", &wav()).unwrap_err();
    assert!(err.to_string().contains("invalid audio name"), "{err}");
    assert!(files.read_original("a2.png").is_none());
}

/// A real PNG whose header is then rewritten to declare `w` x `h` pixels (with a matching checksum).
fn png_declaring(w: u32, h: u32) -> Vec<u8> {
    let mut png = Vec::new();
    image::RgbImage::new(2, 2)
        .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
        .unwrap();
    png[16..20].copy_from_slice(&w.to_be_bytes());
    png[20..24].copy_from_slice(&h.to_be_bytes());
    let mut crc = crc32fast::Hasher::new();
    crc.update(&png[12..29]);
    png[29..33].copy_from_slice(&crc.finalize().to_be_bytes());
    png
}

#[test]
fn a_picture_exactly_at_the_size_limits_is_accepted_and_one_more_is_refused() {
    let side = MAX_IMAGE_SIDE;
    let half = (MAX_IMAGE_PIXELS as f64).sqrt() as u32;
    assert_eq!(u64::from(half) * u64::from(half), MAX_IMAGE_PIXELS);
    for (w, h, ok) in [
        (side, 1, true),
        (1, side, true),
        (side + 1, 1, false),
        (1, side + 1, false),
        (half, half, true),
        (half, half + 1, false),
    ] {
        assert_eq!(check_limits(&png_declaring(w, h)).is_ok(), ok, "{w}x{h}");
    }
}

#[test]
fn a_file_of_exactly_the_byte_limit_is_not_refused_for_its_size() {
    // Zeroed memory is not touched until it is read, so this costs no real memory. It is no picture, so it is
    // refused, but for its content and not for its size.
    let exact = vec![0u8; MAX_IMAGE_BYTES];
    let err = check_limits(&exact).unwrap_err();
    assert!(!err.to_string().contains("too large"), "{err}");
}
