//! Image files on disk: originals as PNG under `outputs/` (in the folders `arrangement` gives them), thumbnails under
//! `thumbnails/`.
//! Generation parameters are embedded as UTF-8 `iTXt` chunks so a PNG carries its own settings.
use crate::media::audio;
use crate::sync::LockExt;
use image::GenericImageView;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub const METADATA_KEY: &str = "novira_metadata";
pub const WORKFLOW_KEY: &str = "novira_workflow";
const PNG_SIGNATURE: &[u8; 8] = b"\x89PNG\r\n\x1a\n";
const THUMB_SIZE: u32 = 256;

#[derive(Debug, thiserror::Error)]
pub enum ImageError {
    #[error("unsupported or broken image: {0}")]
    Decode(String),
    #[error("cannot write image: {0}")]
    Io(#[from] std::io::Error),
}

pub struct ImageFiles {
    originals: PathBuf,
    thumbnails: PathBuf,
    /// Where deleted pictures wait to be taken back (`trash/`): the original and the thumbnail side by side.
    trash: PathBuf,
    /// Where each original is under `outputs/`, by name; a name not here is `outputs/<name>` (a new file, or one an
    /// older version stored).
    placed: Mutex<HashMap<String, PathBuf>>,
}

/// True for names novira generates (`<hex/uuid>` with a picture, video or audio extension); anything else is refused
/// before touching the disk.
pub fn is_valid_name(name: &str) -> bool {
    name.len() <= 80
        && (name.ends_with(".png")
            || name.ends_with(".mp4")
            || audio::EXTENSIONS
                .iter()
                .any(|e| name.ends_with(&format!(".{e}"))))
        && name.len() > 4
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.'))
        && !name.starts_with('.')
        && !crate::is_reserved_device_name(name)
}

pub fn new_name() -> String {
    format!("{}.png", uuid::Uuid::new_v4().simple())
}

pub fn new_video_name() -> String {
    format!("{}.mp4", uuid::Uuid::new_v4().simple())
}

pub fn is_video(name: &str) -> bool {
    name.ends_with(".mp4")
}

pub fn new_audio_name(ext: &str) -> String {
    format!("{}.{ext}", uuid::Uuid::new_v4().simple())
}

pub fn is_audio(name: &str) -> bool {
    audio::EXTENSIONS
        .iter()
        .any(|e| name.ends_with(&format!(".{e}")))
}

impl ImageFiles {
    pub fn new(data_dir: &Path) -> std::io::Result<Self> {
        let originals = data_dir.join("outputs");
        let thumbnails = data_dir.join("thumbnails");
        std::fs::create_dir_all(&originals)?;
        std::fs::create_dir_all(&thumbnails)?;
        Ok(Self {
            originals,
            thumbnails,
            trash: data_dir.join("trash"),
            placed: Mutex::default(),
        })
    }

    pub fn original_path(&self, name: &str) -> Option<PathBuf> {
        if !is_valid_name(name) {
            return None;
        }
        let rel = self.placed.lock_safe().get(name).cloned();
        Some(
            self.originals
                .join(rel.as_deref().unwrap_or(Path::new(name))),
        )
    }

    /// Finds every original under `outputs/` (one folder down) by the name its file name holds, so a picture opens
    /// wherever its file was put. Returns how many it found.
    pub fn index(&self) -> usize {
        let mut found = HashMap::new();
        let Ok(top) = std::fs::read_dir(&self.originals) else {
            return 0;
        };
        for entry in top.flatten() {
            let Ok(kind) = entry.file_type() else {
                continue;
            };
            let file = entry.file_name();
            if kind.is_file() {
                if let Some(name) = file.to_str().and_then(crate::media::arrangement::name_in) {
                    found.insert(name.to_string(), PathBuf::from(&file));
                }
            } else if kind.is_dir() {
                let Ok(inner) = std::fs::read_dir(entry.path()) else {
                    continue;
                };
                for f in inner.flatten() {
                    let inner_name = f.file_name();
                    if !f.file_type().is_ok_and(|k| k.is_file()) {
                        continue;
                    }
                    if let Some(name) = inner_name
                        .to_str()
                        .and_then(crate::media::arrangement::name_in)
                    {
                        found.insert(name.to_string(), Path::new(&file).join(&inner_name));
                    }
                }
            }
        }
        let n = found.len();
        *self.placed.lock_safe() = found;
        n
    }

