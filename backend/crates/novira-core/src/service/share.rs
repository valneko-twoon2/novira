//! Export for sharing: copies of gallery pictures written into a folder the user chose in a native dialog (the shell
//! opens it; the WebView never sends a path), or handed to the browser server as one download. See `media::export`. With the watermark switch on, every
//! copy is also marked as made by AI, and "check a picture" reads those marks back (`provenance`).
use super::*;
use crate::media::export::{self, ExportDownload, ExportFormat, ExportOptions, ExportResult};
use crate::provenance::{self, credentials::Identity, payload, WatermarkRecord};
use std::collections::HashSet;
use std::io::Read;

/// Tries for an id that no earlier export used (45 random bits: a repeat is very unlikely, but cheap to rule out).
const ID_TRIES: usize = 8;

fn image_format(format: ExportFormat) -> image::ImageFormat {
    match format {
        ExportFormat::Png => image::ImageFormat::Png,
        ExportFormat::Jpeg => image::ImageFormat::Jpeg,
        ExportFormat::Webp => image::ImageFormat::WebP,
    }
}

impl Backend {
    /// Checks an export request before the shell asks for a folder, so a bad request fails without a dialog.
    pub fn check_export(&self, names: &[String], options: &ExportOptions) -> Result<()> {
        export::validate(options).map_err(BackendError::Invalid)?;
        if names.is_empty() || names.len() > export::MAX_NAMES {
            return Err(BackendError::Invalid(format!(
                "choose between 1 and {} pictures",
                export::MAX_NAMES
            )));
        }
        if let Some(bad) = names.iter().find(|n| !images::is_valid_name(n)) {
            return Err(BackendError::Invalid(format!("invalid image name {bad}")));
        }
        if options.watermark && self.watermark_status() != WatermarkStatus::Ready {
            return Err(BackendError::Invalid(
                "the watermark is not ready yet: its files are missing or still downloading".into(),
            ));
        }
        Ok(())
    }

    /// Writes a shared copy of each picture into `folder` (chosen by the user). Videos, audio and missing files are
    /// skipped and counted.
    pub async fn export_images(
        &self,
        names: Vec<String>,
        options: ExportOptions,
        folder: PathBuf,
    ) -> Result<ExportResult> {
        self.check_export(&names, &options)?;
        if !folder.is_dir() {
            return Err(BackendError::Invalid("the folder does not exist".into()));
        }
        let this = self.clone();
        tokio::task::spawn_blocking(move || -> Result<ExportResult> {
            let ext = options.format.extension();
            let (count, skipped, watermarked) =
                this.make_copies(&names, &options, &mut |stem, bytes| {
                    export::write_unique(&folder, stem, ext, bytes)
                        .map(|_| ())
                        .map_err(|e| {
                            BackendError::Internal(format!("cannot write into the folder: {e}"))
                        })
                })?;
            Ok(ExportResult {
                count,
                skipped,
                watermarked,
                folder: folder.display().to_string(),
            })
        })
        .await
        .map_err(internal)?
    }

    /// The same copies as `export_images`, for the browser to download: one picture as itself, several in a zip. The
    /// result's `folder` is empty (the browser decides where the download goes).
    pub async fn export_download(
        &self,
        names: Vec<String>,
        options: ExportOptions,
    ) -> Result<ExportDownload> {
        self.check_export(&names, &options)?;
        let this = self.clone();
        tokio::task::spawn_blocking(move || -> Result<ExportDownload> {
            let ext = options.format.extension();
            let mut taken = HashSet::new();
            let mut files: Vec<(String, Vec<u8>)> = Vec::new();
            let mut total = 0usize;
            let (count, skipped, watermarked) =
                this.make_copies(&names, &options, &mut |stem, bytes| {
                    total += bytes.len();
                    if total > export::MAX_DOWNLOAD_BYTES {
                        return Err(BackendError::Invalid(format!(
                            "the copies are larger than one download can carry ({} MB); choose fewer pictures",
                            export::MAX_DOWNLOAD_BYTES / (1024 * 1024)
                        )));
                    }
                    files.push((export::unique_name(&mut taken, stem, ext), bytes.to_vec()));
                    Ok(())
                })?;
            let result = ExportResult {
                count,
                skipped,
                watermarked,
                folder: String::new(),
            };
            let (file_name, content_type, bytes) = match files.len() {
                0 => {
                    return Err(BackendError::Invalid(
                        "none of the chosen pictures could be read".into(),
                    ))
                }
                1 => {
                    let (name, bytes) = files.remove(0);
                    (name, options.format.content_type(), bytes)
                }
                _ => (
                    format!(
                        "novira-export-{}.zip",
                        chrono::Local::now().format("%Y%m%d-%H%M%S")
                    ),
                    "application/zip",
                    export::zip_copies(&files).map_err(internal)?,
                ),
            };
            Ok(ExportDownload {
                file_name,
                content_type,
                bytes,
                result,
            })
        })
        .await
        .map_err(internal)?
    }

