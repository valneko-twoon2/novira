//! Audio files in the gallery (music and speech): recognising them and drawing their thumbnail, a picture of the
//! waveform. A WAV file is decoded for the picture; for other formats (MP3, FLAC) a pattern that depends on the
//! file's bytes stands in, so each clip still looks different.
use image::{Rgb, RgbImage};

/// File extensions an audio entry may have.
pub const EXTENSIONS: [&str; 3] = ["mp3", "wav", "flac"];

/// The extension of an audio file name, as the gallery stores it (`None` for any other name).
pub fn extension_of(name: &str) -> Option<&'static str> {
    let (_, ext) = name.rsplit_once('.')?;
    EXTENSIONS
        .iter()
        .copied()
        .find(|e| e.eq_ignore_ascii_case(ext))
}

pub const THUMB_WIDTH: u32 = 256;
pub const THUMB_HEIGHT: u32 = 144;
const BARS: usize = 48;

/// MIME type from the leading bytes, if the bytes look like audio.
pub fn sniff(bytes: &[u8]) -> Option<&'static str> {
    if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WAVE" {
        Some("audio/wav")
    } else if bytes.starts_with(b"fLaC") {
        Some("audio/flac")
    } else if bytes.starts_with(b"ID3")
        || (bytes.len() > 2 && bytes[0] == 0xFF && bytes[1] & 0xE0 == 0xE0)
    {
        Some("audio/mpeg")
    } else {
        None
    }
}

/// Loudness of each bar from 16-bit PCM WAV data (all channels mixed); `None` for anything else.
fn wav_levels(bytes: &[u8]) -> Option<Vec<f32>> {
    if sniff(bytes) != Some("audio/wav") {
        return None;
    }
    let mut pos = 12;
    let mut bits = 0u16;
    while pos + 8 <= bytes.len() {
        let id = &bytes[pos..pos + 4];
        let size = u32::from_le_bytes(bytes[pos + 4..pos + 8].try_into().ok()?) as usize;
        let body = pos + 8;
        if id == b"fmt " && body + 16 <= bytes.len() {
            bits = u16::from_le_bytes(bytes[body + 14..body + 16].try_into().ok()?);
        } else if id == b"data" {
            if bits != 16 {
                return None;
            }
            let end = (body + size).min(bytes.len());
            let samples: Vec<i16> = bytes[body..end]
                .as_chunks::<2>()
                .0
                .iter()
                .map(|c| i16::from_le_bytes(*c))
                .collect();
            if samples.len() < BARS {
                return None;
            }
            let per = samples.len() / BARS;
            let levels: Vec<f32> = (0..BARS)
                .map(|i| {
                    let chunk = &samples[i * per..(i + 1) * per];
                    let mean_square = chunk
                        .iter()
                        .map(|&s| (f32::from(s) / 32768.0).powi(2))
                        .sum::<f32>()
                        / chunk.len() as f32;
                    mean_square.sqrt()
                })
                .collect();
            let peak = levels.iter().copied().fold(0.0f32, f32::max).max(1e-4);
            return Some(
                levels
                    .into_iter()
                    .map(|l| (l / peak).clamp(0.06, 1.0))
                    .collect(),
            );
        }
        pos = body + size + (size & 1);
    }
    None
}

/// A stand-in loudness pattern from the bytes themselves (stable for a file, different between files).
fn pattern_levels(bytes: &[u8]) -> Vec<f32> {
    let mut hash: u64 = 0xcbf29ce484222325;
    let step = (bytes.len() / 4096).max(1);
    for b in bytes.iter().step_by(step) {
        hash = (hash ^ u64::from(*b)).wrapping_mul(0x100000001b3);
    }
    let mut state = hash | 1;
    (0..BARS)
        .map(|i| {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            let noise = (state % 1000) as f32 / 1000.0;
            // A slow swell over the bars, so the picture reads as a clip rather than static.
            let swell = 0.55 + 0.45 * ((i as f32) * 0.35 + (hash % 7) as f32).sin();
            (0.15 + 0.85 * noise * swell).clamp(0.06, 1.0)
        })
        .collect()
}

