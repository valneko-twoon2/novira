//! The files the watermark needs (TrustMark's P encoder and decoder, and the ONNX Runtime DLL), pinned by size and
//! SHA-256 in `files.json`. They are looked for next to the app first (`<exe folder>/resources/trustmark`,
//! where a packaged build puts them) and then in `<data folder>/models/trustmark`, where the app downloads what is
//! missing: https only, from the hosts in `endpoints.rs`, with a size cap, into a temporary name that is renamed only
//! after the hash matched.
use crate::endpoints::{self, Service};
use crate::models::install::host_is;
use futures_util::StreamExt;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tokio_util::sync::CancellationToken;

/// The folder under `<data folder>/models` and under `<exe folder>/resources`.
pub const DIR: &str = "trustmark";
pub const ENCODER: &str = "encoder_P.onnx";
pub const DECODER: &str = "decoder_P.onnx";
pub const RUNTIME: &str = "onnxruntime.dll";

#[derive(Debug, Clone, Deserialize)]
pub struct Archive {
    pub bytes: u64,
    pub sha256: String,
    /// The path of the file inside the zip.
    pub entry: String,
}

/// One pinned file.
#[derive(Debug, Clone, Deserialize)]
pub struct PinnedFile {
    pub name: String,
    /// `trustmark` or `github`, resolved through `endpoints.rs`.
    pub service: String,
    pub path: String,
    pub bytes: u64,
    pub sha256: String,
    /// Set when the download is a zip that holds the file.
    pub archive: Option<Archive>,
}

impl PinnedFile {
    fn service(&self) -> Option<Service> {
        match self.service.as_str() {
            "trustmark" => Some(Service::TrustMark),
            "github" => Some(Service::GitHub),
            _ => None,
        }
    }

    /// The address to download, on the service's real host (or its loopback stand-in in a debug build).
    pub fn url(&self) -> Option<String> {
        Some(endpoints::url(self.service()?, &self.path))
    }

    /// Bytes the download transfers.
    pub fn download_bytes(&self) -> u64 {
        self.archive.as_ref().map_or(self.bytes, |a| a.bytes)
    }
}

#[derive(Deserialize)]
struct List {
    files: Vec<PinnedFile>,
}

/// The pinned files, read once from `files.json` (compiled in).
pub fn pinned() -> &'static [PinnedFile] {
    static LIST: OnceLock<Vec<PinnedFile>> = OnceLock::new();
    LIST.get_or_init(|| {
        serde_json::from_str::<List>(include_str!("files.json"))
            .expect("files.json is valid")
            .files
    })
}

fn pinned_file(name: &str) -> &'static PinnedFile {
    pinned()
        .iter()
        .find(|f| f.name == name)
        .expect("every needed file is pinned")
}

/// Where the files are on this PC: the models' folder and the runtime DLL. `None` while one is missing.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Found {
    pub models: PathBuf,
    pub runtime: PathBuf,
}

/// Whether `path` is a regular file of the pinned size (cheap; the hash is checked when the file is loaded).
fn has_size(path: &Path, bytes: u64) -> bool {
    std::fs::metadata(path).is_ok_and(|m| m.is_file() && m.len() == bytes)
}

/// The folders searched, in order: the one next to the app, then the data folder's.
pub fn search_dirs(bundled: Option<&Path>, data_dir: &Path) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = bundled.map(Path::to_path_buf).into_iter().collect();
    dirs.push(download_dir(data_dir));
    dirs
}

/// The folder downloads go to.
pub fn download_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("models").join(DIR)
}

/// The first folder holding both models, and the first holding the runtime, each at its pinned size.
pub fn locate(dirs: &[PathBuf]) -> Option<Found> {
    let (enc, dec, rt) = (
        pinned_file(ENCODER),
        pinned_file(DECODER),
        pinned_file(RUNTIME),
    );
    let models = dirs
        .iter()
        .find(|d| has_size(&d.join(ENCODER), enc.bytes) && has_size(&d.join(DECODER), dec.bytes))?;
    let runtime = dirs.iter().find(|d| has_size(&d.join(RUNTIME), rt.bytes))?;
    Some(Found {
        models: models.clone(),
        runtime: runtime.join(RUNTIME),
    })
}