    /// Encodes a copy of each picture and hands it to `put` with the gallery name's stem; with the watermark on, records
    /// each mark after `put` took the copy. Videos, audio and missing files are skipped. Returns the copies made, the
    /// items skipped and the copies marked.
    fn make_copies(
        &self,
        names: &[String],
        options: &ExportOptions,
        put: &mut dyn FnMut(&str, &[u8]) -> Result<()>,
    ) -> Result<(u32, u32, u32)> {
        // Loaded once for the whole export; a failure stops it before any copy is made.
        let marks = if options.watermark {
            let watermarker = self
                .inner
                .watermark
                .watermarker()
                .map_err(BackendError::Invalid)?;
            Some((
                watermarker,
                self.signing_identity(true)?.expect("created when asked"),
            ))
        } else {
            None
        };
        let (mut count, mut skipped, mut watermarked) = (0u32, 0u32, 0u32);
        for name in names {
            if images::is_video(name) || images::is_audio(name) {
                skipped += 1;
                continue;
            }
            let Some(original) = self.inner.files.read_original(name) else {
                skipped += 1;
                continue;
            };
            let (bytes, id) = match &marks {
                None => (
                    export::encode(&original, options)
                        .map_err(|e| BackendError::Invalid(format!("{name}: {e}")))?,
                    None,
                ),
                Some((watermarker, identity)) => {
                    let id = self.fresh_watermark_id()?;
                    let embed = |p: image::DynamicImage| watermarker.embed(p, id);
                    let encoded = export::encode_with(&original, options, Some(&embed))
                        .and_then(|b| {
                            provenance::label(&b, image_format(options.format), identity, Some(id))
                        })
                        .map_err(|e| BackendError::Invalid(format!("{name}: {e}")))?;
                    (encoded, Some(id))
                }
            };
            let stem = name.rsplit_once('.').map_or(name.as_str(), |(s, _)| s);
            put(stem, &bytes)?;
            if let Some(id) = id {
                let record = WatermarkRecord {
                    id: payload::id_hex(id),
                    image_name: name.clone(),
                    exported_at: now(),
                    format: options.format,
                };
                self.db()
                    .put(Table::Watermarks, &record.id, record.exported_at, &record)?;
                watermarked += 1;
            }
            count += 1;
        }
        Ok((count, skipped, watermarked))
    }

    /// A watermark id the database does not hold yet.
    fn fresh_watermark_id(&self) -> Result<u64> {
        for _ in 0..ID_TRIES {
            let id = payload::random_id();
            if self
                .db()
                .get::<WatermarkRecord>(Table::Watermarks, &payload::id_hex(id))?
                .is_none()
            {
                return Ok(id);
            }
        }
        Err(BackendError::Internal("no free watermark id".into()))
    }

    /// This installation's signing identity: loaded once; made (and saved) on first use when `create` is set.
    fn signing_identity(&self, create: bool) -> Result<Option<Identity>> {
        let mut cached = self.inner.signing.lock_safe();
        if cached.is_none() {
            let dir = &self.inner.data_dir;
            *cached = if create {
                Some(Identity::load_or_create(dir).map_err(BackendError::Internal)?)
            } else {
                match secret::load_secret(dir, Secret::C2paSigning) {
                    Ok(Some(saved)) => serde_json::from_str(&saved).ok(),
                    _ => None,
                }
            };
        }
        Ok(cached.clone())
    }

