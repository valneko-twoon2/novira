//! Marks on exported copies that say "made with AI", and the check that reads them back:
//!
//! - an invisible TrustMark watermark (`watermark`) carrying a novira marker and a random id (`payload`), whose
//!   files are pinned and fetched by `files`;
//! - the IPTC digital source type in XMP (`xmp`);
//! - signed C2PA content credentials (`credentials`).
//!
//! `Tools` keeps the state of the watermark's files on this PC and the loaded model; the service decides when to
//! download, export and check.
pub mod credentials;
pub mod files;
pub mod payload;
pub mod watermark;
pub mod xmp;

use crate::media::export::ExportFormat;
use crate::sync::LockExt;
use crate::types::WatermarkStatus;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tokio_util::sync::CancellationToken;
use watermark::Watermarker;

/// One exported watermarked copy, kept in the database under its id (12 hex digits) so a check can name the
/// gallery picture it came from.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatermarkRecord {
    pub id: String,
    pub image_name: String,
    /// Milliseconds since the Unix epoch.
    pub exported_at: i64,
    pub format: ExportFormat,
}

struct State {
    status: WatermarkStatus,
    loaded: Option<Arc<Watermarker>>,
    downloading: bool,
}

/// The watermark's files on this PC: where they are, a download that is running, and the loaded model.
pub struct Tools {
    dirs: Vec<PathBuf>,
    download_dir: PathBuf,
    state: Mutex<State>,
}

impl Tools {
    /// `bundled` is the folder next to the app that a packaged build fills (`<exe folder>/resources/trustmark`).
    pub fn new(bundled: Option<PathBuf>, data_dir: &Path) -> Self {
        let dirs = files::search_dirs(bundled.as_deref(), data_dir);
        let status = if files::locate(&dirs).is_some() {
            WatermarkStatus::Ready
        } else {
            WatermarkStatus::Missing
        };
        Self {
            dirs,
            download_dir: files::download_dir(data_dir),
            state: Mutex::new(State {
                status,
                loaded: None,
                downloading: false,
            }),
        }
    }

    pub fn status(&self) -> WatermarkStatus {
        self.state.lock_safe().status.clone()
    }

    fn set(&self, status: WatermarkStatus) {
        self.state.lock_safe().status = status;
    }

    /// Downloads whatever is missing. Does nothing when the files are there or a download is already running; a
    /// failure is kept as the status (with its message) until the next try.
    pub async fn prepare(&self, http: &reqwest::Client, cancel: &CancellationToken) {
        let todo = files::missing(&self.dirs);
        {
            let mut st = self.state.lock_safe();
            if st.downloading {
                return;
            }
            if todo.is_empty() {
                st.status = WatermarkStatus::Ready;
                return;
            }
            st.downloading = true;
        }
        let total: u64 = todo.iter().map(|f| f.download_bytes()).sum();
        let mut done = 0u64;
        self.set(WatermarkStatus::Downloading { done, total });
        let mut outcome = Ok(());
        for file in todo {
            let mut progress = |n: u64| {
                done += n;
                self.set(WatermarkStatus::Downloading {
                    done: done.min(total),
                    total,
                });
            };
            if let Err(e) =
                files::fetch(http, file, &self.download_dir, cancel, &mut progress).await
            {
                outcome = Err(e);
                break;
            }
        }
        let mut st = self.state.lock_safe();
        st.downloading = false;
        st.status = match outcome {
            Ok(()) if files::locate(&self.dirs).is_some() => WatermarkStatus::Ready,
            Ok(()) => WatermarkStatus::Failed {
                message: "the watermark files are still missing".into(),
            },
            Err(files::FetchError::Cancelled) => WatermarkStatus::Missing,
            Err(e) => {
                crate::applog::warn("watermark", format!("download failed: {e}"));
                WatermarkStatus::Failed {
                    message: e.to_string(),
                }
            }
        };
    }

    /// The loaded model, loading it on first use (checks the hashes; about a second). Blocking: call it off the
    /// async threads. A file that fails its hash is removed from the download folder so the next start fetches it.
    pub fn watermarker(&self) -> Result<Arc<Watermarker>, String> {
        if let Some(w) = self.state.lock_safe().loaded.clone() {
            return Ok(w);
        }
        let Some(found) = files::locate(&self.dirs) else {
            return Err(match self.status() {
                WatermarkStatus::Downloading { .. } => {
                    "the watermark files are still downloading; try again when they are ready"
                        .into()
                }
                _ => "the watermark files are not on this PC yet".into(),
            });
        };
        match Watermarker::load(&found) {
            Ok(w) => {
                let mut st = self.state.lock_safe();
                st.status = WatermarkStatus::Ready;
                Ok(st.loaded.get_or_insert(w).clone())
            }
            Err(e) => {
                if files::verify(&found).is_err() {
                    self.discard_damaged();
                }
                self.set(WatermarkStatus::Failed { message: e.clone() });
                Err(e)
            }
        }
    }

    /// Removes downloaded files whose hash does not match (never the ones next to the app).
    fn discard_damaged(&self) {
        for f in files::pinned() {
            let path = self.download_dir.join(&f.name);
            if files::sha256_file(&path).is_ok_and(|h| h != f.sha256) {
                let _ = std::fs::remove_file(&path);
            }
        }
    }
}

/// What a check found in a file, before the database is asked about the id.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Findings {
    /// The watermark was looked for (the model was available and the picture could be read).
    pub watermark_checked: bool,
    pub watermark: Option<payload::Decoded>,
    pub credentials: credentials::Found,
    /// The IPTC digital source type in the file's XMP, if any.
    pub iptc_source: Option<String>,
}