/// The pinned files missing from every folder (what a download must fetch into `download_dir`).
pub fn missing(dirs: &[PathBuf]) -> Vec<&'static PinnedFile> {
    let has_models = dirs.iter().any(|d| {
        has_size(&d.join(ENCODER), pinned_file(ENCODER).bytes)
            && has_size(&d.join(DECODER), pinned_file(DECODER).bytes)
    });
    pinned()
        .iter()
        .filter(|f| {
            if f.name == RUNTIME {
                !dirs.iter().any(|d| has_size(&d.join(RUNTIME), f.bytes))
            } else {
                !has_models
            }
        })
        .collect()
}

/// SHA-256 of a file, as lowercase hex.
pub fn sha256_file(path: &Path) -> std::io::Result<String> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex(&hasher.finalize()))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Checks the hashes of the files `found` names; an error names the first that does not match.
pub fn verify(found: &Found) -> Result<(), String> {
    for (path, name) in [
        (found.models.join(ENCODER), ENCODER),
        (found.models.join(DECODER), DECODER),
        (found.runtime.clone(), RUNTIME),
    ] {
        let hash = sha256_file(&path).map_err(|e| format!("cannot read {name}: {e}"))?;
        if hash != pinned_file(name).sha256 {
            return Err(format!("{name} is damaged or not the expected file"));
        }
    }
    Ok(())
}

#[derive(Debug, thiserror::Error, PartialEq)]
pub enum FetchError {
    #[error("cancelled")]
    Cancelled,
    #[error("{0}")]
    Failed(String),
}

fn failed(e: impl std::fmt::Display) -> FetchError {
    FetchError::Failed(e.to_string())
}

/// Whether `url` may be downloaded from: https on the service's host, or (debug builds) its loopback stand-in.
fn allowed(url: &str, file: &PinnedFile) -> bool {
    let Ok(u) = reqwest::Url::parse(url) else {
        return false;
    };
    let Some(service) = file.service() else {
        return false;
    };
    let real = reqwest::Url::parse(service.origin()).expect("origins are valid");
    let host = real.host_str().unwrap_or_default();
    (u.scheme() == "https" && host_is(&u, host) && u.host_str() == Some(host))
        || (cfg!(debug_assertions)
            && u.scheme() == "http"
            && matches!(u.host_str(), Some("127.0.0.1" | "localhost")))
}

/// Streams `url` into `dest` (a temporary name), at most `cap` bytes, and returns the SHA-256 of what arrived.
async fn stream_to(
    http: &reqwest::Client,
    url: &str,
    dest: &Path,
    cap: u64,
    cancel: &CancellationToken,
    progress: &mut (dyn FnMut(u64) + Send),
) -> Result<String, FetchError> {
    let res = tokio::select! {
        _ = cancel.cancelled() => return Err(FetchError::Cancelled),
        r = http.get(url).send() => r.map_err(|e| failed(format!("download failed: {e}")))?,
    };
    if !res.status().is_success() {
        return Err(failed(format!("download answered {}", res.status())));
    }
    if res.content_length().is_some_and(|n| n > cap) {
        return Err(failed("the download is larger than expected"));
    }
    let mut file = std::fs::File::create(dest).map_err(failed)?;
    let mut hasher = Sha256::new();
    let mut got = 0u64;
    let mut stream = res.bytes_stream();
    loop {
        let chunk = tokio::select! {
            _ = cancel.cancelled() => return Err(FetchError::Cancelled),
            c = stream.next() => c,
        };
        let Some(chunk) = chunk else { break };
        let chunk = chunk.map_err(|e| failed(format!("download interrupted: {e}")))?;
        got += chunk.len() as u64;
        if got > cap {
            return Err(failed("the download is larger than expected"));
        }
        hasher.update(&chunk);
        file.write_all(&chunk).map_err(failed)?;
        progress(chunk.len() as u64);
    }
    file.sync_all().map_err(failed)?;
    Ok(hex(&hasher.finalize()))
}