    /// Whether the watermark's files are here, downloading, or failed.
    pub fn watermark_status(&self) -> WatermarkStatus {
        self.inner.watermark.status()
    }

    /// Downloads the watermark's files when they are missing (app start, or the user asks to try again).
    pub async fn prepare_watermark(&self) {
        self.inner
            .watermark
            .prepare(&self.inner.http, &self.inner.shutdown)
            .await;
    }

    /// Checks a picture file the user chose in the shell's dialog.
    pub async fn check_watermark_file(&self, path: PathBuf) -> Result<WatermarkCheck> {
        let file_name = path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        let this = self.clone();
        tokio::task::spawn_blocking(move || {
            let bytes = read_capped(&path)
                .map_err(|e| BackendError::Invalid(format!("cannot read the picture: {e}")))?;
            this.check_watermark_bytes(file_name, &bytes)
        })
        .await
        .map_err(internal)?
    }

    /// Checks a gallery picture (for example one brought in from outside).
    pub async fn check_watermark_image(&self, name: String) -> Result<WatermarkCheck> {
        if !images::is_valid_name(&name) || images::is_video(&name) || images::is_audio(&name) {
            return Err(BackendError::Invalid(format!("invalid image name {name}")));
        }
        let this = self.clone();
        tokio::task::spawn_blocking(move || {
            let bytes = this
                .inner
                .files
                .read_original(&name)
                .ok_or_else(|| BackendError::NotFound(format!("no picture {name}")))?;
            this.check_watermark_bytes(name, &bytes)
        })
        .await
        .map_err(internal)?
    }

    fn check_watermark_bytes(&self, file_name: String, bytes: &[u8]) -> Result<WatermarkCheck> {
        images::check_limits(bytes).map_err(|e| BackendError::Invalid(e.to_string()))?;
        // The watermark is looked for only when its files are here; the other marks are read either way.
        let watermarker = match self.watermark_status() {
            WatermarkStatus::Ready => self.inner.watermark.watermarker().ok(),
            _ => None,
        };
        let identity = self.signing_identity(false)?;
        let found = provenance::inspect(bytes, watermarker.as_deref(), identity.as_ref());
        let id = match found.watermark {
            Some(payload::Decoded::Novira(id)) => Some(id),
            _ => None,
        };
        let record = match id {
            Some(id) => self
                .db()
                .get::<WatermarkRecord>(Table::Watermarks, &payload::id_hex(id))?,
            None => None,
        };
        let in_gallery = record
            .as_ref()
            .is_some_and(|r| self.state().images.iter().any(|i| i.name == r.image_name));
        let c = &found.credentials;
        Ok(WatermarkCheck {
            file_name: file_name.chars().take(260).collect(),
            watermark_checked: found.watermark_checked,
            watermark_found: found.watermark.is_some(),
            novira_marker: id.is_some(),
            watermark_id: id.map(payload::id_hex),
            original_name: record.as_ref().map(|r| r.image_name.clone()),
            original_in_gallery: in_gallery,
            exported_at: record.as_ref().map(|r| r.exported_at),
            credentials_present: c.present,
            credentials_valid: c.valid,
            credentials_trusted: c.trusted,
            credentials_ai: c.ai,
            credentials_signer: c.signer.as_ref().map(|s| s.chars().take(200).collect()),
            credentials_this_app: c.this_app,
            iptc_ai: found
                .iptc_source
                .as_deref()
                .is_some_and(provenance::xmp::is_ai_source),
        })
    }
}

/// Reads a file the user chose, refusing one over the gallery's size limit before reading it all.
fn read_capped(path: &Path) -> std::io::Result<Vec<u8>> {
    let file = std::fs::File::open(path)?;
    let limit = images::MAX_IMAGE_BYTES as u64;
    if file.metadata()?.len() > limit {
        return Err(std::io::Error::other("the file is too large"));
    }
    let mut bytes = Vec::new();
    file.take(limit + 1).read_to_end(&mut bytes)?;
    if bytes.len() as u64 > limit {
        return Err(std::io::Error::other("the file is too large"));
    }
    Ok(bytes)
}