    /// Moves a picture's original to `rel` under `outputs/` (a folder and a file name). True when it moved; false when it
    /// is there already or has no file. A file already at `rel` is never replaced.
    pub fn move_to(&self, name: &str, rel: &Path) -> std::io::Result<bool> {
        let Some(from) = self.original_path(name) else {
            return Ok(false);
        };
        let to = self.originals.join(rel);
        if from == to || !from.is_file() {
            return Ok(false);
        }
        if to.exists() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::AlreadyExists,
                format!("{} exists", to.display()),
            ));
        }
        if let Some(parent) = to.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::rename(&from, &to)?;
        self.placed
            .lock_safe()
            .insert(name.to_string(), rel.to_path_buf());
        Ok(true)
    }

    /// Removes the folders of `outputs/` that no file is left in (a board renamed or emptied).
    pub fn remove_empty_folders(&self) {
        let Ok(top) = std::fs::read_dir(&self.originals) else {
            return;
        };
        for entry in top.flatten() {
            if entry.file_type().is_ok_and(|k| k.is_dir()) {
                // Fails, as wanted, while anything is inside.
                let _ = std::fs::remove_dir(entry.path());
            }
        }
    }

    pub fn thumbnail_path(&self, name: &str) -> Option<PathBuf> {
        is_valid_name(name).then(|| {
            let stem = Path::new(name)
                .file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_default();
            self.thumbnails.join(format!("{stem}.thumb"))
        })
    }

    /// Stores a PNG and its thumbnail; returns the pixel size.
    pub fn store(&self, name: &str, png: &[u8]) -> Result<(u32, u32), ImageError> {
        let (orig, thumb_path) = match (self.original_path(name), self.thumbnail_path(name)) {
            (Some(a), Some(b)) => (a, b),
            _ => return Err(ImageError::Decode(format!("invalid image name {name}"))),
        };
        let decoded =
            image::load_from_memory(png).map_err(|e| ImageError::Decode(e.to_string()))?;
        let (w, h) = decoded.dimensions();
        let thumb = make_thumbnail(&decoded)?;
        write_atomic(&orig, png)?;
        write_atomic(&thumb_path, &thumb)?;
        Ok((w, h))
    }

    /// Stores a video as-is, with a still frame (PNG) for its thumbnail; returns the size of that frame.
    pub fn store_video(
        &self,
        name: &str,
        mp4: &[u8],
        frame_png: &[u8],
    ) -> Result<(u32, u32), ImageError> {
        let (orig, thumb_path) = match (self.original_path(name), self.thumbnail_path(name)) {
            (Some(a), Some(b)) if is_video(name) => (a, b),
            _ => return Err(ImageError::Decode(format!("invalid video name {name}"))),
        };
        let decoded =
            image::load_from_memory(frame_png).map_err(|e| ImageError::Decode(e.to_string()))?;
        let (w, h) = decoded.dimensions();
        let thumb = make_thumbnail(&decoded)?;
        write_atomic(&orig, mp4)?;
        write_atomic(&thumb_path, &thumb)?;
        Ok((w, h))
    }

    /// Stores an audio file with a picture of its waveform for a thumbnail; returns the size of that picture.
    pub fn store_audio(&self, name: &str, bytes: &[u8]) -> Result<(u32, u32), ImageError> {
        let (orig, thumb_path) = match (self.original_path(name), self.thumbnail_path(name)) {
            (Some(a), Some(b)) if is_audio(name) => (a, b),
            _ => return Err(ImageError::Decode(format!("invalid audio name {name}"))),
        };
        if audio::sniff(bytes).is_none() {
            return Err(ImageError::Decode("not an audio file".into()));
        }
        write_atomic(&orig, bytes)?;
        write_atomic(&thumb_path, &audio::waveform_png(bytes))?;
        Ok((audio::THUMB_WIDTH, audio::THUMB_HEIGHT))
    }

    pub fn delete(&self, name: &str) {
        for p in [self.original_path(name), self.thumbnail_path(name)]
            .into_iter()
            .flatten()
        {
            let _ = std::fs::remove_file(p);
        }
        self.placed.lock_safe().remove(name);
    }

    /// The two files of a picture in the trash: the original and the thumbnail.
    fn trashed_paths(&self, name: &str) -> Option<[PathBuf; 2]> {
        let thumb = self.thumbnail_path(name)?;
        Some([self.trash.join(name), self.trash.join(thumb.file_name()?)])
    }

    /// Moves a picture's files into the trash (so a deletion can be taken back). Returns whether the original moved.
    pub fn trash(&self, name: &str) -> bool {
        let (Some(from), Some(to)) = (
            [self.original_path(name), self.thumbnail_path(name)]
                .into_iter()
                .collect::<Option<Vec<_>>>(),
            self.trashed_paths(name),
        ) else {
            return false;
        };
        if std::fs::create_dir_all(&self.trash).is_err() {
            return false;
        }
        let mut moved = false;
        for (i, (a, b)) in from.iter().zip(&to).enumerate() {
            let ok = std::fs::rename(a, b).is_ok();
            if i == 0 {
                moved = ok;
            }
        }
        // It comes back to `outputs/<name>`, and `arrangement` puts it in its folder again.
        if moved {
            self.placed.lock_safe().remove(name);
        }
        moved
    }

    /// Puts a trashed picture's files back (the original at `outputs/<name>`). True when the original is in place afterwards.
    pub fn restore(&self, name: &str) -> bool {
        let (Some(to), Some(from)) = (
            [self.original_path(name), self.thumbnail_path(name)]
                .into_iter()
                .collect::<Option<Vec<_>>>(),
            self.trashed_paths(name),
        ) else {
            return false;
        };
        for (a, b) in from.iter().zip(&to) {
            if a.exists() {
                let _ = std::fs::rename(a, b);
            }
        }
        to[0].exists()
    }

    /// Whether a picture's original is in the gallery's folders.
    pub fn has_original(&self, name: &str) -> bool {
        self.original_path(name).is_some_and(|p| p.exists())
    }

    /// Whether a picture's original is in the trash.
    pub fn is_trashed(&self, name: &str) -> bool {
        self.trashed_paths(name)
            .is_some_and(|[original, _]| original.exists())
    }

    /// Deletes a trashed picture's files for good.
    pub fn purge(&self, name: &str) {
        for p in self.trashed_paths(name).into_iter().flatten() {
            let _ = std::fs::remove_file(p);
        }
    }

    pub fn read_original(&self, name: &str) -> Option<Vec<u8>> {
        std::fs::read(self.original_path(name)?).ok()
    }

    pub fn read_thumbnail(&self, name: &str) -> Option<Vec<u8>> {
        std::fs::read(self.thumbnail_path(name)?).ok()
    }
}

fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, bytes)?;
    std::fs::rename(&tmp, path)
}

fn make_thumbnail(img: &image::DynamicImage) -> Result<Vec<u8>, ImageError> {
    let small = img.thumbnail(THUMB_SIZE, THUMB_SIZE);
    let mut out = std::io::Cursor::new(Vec::new());
    let result = if small.color().has_alpha() {
        small.write_to(&mut out, image::ImageFormat::Png)
    } else {
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 85)
            .encode_image(&small.to_rgb8())
    };
    result.map_err(|e| ImageError::Decode(e.to_string()))?;
    Ok(out.into_inner())
}

/// MIME type from the leading bytes (thumbnails are PNG or JPEG).
pub fn sniff_content_type(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(PNG_SIGNATURE) {
        "image/png"
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "image/jpeg"
    } else if bytes.get(4..8) == Some(b"ftyp") {
        "video/mp4"
    } else if let Some(audio) = audio::sniff(bytes) {
        audio
    } else {
        "application/octet-stream"
    }
}

/// Most bytes and pixels accepted for one picture: a small file can still declare a huge canvas.
pub const MAX_IMAGE_BYTES: usize = 256 * 1024 * 1024;
pub const MAX_IMAGE_PIXELS: u64 = 100_000_000;
pub const MAX_IMAGE_SIDE: u32 = 20_000;