/// The MIME type C2PA uses for an export format.
pub fn mime(format: image::ImageFormat) -> Option<&'static str> {
    match format {
        image::ImageFormat::Png => Some("image/png"),
        image::ImageFormat::Jpeg => Some("image/jpeg"),
        image::ImageFormat::WebP => Some("image/webp"),
        _ => None,
    }
}

/// Labels an encoded copy: XMP first, then the signed manifest over the finished bytes (in that order, because the
/// manifest's hash covers everything else in the file). `id` is the watermark's id when the pixels carry one.
pub fn label(
    encoded: &[u8],
    format: image::ImageFormat,
    identity: &credentials::Identity,
    id: Option<u64>,
) -> Result<Vec<u8>, String> {
    let mime = mime(format).ok_or("this format cannot carry content credentials")?;
    let with_xmp = xmp::add(encoded, format)?;
    let value = id.map(payload::soft_binding_value);
    credentials::sign(
        &with_xmp,
        mime,
        identity,
        value.as_deref().map(|v| (watermark::SOFT_BINDING_ALG, v)),
    )
}

/// Reads every mark of a file (outside data: the caller has checked its size with `images::check_limits`).
pub fn inspect(
    bytes: &[u8],
    watermarker: Option<&Watermarker>,
    identity: Option<&credentials::Identity>,
) -> Findings {
    let format = image::guess_format(bytes).ok();
    let mut findings = Findings {
        iptc_source: xmp::digital_source_type(bytes),
        credentials: format
            .and_then(mime)
            .map(|m| credentials::read(bytes, m, identity))
            .unwrap_or_default(),
        ..Findings::default()
    };
    if let (Some(w), Ok(picture)) = (watermarker, image::load_from_memory(bytes)) {
        if let Ok(found) = w.read(picture) {
            findings.watermark_checked = true;
            findings.watermark = found;
        }
    }
    findings
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{DynamicImage, ImageFormat, RgbImage};

    fn encoded(format: ImageFormat) -> Vec<u8> {
        let mut out = std::io::Cursor::new(Vec::new());
        DynamicImage::ImageRgb8(RgbImage::from_pixel(40, 30, image::Rgb([9, 99, 199])))
            .write_to(&mut out, format)
            .unwrap();
        out.into_inner()
    }

    #[test]
    fn a_labelled_copy_carries_the_iptc_code_and_credentials_with_the_watermark_id() {
        let me = credentials::Identity::generate().unwrap();
        for format in [ImageFormat::Png, ImageFormat::Jpeg, ImageFormat::WebP] {
            let out = label(&encoded(format), format, &me, Some(42)).unwrap();
            let f = inspect(&out, None, Some(&me));
            assert_eq!(
                f.iptc_source.as_deref(),
                Some("trainedAlgorithmicMedia"),
                "{format:?}"
            );
            assert!(
                f.credentials.valid && f.credentials.ai && f.credentials.this_app,
                "{format:?}"
            );
            assert_eq!(
                f.credentials.soft_binding,
                Some(payload::soft_binding_value(42)),
                "{format:?}"
            );
            assert!(!f.watermark_checked, "no model was given");
        }
    }

    #[test]
    fn credentials_without_a_watermark_have_no_soft_binding() {
        let me = credentials::Identity::generate().unwrap();
        let out = label(&encoded(ImageFormat::Png), ImageFormat::Png, &me, None).unwrap();
        let f = inspect(&out, None, Some(&me));
        assert!(f.credentials.present);
        assert_eq!(f.credentials.soft_binding, None);
    }

    #[test]
    fn a_plain_file_and_garbage_show_nothing() {
        assert_eq!(
            inspect(&encoded(ImageFormat::Jpeg), None, None),
            Findings::default()
        );
        assert_eq!(inspect(b"garbage", None, None), Findings::default());
        assert!(label(
            b"garbage",
            ImageFormat::Png,
            &credentials::Identity::generate().unwrap(),
            None
        )
        .is_err());
        assert!(label(
            &encoded(ImageFormat::Bmp),
            ImageFormat::Bmp,
            &credentials::Identity::generate().unwrap(),
            None
        )
        .is_err());
    }

    #[test]
    fn tools_without_files_are_missing_and_refuse_to_load() {
        let data = tempfile::tempdir().unwrap();
        let tools = Tools::new(None, data.path());
        assert_eq!(tools.status(), WatermarkStatus::Missing);
        let err = tools.watermarker().unwrap_err();
        assert!(err.contains("not on this PC"), "{err}");
    }

    #[test]
    fn tools_with_files_of_the_right_size_report_ready_but_a_wrong_hash_fails_and_is_removed() {
        let data = tempfile::tempdir().unwrap();
        let dir = files::download_dir(data.path());
        std::fs::create_dir_all(&dir).unwrap();
        for f in files::pinned() {
            std::fs::File::create(dir.join(&f.name))
                .unwrap()
                .set_len(f.bytes)
                .unwrap();
        }
        let tools = Tools::new(None, data.path());
        assert_eq!(tools.status(), WatermarkStatus::Ready);
        let err = tools.watermarker().unwrap_err();
        assert!(err.contains("damaged"), "{err}");
        assert!(matches!(tools.status(), WatermarkStatus::Failed { .. }));
        assert!(files::pinned().iter().all(|f| !dir.join(&f.name).exists()));
    }
}