/// The thumbnail (PNG) of an audio file: mirrored bars on a dark background.
pub fn waveform_png(bytes: &[u8]) -> Vec<u8> {
    let levels = wav_levels(bytes).unwrap_or_else(|| pattern_levels(bytes));
    let background = Rgb([16u8, 18, 24]);
    let bar = Rgb([76u8, 141, 255]);
    let mut img = RgbImage::from_pixel(THUMB_WIDTH, THUMB_HEIGHT, background);
    let slot = THUMB_WIDTH as f32 / BARS as f32;
    let mid = THUMB_HEIGHT as f32 / 2.0;
    for (i, level) in levels.iter().enumerate() {
        let half = (level * (THUMB_HEIGHT as f32 * 0.42)).max(2.0);
        let x0 = (i as f32 * slot + slot * 0.2) as u32;
        let x1 = (((i + 1) as f32) * slot - slot * 0.2) as u32;
        for x in x0..x1.min(THUMB_WIDTH) {
            for y in (mid - half) as u32..=((mid + half) as u32).min(THUMB_HEIGHT - 1) {
                img.put_pixel(x, y, bar);
            }
        }
    }
    let mut out = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(img)
        .write_to(&mut out, image::ImageFormat::Png)
        .expect("PNG encoding to memory");
    out.into_inner()
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::GenericImageView;

    #[test]
    fn the_extension_of_a_name_is_one_the_gallery_keeps() {
        assert_eq!(extension_of("a.flac"), Some("flac"));
        assert_eq!(extension_of("song.MP3"), Some("mp3"));
        assert_eq!(extension_of("x.y.wav"), Some("wav"));
        for other in ["a.png", "a.mp4", "a.opus", "flac", "", "a."] {
            assert_eq!(extension_of(other), None, "{other}");
        }
    }

    /// A 16-bit mono WAV of `samples`.
    pub fn wav(samples: &[i16]) -> Vec<u8> {
        let data: Vec<u8> = samples.iter().flat_map(|s| s.to_le_bytes()).collect();
        let mut out = Vec::new();
        out.extend_from_slice(b"RIFF");
        out.extend_from_slice(&(36 + data.len() as u32).to_le_bytes());
        out.extend_from_slice(b"WAVEfmt ");
        out.extend_from_slice(&16u32.to_le_bytes());
        out.extend_from_slice(&1u16.to_le_bytes());
        out.extend_from_slice(&1u16.to_le_bytes());
        out.extend_from_slice(&24000u32.to_le_bytes());
        out.extend_from_slice(&48000u32.to_le_bytes());
        out.extend_from_slice(&2u16.to_le_bytes());
        out.extend_from_slice(&16u16.to_le_bytes());
        out.extend_from_slice(b"data");
        out.extend_from_slice(&(data.len() as u32).to_le_bytes());
        out.extend_from_slice(&data);
        out
    }

    #[test]
    fn formats_are_recognised_from_their_first_bytes() {
        assert_eq!(sniff(&wav(&[0; 4])), Some("audio/wav"));
        assert_eq!(sniff(b"fLaC\0\0"), Some("audio/flac"));
        assert_eq!(sniff(b"ID3\x04\0"), Some("audio/mpeg"));
        assert_eq!(sniff(&[0xFF, 0xFB, 0x90, 0x00]), Some("audio/mpeg"));
        assert_eq!(sniff(b"\x89PNG\r\n\x1a\n"), None);
        assert_eq!(sniff(b""), None);
    }

    #[test]
    fn a_wav_thumbnail_follows_the_loudness() {
        // Loud first half, quiet second half.
        let mut samples = vec![20000i16; 24000];
        samples.extend(vec![500i16; 24000]);
        let levels = wav_levels(&wav(&samples)).expect("decodes");
        assert_eq!(levels.len(), BARS);
        assert!(levels[2] > 0.9 && levels[BARS - 3] < 0.2, "{levels:?}");
    }

    #[test]
    fn thumbnails_are_valid_pngs_of_the_fixed_size_and_differ_between_files() {
        let a = waveform_png(b"ID3 first clip bytes....................................");
        let b = waveform_png(b"ID3 another clip with other bytes.......................");
        for png in [&a, &b] {
            let img = image::load_from_memory(png).unwrap();
            assert_eq!(img.dimensions(), (THUMB_WIDTH, THUMB_HEIGHT));
        }
        assert_ne!(a, b);
        assert_eq!(
            a,
            waveform_png(b"ID3 first clip bytes....................................")
        );
    }

    #[test]
    fn broken_wav_data_falls_back_to_the_pattern() {
        assert!(wav_levels(b"RIFF\0\0\0\0WAVE").is_none());
        let png = waveform_png(b"RIFF\0\0\0\0WAVE");
        assert!(image::load_from_memory(&png).is_ok());
    }
}