/// The picture formats novira accepts from outside.
pub const ACCEPTED_FORMATS: [image::ImageFormat; 5] = [
    image::ImageFormat::Png,
    image::ImageFormat::Jpeg,
    image::ImageFormat::WebP,
    image::ImageFormat::Gif,
    image::ImageFormat::Bmp,
];

/// Refuses oversized input and formats outside `ACCEPTED_FORMATS` before anything is decoded, from the header.
pub fn check_limits(bytes: &[u8]) -> Result<(), ImageError> {
    if bytes.len() > MAX_IMAGE_BYTES {
        return Err(ImageError::Decode("the image file is too large".into()));
    }
    let reader = image::ImageReader::new(std::io::Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|e| ImageError::Decode(e.to_string()))?;
    // `trustmark` turns on every format of the `image` crate; outside files stay limited to the ones
    // novira itself reads, so the other decoders never see outside data.
    if !reader
        .format()
        .is_some_and(|f| ACCEPTED_FORMATS.contains(&f))
    {
        return Err(ImageError::Decode(
            "this file type is not supported (use PNG, JPEG, WebP, GIF or BMP)".into(),
        ));
    }
    let (w, h) = reader
        .into_dimensions()
        .map_err(|e| ImageError::Decode(e.to_string()))?;
    if w > MAX_IMAGE_SIDE || h > MAX_IMAGE_SIDE || u64::from(w) * u64::from(h) > MAX_IMAGE_PIXELS {
        return Err(ImageError::Decode(format!(
            "the image is too large ({w}x{h})"
        )));
    }
    Ok(())
}

/// Returns PNG bytes: a PNG is kept byte-for-byte, other formats are decoded and re-encoded.
pub fn to_png(bytes: &[u8]) -> Result<Vec<u8>, ImageError> {
    check_limits(bytes)?;
    if bytes.starts_with(PNG_SIGNATURE) {
        // Validate the chunk structure so a truncated file is refused here, not when it is served.
        chunks(bytes).ok_or_else(|| ImageError::Decode("broken PNG".into()))?;
        return Ok(bytes.to_vec());
    }
    let img = image::load_from_memory(bytes).map_err(|e| ImageError::Decode(e.to_string()))?;
    let mut out = std::io::Cursor::new(Vec::new());
    img.write_to(&mut out, image::ImageFormat::Png)
        .map_err(|e| ImageError::Decode(e.to_string()))?;
    Ok(out.into_inner())
}

struct Chunk<'a> {
    kind: [u8; 4],
    data: &'a [u8],
    /// Byte range of the whole chunk (length, type, data, CRC).
    start: usize,
    end: usize,
}

fn chunks(png: &[u8]) -> Option<Vec<Chunk<'_>>> {
    if !png.starts_with(PNG_SIGNATURE) {
        return None;
    }
    let mut out = Vec::new();
    let mut pos = PNG_SIGNATURE.len();
    while pos < png.len() {
        let len = u32::from_be_bytes(png.get(pos..pos + 4)?.try_into().ok()?) as usize;
        let kind: [u8; 4] = png.get(pos + 4..pos + 8)?.try_into().ok()?;
        let data = png.get(pos + 8..pos.checked_add(8 + len)?)?;
        let end = pos + 12 + len;
        png.get(end - 4..end)?;
        out.push(Chunk {
            kind,
            data,
            start: pos,
            end,
        });
        pos = end;
        if &kind == b"IEND" {
            return Some(out);
        }
    }
    None
}

fn chunk_bytes(kind: &[u8; 4], data: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(data.len() + 12);
    out.extend_from_slice(&(data.len() as u32).to_be_bytes());
    out.extend_from_slice(kind);
    out.extend_from_slice(data);
    let mut crc = crc32fast::Hasher::new();
    crc.update(kind);
    crc.update(data);
    out.extend_from_slice(&crc.finalize().to_be_bytes());
    out
}