/// Takes `entry` out of the zip at `zip` into `dest`, at most `cap` bytes, and returns its SHA-256.
fn extract(zip: &Path, entry: &str, dest: &Path, cap: u64) -> Result<String, FetchError> {
    let file = std::fs::File::open(zip).map_err(failed)?;
    let mut archive = zip::ZipArchive::new(file).map_err(failed)?;
    let mut inner = archive
        .by_name(entry)
        .map_err(|_| failed("the archive does not hold the runtime"))?;
    let mut out = std::fs::File::create(dest).map_err(failed)?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    let mut got = 0u64;
    loop {
        let n = inner.read(&mut buf).map_err(failed)?;
        if n == 0 {
            break;
        }
        got += n as u64;
        if got > cap {
            return Err(failed("the runtime in the archive is larger than expected"));
        }
        hasher.update(&buf[..n]);
        out.write_all(&buf[..n]).map_err(failed)?;
    }
    out.sync_all().map_err(failed)?;
    Ok(hex(&hasher.finalize()))
}

/// Downloads one pinned file into `dir`. The file appears under its own name only once its size and hash match;
/// temporary files are removed on any failure.
pub async fn fetch(
    http: &reqwest::Client,
    file: &PinnedFile,
    dir: &Path,
    cancel: &CancellationToken,
    progress: &mut (dyn FnMut(u64) + Send),
) -> Result<(), FetchError> {
    let url = file
        .url()
        .ok_or_else(|| failed(format!("no address for {}", file.name)))?;
    if !allowed(&url, file) {
        return Err(failed(format!("refused address for {}", file.name)));
    }
    std::fs::create_dir_all(dir).map_err(failed)?;
    let part = dir.join(format!("{}.part", file.name));
    let _hold = crate::unfinished::hold(&part);
    let result = async {
        match &file.archive {
            None => {
                let hash = stream_to(http, &url, &part, file.bytes, cancel, progress).await?;
                if hash != file.sha256
                    || std::fs::metadata(&part).map_err(failed)?.len() != file.bytes
                {
                    return Err(failed(format!(
                        "{} did not match its pinned hash",
                        file.name
                    )));
                }
            }
            Some(archive) => {
                let zip = dir.join(format!("{}.zip.part", file.name));
                let _zip_hold = crate::unfinished::hold(&zip);
                let outcome = async {
                    let hash = stream_to(http, &url, &zip, archive.bytes, cancel, progress).await?;
                    if hash != archive.sha256 {
                        return Err(failed("the runtime archive did not match its pinned hash"));
                    }
                    let (zip, entry, part, cap) =
                        (zip.clone(), archive.entry.clone(), part.clone(), file.bytes);
                    let hash =
                        tokio::task::spawn_blocking(move || extract(&zip, &entry, &part, cap))
                            .await
                            .map_err(failed)??;
                    if hash != file.sha256 {
                        return Err(failed(format!(
                            "{} did not match its pinned hash",
                            file.name
                        )));
                    }
                    Ok(())
                }
                .await;
                let _ = std::fs::remove_file(&zip);
                outcome?;
            }
        }
        std::fs::rename(&part, dir.join(&file.name)).map_err(failed)
    }
    .await;
    if result.is_err() {
        let _ = std::fs::remove_file(&part);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_pinned_list_has_the_three_files_with_hashes_and_sizes() {
        let names: Vec<&str> = pinned().iter().map(|f| f.name.as_str()).collect();
        assert_eq!(names, [ENCODER, DECODER, RUNTIME]);
        for f in pinned() {
            assert_eq!(f.sha256.len(), 64, "{}", f.name);
            assert!(f
                .sha256
                .bytes()
                .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()));
            assert!(f.bytes > 1_000_000 && f.bytes < 100_000_000, "{}", f.name);
            assert!(f.service().is_some(), "{}", f.name);
            assert!(f.path.starts_with('/'));
            let url = f.url().unwrap();
            assert!(allowed(&url, f), "{url}");
        }
        let rt = pinned_file(RUNTIME);
        let archive = rt.archive.as_ref().unwrap();
        assert!(archive.bytes > rt.bytes);
        assert!(archive.entry.ends_with("/lib/onnxruntime.dll"));
        assert_eq!(rt.download_bytes(), archive.bytes);
    }

    #[test]
    fn the_real_addresses_are_https_on_their_exact_hosts() {
        let enc = pinned_file(ENCODER);
        assert_eq!(
            format!("{}{}", Service::TrustMark.origin(), enc.path),
            "https://cai-watermark.adobe.net/watermarking/trustmark-models/encoder_P.onnx"
        );
        let rt = pinned_file(RUNTIME);
        assert!(format!("{}{}", Service::GitHub.origin(), rt.path)
            .starts_with("https://github.com/microsoft/onnxruntime/releases/download/v1.22.0/"));
    }

    #[test]
    fn other_hosts_and_plain_http_are_refused() {
        let f = pinned_file(ENCODER);
        for bad in [
            "http://cai-watermark.adobe.net/x",
            "https://cai-watermark.adobe.net.evil.example/x",
            "https://evil.example/cai-watermark.adobe.net/x",
            "https://x.cai-watermark.adobe.net/x",
            "https://github.com/x",
            "ftp://cai-watermark.adobe.net/x",
            "not a url",
        ] {
            assert!(!allowed(bad, f), "{bad}");
        }
        assert!(allowed("https://cai-watermark.adobe.net/x", f));
        let rt = pinned_file(RUNTIME);
        assert!(allowed("https://github.com/x", rt));
        assert!(!allowed("https://cai-watermark.adobe.net/x", rt));
    }

    #[test]
    fn files_are_found_by_size_in_the_first_folder_that_has_them() {
        let a = tempfile::tempdir().unwrap();
        let b = tempfile::tempdir().unwrap();
        let dirs = vec![a.path().to_path_buf(), b.path().to_path_buf()];
        assert_eq!(locate(&dirs), None);
        assert_eq!(missing(&dirs).len(), 3);
        let sized = |dir: &Path, name: &str, delta: i64| {
            let f = std::fs::File::create(dir.join(name)).unwrap();
            f.set_len((pinned_file(name).bytes as i64 + delta) as u64)
                .unwrap();
        };
        // Models in the second folder, the runtime in the first.
        sized(b.path(), ENCODER, 0);
        sized(b.path(), DECODER, 0);
        assert_eq!(locate(&dirs), None);
        assert_eq!(
            missing(&dirs)
                .iter()
                .map(|f| f.name.as_str())
                .collect::<Vec<_>>(),
            [RUNTIME]
        );
        sized(a.path(), RUNTIME, 0);
        assert_eq!(
            locate(&dirs),
            Some(Found {
                models: b.path().to_path_buf(),
                runtime: a.path().join(RUNTIME)
            })
        );
        assert!(missing(&dirs).is_empty());
        // A model of the wrong size does not count; one model alone is not a pair.
        let c = tempfile::tempdir().unwrap();
        sized(c.path(), ENCODER, -1);
        sized(c.path(), DECODER, 0);
        sized(c.path(), RUNTIME, 1);
        let only_c = vec![c.path().to_path_buf()];
        assert_eq!(locate(&only_c), None);
        assert_eq!(missing(&only_c).len(), 3);
    }

    #[test]
    fn a_file_with_the_right_size_but_wrong_content_fails_verification() {
        let dir = tempfile::tempdir().unwrap();
        for name in [ENCODER, DECODER, RUNTIME] {
            let f = std::fs::File::create(dir.path().join(name)).unwrap();
            f.set_len(pinned_file(name).bytes).unwrap();
        }
        let found = locate(&[dir.path().to_path_buf()]).unwrap();
        let err = verify(&found).unwrap_err();
        assert!(err.contains(ENCODER), "{err}");
    }

    #[test]
    fn search_dirs_put_the_bundled_folder_first() {
        let data = Path::new("D:/data");
        assert_eq!(
            search_dirs(Some(Path::new("C:/app/resources/trustmark")), data),
            vec![
                PathBuf::from("C:/app/resources/trustmark"),
                data.join("models").join(DIR)
            ]
        );
        assert_eq!(search_dirs(None, data), vec![data.join("models").join(DIR)]);
    }

    #[test]
    fn sha256_of_a_file_is_lowercase_hex() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("x");
        std::fs::write(&p, b"abc").unwrap();
        assert_eq!(
            sha256_file(&p).unwrap(),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
}