/// Text value of an uncompressed `iTXt` or a `tEXt` chunk with this keyword.
pub fn read_text(png: &[u8], key: &str) -> Option<String> {
    for c in chunks(png)? {
        let Some(nul) = c.data.iter().position(|&b| b == 0) else {
            continue;
        };
        if &c.data[..nul] != key.as_bytes() {
            continue;
        }
        let rest = &c.data[nul + 1..];
        match &c.kind {
            b"tEXt" => return Some(rest.iter().map(|&b| b as char).collect()),
            b"iTXt" => {
                // compression flag, method, language\0, translated keyword\0, text
                if rest.first() != Some(&0) {
                    return None;
                }
                let after = rest.get(2..)?;
                let lang_end = after.iter().position(|&b| b == 0)?;
                let after = &after[lang_end + 1..];
                let tk_end = after.iter().position(|&b| b == 0)?;
                return String::from_utf8(after[tk_end + 1..].to_vec()).ok();
            }
            _ => {}
        }
    }
    None
}

/// Replaces (or adds) an uncompressed UTF-8 `iTXt` chunk before `IEND`. Pixel data is not touched.
pub fn with_text(png: &[u8], key: &str, value: &str) -> Option<Vec<u8>> {
    let list = chunks(png)?;
    let mut out = Vec::with_capacity(png.len() + value.len() + 64);
    out.extend_from_slice(PNG_SIGNATURE);
    let mut payload = Vec::with_capacity(value.len() + key.len() + 5);
    payload.extend_from_slice(key.as_bytes());
    payload.extend_from_slice(&[0, 0, 0, 0, 0]);
    payload.extend_from_slice(value.as_bytes());
    for c in &list {
        let is_same_key = matches!(&c.kind, b"iTXt" | b"tEXt")
            && c.data
                .iter()
                .position(|&b| b == 0)
                .is_some_and(|n| &c.data[..n] == key.as_bytes());
        if is_same_key {
            continue;
        }
        if &c.kind == b"IEND" {
            out.extend_from_slice(&chunk_bytes(b"iTXt", &payload));
        }
        out.extend_from_slice(&png[c.start..c.end]);
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tiny_png(w: u32, h: u32) -> Vec<u8> {
        let img = image::RgbImage::from_pixel(w, h, image::Rgb([10, 20, 30]));
        let mut out = std::io::Cursor::new(Vec::new());
        image::DynamicImage::ImageRgb8(img)
            .write_to(&mut out, image::ImageFormat::Png)
            .unwrap();
        out.into_inner()
    }

    #[test]
    fn the_size_limits_of_a_picture_are_256_mib_100_megapixels_and_20000_pixels_a_side() {
        assert_eq!(MAX_IMAGE_BYTES, 268_435_456);
        assert_eq!(MAX_IMAGE_PIXELS, 100_000_000);
        assert_eq!(MAX_IMAGE_SIDE, 20_000);
    }

    #[test]
    fn a_picture_is_in_the_gallery_or_in_the_trash_only_when_its_file_is() {
        let dir = tempfile::tempdir().unwrap();
        let files = ImageFiles::new(dir.path()).unwrap();
        let name = new_name();
        assert!(!files.has_original(&name));
        assert!(!files.is_trashed(&name));
        // A name that is no picture name is neither.
        assert!(!files.has_original("../x.png"));
        assert!(!files.is_trashed("../x.png"));
        std::fs::write(files.original_path(&name).unwrap(), tiny_png(2, 2)).unwrap();
        assert!(files.has_original(&name));
        assert!(!files.is_trashed(&name));
        assert!(files.trash(&name));
        assert!(!files.has_original(&name));
        assert!(files.is_trashed(&name));
    }

    #[test]
    fn text_chunks_round_trip_utf8_and_replace_previous_values() {
        let png = tiny_png(4, 3);
        let a = with_text(&png, METADATA_KEY, r#"{"prompt":"猫"}"#).unwrap();
        let b = with_text(&a, METADATA_KEY, r#"{"prompt":"犬"}"#).unwrap();
        assert_eq!(
            read_text(&b, METADATA_KEY).as_deref(),
            Some(r#"{"prompt":"犬"}"#)
        );
        assert_eq!(read_text(&b, WORKFLOW_KEY), None);
        // Still a valid image with the same pixels.
        let img = image::load_from_memory(&b).unwrap();
        assert_eq!(img.dimensions(), (4, 3));
        assert_eq!(img.to_rgb8().get_pixel(0, 0).0, [10, 20, 30]);
    }

    #[test]
    fn oversized_pictures_are_refused_from_their_header() {
        // A wide, one-pixel-high PNG is a few KB but declares a canvas past the side limit.
        let wide = image::RgbImage::from_pixel(MAX_IMAGE_SIDE + 1, 1, image::Rgb([0, 0, 0]));
        let mut png = std::io::Cursor::new(Vec::new());
        image::DynamicImage::ImageRgb8(wide)
            .write_to(&mut png, image::ImageFormat::Png)
            .unwrap();
        let err = to_png(&png.into_inner()).unwrap_err().to_string();
        assert!(err.contains("too large"), "{err}");
        assert!(check_limits(&tiny_png(8, 8)).is_ok());
        assert!(check_limits(b"not an image").is_err());
    }

    #[test]
    fn only_the_accepted_formats_reach_a_decoder() {
        let img = image::DynamicImage::ImageRgb8(image::RgbImage::from_pixel(
            6,
            4,
            image::Rgb([1, 2, 3]),
        ));
        for format in ACCEPTED_FORMATS {
            let mut out = std::io::Cursor::new(Vec::new());
            img.write_to(&mut out, format).unwrap();
            assert!(check_limits(&out.into_inner()).is_ok(), "{format:?}");
        }
        // Formats the image crate can read now that trustmark enables them all, but novira does not take.
        for format in [
            image::ImageFormat::Tiff,
            image::ImageFormat::Qoi,
            image::ImageFormat::OpenExr,
            image::ImageFormat::Pnm,
            image::ImageFormat::Ico,
        ] {
            let mut out = std::io::Cursor::new(Vec::new());
            let pixels = if format == image::ImageFormat::OpenExr {
                image::DynamicImage::ImageRgb32F(img.to_rgb32f())
            } else {
                img.clone()
            };
            pixels.write_to(&mut out, format).unwrap();
            let err = to_png(&out.into_inner()).unwrap_err().to_string();
            assert!(err.contains("not supported"), "{format:?}: {err}");
        }
    }

    #[test]
    fn non_png_input_is_converted_and_broken_input_refused() {
        let img = image::RgbImage::from_pixel(5, 5, image::Rgb([0, 0, 0]));
        let mut jpg = std::io::Cursor::new(Vec::new());
        image::DynamicImage::ImageRgb8(img)
            .write_to(&mut jpg, image::ImageFormat::Jpeg)
            .unwrap();
        let png = to_png(&jpg.into_inner()).unwrap();
        assert!(png.starts_with(PNG_SIGNATURE));
        let mut truncated = tiny_png(2, 2);
        truncated.truncate(truncated.len() - 5);
        assert!(to_png(&truncated).is_err());
        assert!(to_png(b"hello").is_err());
    }

    #[test]
    fn names_outside_the_generated_form_are_refused() {
        assert!(is_valid_name(&new_name()));
        for bad in ["../x.png", "a/b.png", "x.jpg", ".png", "a\\b.png", ""] {
            assert!(!is_valid_name(bad), "{bad}");
        }
    }

    #[test]
    fn store_writes_original_and_thumbnail() {
        let dir = tempfile::tempdir().unwrap();
        let files = ImageFiles::new(dir.path()).unwrap();
        let name = new_name();
        let (w, h) = files.store(&name, &tiny_png(600, 300)).unwrap();
        assert_eq!((w, h), (600, 300));
        let thumb = files.read_thumbnail(&name).unwrap();
        assert_eq!(sniff_content_type(&thumb), "image/jpeg");
        assert_eq!(
            image::load_from_memory(&thumb).unwrap().dimensions(),
            (256, 128)
        );
        files.delete(&name);
        assert!(files.read_original(&name).is_none());
    }
}
