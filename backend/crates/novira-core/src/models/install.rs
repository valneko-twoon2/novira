//! Model install sources: parsing, resolving to a download (or a local file), downloading and placing the file.
use super::layout::{self, category_for_kind};
use crate::types::ModelType;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio_util::sync::CancellationToken;

/// The Civitai REST API (a loopback address in a debug build when overridden, see `endpoints`).
pub fn civitai_api() -> String {
    crate::endpoints::url(crate::endpoints::Service::Civitai, "/api/v1")
}

#[derive(Debug, Clone, PartialEq)]
pub enum Source {
    /// `civitai:<modelId>/<versionId>-<fileId>` (what the Browse tab sends).
    CivitaiFile {
        version_id: u64,
        file_id: u64,
    },
    /// `https://civitai.com/models/<id>[?modelVersionId=<v>]`
    CivitaiPage {
        model_id: u64,
        version_id: Option<u64>,
    },
    /// `owner/repo::path/in/repo` on Hugging Face.
    HuggingFace {
        repo: String,
        file: String,
    },
    Url(String),
    Local(PathBuf),
}

/// Whether the URL's host is `domain` or a subdomain of it. The whole host is compared: a name that merely contains the
/// domain (`civitai.com.evil.example`, or `evil.example/civitai.com`) does not match.
pub fn host_is(url: &reqwest::Url, domain: &str) -> bool {
    url.host_str().is_some_and(|h| {
        let h = h.to_ascii_lowercase();
        h == domain
            || h.strip_suffix(domain)
                .is_some_and(|rest| rest.ends_with('.'))
    })
}

/// Whether a download address the Civitai API gave may carry the Civitai key: `https` on `civitai.com`. A debug build that
/// points the API at a fake server on this PC (see `endpoints`) also accepts that server's own origin; in a release build the
/// API address is always the real one, so only the first rule can match.
fn is_civitai_download(url: &str) -> bool {
    let Ok(u) = reqwest::Url::parse(url) else {
        return false;
    };
    if u.scheme() == "https" && host_is(&u, "civitai.com") {
        return true;
    }
    reqwest::Url::parse(&civitai_api()).is_ok_and(|api| {
        api.scheme() == "http"
            && u.scheme() == "http"
            && api.host_str() == u.host_str()
            && api.port() == u.port()
    })
}

/// Sites whose pages the app opens in the browser: where models come from, where extensions are hosted, and the homepages
/// of the open-source software listed in the about dialog.
const SOURCE_SITES: &[&str] = &[
    "civitai.com",
    "huggingface.co",
    "github.com",
    "gitlab.com",
    "codeberg.org",
    "python.org",
    "7-zip.org",
];

/// Whether `url` is an https address on one of those sites (the whole host is compared, no credentials in it).
pub fn is_source_page(url: &str) -> bool {
    url.len() <= 500
        && reqwest::Url::parse(url).is_ok_and(|u| {
            u.scheme() == "https"
                && u.username().is_empty()
                && SOURCE_SITES.iter().any(|site| host_is(&u, site))
        })
}

fn is_loopback(url: &reqwest::Url) -> bool {
    matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"))
}

fn is_name_part(part: &str) -> bool {
    !part.is_empty()
        && part.len() <= 100
        && !part.bytes().all(|b| b == b'.')
        && part
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.'))
}

/// `owner/repo` with plain characters only, so it can be put in a URL as it is.
pub fn is_hugging_face_repo(repo: &str) -> bool {
    let mut parts = repo.split('/');
    matches!((parts.next(), parts.next(), parts.next()), (Some(a), Some(b), None) if is_name_part(a) && is_name_part(b))
}

/// A path inside a repository: folders and a file name of plain characters, no `..`.
pub fn is_repo_file_path(file: &str) -> bool {
    file.len() <= 300 && file.split('/').all(is_name_part)
}

pub fn parse_source(source: &str) -> Result<Source, String> {
    let s = source.trim();
    if s.is_empty() {
        return Err("Empty model source".into());
    }
    if let Some(rest) = s.strip_prefix("civitai:") {
        let file_part = rest.split('/').nth(1).ok_or("Malformed Civitai source")?;
        let (v, f) = file_part
            .split_once('-')
            .ok_or("Malformed Civitai source")?;
        return Ok(Source::CivitaiFile {
            version_id: v.parse().map_err(|_| "Malformed Civitai source")?,
            file_id: f.parse().map_err(|_| "Malformed Civitai source")?,
        });
    }
    if s.starts_with("http://") || s.starts_with("https://") {
        let url = reqwest::Url::parse(s).map_err(|e| format!("Invalid URL: {e}"))?;
        // A model is code-adjacent data: plain HTTP could be swapped on the way, so only HTTPS (or this PC) is accepted.
        if url.scheme() != "https" && !is_loopback(&url) {
            return Err("Model downloads need an https:// address".into());
        }
        if host_is(&url, "civitai.com") {
            let mut segs = url.path_segments().into_iter().flatten();
            if segs.next() == Some("models") {
                if let Some(id) = segs.next().and_then(|id| id.parse().ok()) {
                    let version_id = url
                        .query_pairs()
                        .find(|(k, _)| k == "modelVersionId")
                        .and_then(|(_, v)| v.parse().ok());
                    return Ok(Source::CivitaiPage {
                        model_id: id,
                        version_id,
                    });
                }
            }
        }
        return Ok(Source::Url(s.to_string()));
    }
    if let Some((repo, file)) = s.split_once("::") {
        if is_hugging_face_repo(repo) && is_repo_file_path(file) {
            return Ok(Source::HuggingFace {
                repo: repo.into(),
                file: file.into(),
            });
        }
        return Err(format!("Unsupported model source: {s}"));
    }
    let path = PathBuf::from(s);
    if path.is_absolute() {
        return Ok(Source::Local(path));
    }
    if s.split('/').count() == 2 {
        return Err("Hugging Face repositories in diffusers format are not supported; name one file as owner/repo::file".into());
    }
    Err(format!("Unsupported model source: {s}"))
}

#[derive(Debug, Clone, PartialEq)]
pub struct Resolved {
    pub url: String,
    pub file_name: String,
    pub kind: Option<ModelType>,
    pub total_bytes: u64,
    pub civitai: bool,
    /// The file is on huggingface.co, so a Hugging Face token (when set) is sent.
    pub hugging_face: bool,
    /// The model's own picture, when the site says which (Civitai does with the version).
    pub cover: Option<String>,
    /// The cover is a mature picture (every picture of the version is), shown blurred.
    pub cover_mature: bool,
    /// Every picture of the version (the cover first), when the site lists them.
    pub covers: Vec<String>,
    /// The model's page on the site.
    pub page_url: Option<String>,
    /// Words that activate a LoRA, as the author lists them.
    pub trigger_words: Vec<String>,
}

/// The type of a downloaded file: the user's own choice first, then what the tensor names say, then what the site
/// declared. A site's type is a label the uploader picked (an IP-Adapter filed under "Checkpoint" would land among the
/// main models), while the tensors are what the file really holds.
pub fn pick_kind(
    hint: Option<ModelType>,
    from_header: Option<ModelType>,
    declared: Option<ModelType>,
) -> Option<ModelType> {
    hint.or(from_header).or(declared)
}

pub fn civitai_kind(t: &str) -> Option<ModelType> {
    Some(match t {
        "Checkpoint" => ModelType::Main,
        "LORA" | "LoCon" | "DoRA" => ModelType::Lora,
        "VAE" => ModelType::Vae,
        "Controlnet" => ModelType::Controlnet,
        "Upscaler" => ModelType::SpandrelImageToImage,
        _ => return None,
    })
}

fn file_name_of_url(url: &str) -> String {
    let path = url.split(['?', '#']).next().unwrap_or(url);
    path.rsplit('/')
        .next()
        .filter(|s| !s.is_empty())
        .unwrap_or("model.safetensors")
        .to_string()
}

/// Only plain file names are accepted for files we create.
pub fn safe_file_name(name: &str) -> Option<String> {
    let name = name.trim();
    let ok = !name.is_empty()
        && name.len() <= 200
        && !name.starts_with('.')
        && !name.contains(['/', '\\', ':', '*', '?', '"', '<', '>', '|'])
        && !name.chars().any(char::is_control)
        && !crate::is_reserved_device_name(name)
        && layout::is_model_file(Path::new(name));
    ok.then(|| name.to_string())
}

async fn get_json(
    http: &reqwest::Client,
    url: &str,
    api_key: Option<&str>,
) -> Result<serde_json::Value, String> {
    let mut req = http.get(url);
    if let Some(k) = api_key {
        req = req.bearer_auth(k);
    }
    let res = req
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("{url} answered {}", res.status()));
    }
    res.json()
        .await
        .map_err(|e| format!("Unexpected response: {e}"))
}

fn civitai_file(
    version: &serde_json::Value,
    model_type: Option<&str>,
    file_id: Option<u64>,
) -> Result<Resolved, String> {
    let files = version["files"]
        .as_array()
        .ok_or("The Civitai version has no files")?;
    let file = match file_id {
        Some(id) => files.iter().find(|f| f["id"].as_u64() == Some(id)),
        None => files
            .iter()
            .find(|f| f["primary"].as_bool() == Some(true))
            .or(files.first()),
    }
    .ok_or("The Civitai file was not found")?;
    let model_type = model_type.or_else(|| version["model"]["type"].as_str());
    // Files of type "VAE" or "Config" inside a checkpoint version are their own kind.
    let base = version["baseModel"].as_str().unwrap_or_default();
    let file_name = file["name"].as_str().unwrap_or_default();
    let kind = match file["type"].as_str() {
        Some("VAE") => Some(ModelType::Vae),
        // Video models (Wan and the like) and quantised files load from the diffusion_models folder.
        _ if crate::models::civitai::is_diffusion_base(base)
            || file_name.to_ascii_lowercase().ends_with(".gguf") =>
        {
            Some(ModelType::DiffusionModel)
        }
        _ => model_type.and_then(civitai_kind),
    };
    let cover = crate::models::civitai::cover_with_maturity(version);
    // The key goes only to civitai.com over https: an answer that names any other address is refused, not followed.
    let url = file["downloadUrl"]
        .as_str()
        .ok_or("The Civitai file has no download URL")?
        .to_string();
    if !is_civitai_download(&url) {
        return Err("The Civitai file has an unexpected download address".into());
    }
    Ok(Resolved {
        url,
        file_name: file["name"]
            .as_str()
            .unwrap_or("model.safetensors")
            .to_string(),
        kind,
        total_bytes: (file["sizeKB"].as_f64().unwrap_or(0.0) * 1024.0) as u64,
        civitai: true,
        hugging_face: false,
        cover: cover.as_ref().map(|c| c.0.clone()),
        cover_mature: cover.is_some_and(|c| c.1),
        covers: crate::models::civitai::cover_set(version),
        page_url: crate::models::civitai::page_url(version),
        trigger_words: crate::models::civitai::trigger_words(version),
    })
}

/// Turns a remote source into a concrete download. Local sources do not resolve.
pub async fn resolve(
    http: &reqwest::Client,
    source: &Source,
    api_key: Option<&str>,
) -> Result<Resolved, String> {
    match source {
        Source::CivitaiFile {
            version_id,
            file_id,
        } => {
            let v = get_json(
                http,
                &format!("{}/model-versions/{version_id}", civitai_api()),
                api_key,
            )
            .await?;
            civitai_file(&v, None, Some(*file_id))
        }
        Source::CivitaiPage {
            model_id,
            version_id,
        } => {
            let m = get_json(
                http,
                &format!("{}/models/{model_id}", civitai_api()),
                api_key,
            )
            .await?;
            let versions = m["modelVersions"]
                .as_array()
                .ok_or("The Civitai model has no versions")?;
            let v = match version_id {
                Some(id) => versions.iter().find(|v| v["id"].as_u64() == Some(*id)),
                None => versions.first(),
            }
            .ok_or("The Civitai version was not found")?;
            civitai_file(v, m["type"].as_str(), None)
        }
        Source::HuggingFace { repo, file } => Ok(Resolved {
            url: crate::endpoints::hf_resolve(repo, file),
            file_name: file_name_of_url(file),
            kind: None,
            total_bytes: 0,
            civitai: false,
            hugging_face: true,
            cover: None,
            cover_mature: false,
            covers: Vec::new(),
            page_url: None,
            trigger_words: Vec::new(),
        }),
        Source::Url(url) => Ok(Resolved {
            url: url.clone(),
            file_name: file_name_of_url(url),
            kind: None,
            total_bytes: 0,
            // The keys go only to the sites they belong to, and never over plain HTTP.
            civitai: reqwest::Url::parse(url)
                .is_ok_and(|u| u.scheme() == "https" && host_is(&u, "civitai.com")),
            hugging_face: reqwest::Url::parse(url)
                .is_ok_and(|u| u.scheme() == "https" && host_is(&u, "huggingface.co")),
            cover: None,
            cover_mature: false,
            covers: Vec::new(),
            page_url: None,
            trigger_words: Vec::new(),
        }),
        Source::Local(_) => Err("A local file does not need downloading".into()),
    }
}

#[derive(Debug, thiserror::Error, PartialEq)]
pub enum InstallError {
    #[error("cancelled")]
    Cancelled,
    #[error("{0}")]
    Failed(String),
}

/// How long a download may go without an answer, or without data, before it is given up. A stalled connection would
/// otherwise wait forever.
pub const STALL_TIMEOUT: Duration = Duration::from_secs(60);

/// What a partial download was made from, kept beside it (`<file>.resume`): the size of the whole file and the validator
/// the server gave (its ETag, else Last-Modified). A later attempt asks for the rest only with that validator (`If-Range`),
/// so a file that changed on the server comes back whole and is never joined to the old part.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct Resume {
    total: u64,
    validator: String,
}

/// The name of the partial file of an install from `source`. It depends on the source, not on the job, so an install of
/// the same source started again finds the part of the one before and continues it (see `download`). Installs of one
/// source never run at once (`install_model` refuses the second), so two writers never share a part.
pub fn part_name(source: &str) -> String {
    let digest = Sha256::digest(source.as_bytes());
    let hex: String = digest.iter().take(8).map(|b| format!("{b:02x}")).collect();
    format!("{hex}.part")
}

fn resume_path(dest: &Path) -> PathBuf {
    let mut name = dest.file_name().unwrap_or_default().to_os_string();
    name.push(".resume");
    dest.with_file_name(name)
}

fn read_resume(dest: &Path) -> Option<Resume> {
    serde_json::from_str(&std::fs::read_to_string(resume_path(dest)).ok()?).ok()
}

/// Streams `url` into `dest`. `progress(bytes, total)` is called as data arrives. A download that fails or is cancelled
/// keeps the bytes it has (and its `.resume` record), so the next call continues from there; the caller removes the file
/// when it no longer wants it.
pub async fn download(
    http: &reqwest::Client,
    url: &str,
    bearer: Option<&str>,
    dest: &Path,
    cancel: &CancellationToken,
    progress: impl FnMut(u64, u64),
) -> Result<(), InstallError> {
    download_with_stall(http, url, bearer, dest, cancel, STALL_TIMEOUT, progress).await
}

/// `download` with the time a stalled download waits before it is given up (tests use a short one).
pub async fn download_with_stall(
    http: &reqwest::Client,
    url: &str,
    bearer: Option<&str>,
    dest: &Path,
    cancel: &CancellationToken,
    stall: Duration,
    mut progress: impl FnMut(u64, u64),
) -> Result<(), InstallError> {
    // Settings → Data must not delete the partial file while this download writes it (see `unfinished`).
    let _hold = crate::unfinished::hold(dest);
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| InstallError::Failed(e.to_string()))?;
    }
    // A partial file without its record came from a download this code cannot tell apart: it starts again.
    let mut resume = read_resume(dest).filter(|_| dest.is_file());
    if resume.is_none() {
        let _ = tokio::fs::remove_file(dest).await;
        let _ = tokio::fs::remove_file(resume_path(dest)).await;
    }
    loop {
        let have = match resume {
            Some(_) => tokio::fs::metadata(dest)
                .await
                .map(|m| m.len())
                .unwrap_or(0),
            None => 0,
        };
        let attempt_resume = resume.as_ref().filter(|_| have > 0);
        match attempt(
            http,
            url,
            bearer,
            dest,
            attempt_resume,
            have,
            cancel,
            stall,
            &mut progress,
        )
        .await
        {
            Ok(()) => {
                let _ = tokio::fs::remove_file(resume_path(dest)).await;
                return Ok(());
            }
            // The server has no part of the file at that place: the part is not shorter than the file, so it cannot be
            // resumed and the file is fetched whole.
            Err(Attempt::RangeRefused) => {
                let _ = tokio::fs::remove_file(dest).await;
                let _ = tokio::fs::remove_file(resume_path(dest)).await;
                resume = None;
            }
            Err(Attempt::Failed(e)) => {
                // Without its record a part cannot be continued, so nothing is kept of it.
                if read_resume(dest).is_none() {
                    let _ = tokio::fs::remove_file(dest).await;
                }
                return Err(e);
            }
        }
    }
}

enum Attempt {
    RangeRefused,
    Failed(InstallError),
}

impl From<InstallError> for Attempt {
    fn from(e: InstallError) -> Self {
        Attempt::Failed(e)
    }
}

fn stalled(stall: Duration) -> InstallError {
    InstallError::Failed(format!("Download stalled: no data for {stall:?}"))
}

/// The size of the whole file from a `Content-Range: bytes a-b/total` header.
fn content_range_total(res: &reqwest::Response) -> Option<u64> {
    let value = res
        .headers()
        .get(reqwest::header::CONTENT_RANGE)?
        .to_str()
        .ok()?;
    value.rsplit('/').next()?.trim().parse().ok()
}

/// The strong validator of the file: its ETag, else its Last-Modified date (a weak ETag cannot be used with `If-Range`).
fn validator_of(res: &reqwest::Response) -> Option<String> {
    let headers = res.headers();
    let etag = headers
        .get(reqwest::header::ETAG)
        .and_then(|v| v.to_str().ok())
        .filter(|v| !v.starts_with("W/"));
    etag.or_else(|| {
        headers
            .get(reqwest::header::LAST_MODIFIED)
            .and_then(|v| v.to_str().ok())
    })
    .map(str::to_string)
}

/// One request for the file, from byte `have` when the part is resumed (`resume` is then its record).
#[allow(clippy::too_many_arguments)]
async fn attempt(
    http: &reqwest::Client,
    url: &str,
    bearer: Option<&str>,
    dest: &Path,
    resume: Option<&Resume>,
    have: u64,
    cancel: &CancellationToken,
    stall: Duration,
    progress: &mut impl FnMut(u64, u64),
) -> Result<(), Attempt> {
    let mut req = http.get(url);
    if let Some(k) = bearer {
        req = req.bearer_auth(k);
    }
    if let Some(record) = resume {
        req = req
            .header(reqwest::header::RANGE, format!("bytes={have}-"))
            .header(reqwest::header::IF_RANGE, record.validator.as_str());
    }
    let res = tokio::select! {
        _ = cancel.cancelled() => return Err(InstallError::Cancelled.into()),
        sent = tokio::time::timeout(stall, req.send()) => match sent {
            Ok(res) => res.map_err(|e| InstallError::Failed(format!("Download failed: {e}")))?,
            Err(_) => return Err(stalled(stall).into()),
        },
    };
    let status = res.status();
    if resume.is_some() && status == reqwest::StatusCode::RANGE_NOT_SATISFIABLE {
        return Err(Attempt::RangeRefused);
    }
    if !status.is_success() {
        let hint = if status.as_u16() == 401 {
            " (this file needs an API key; set it in Settings)"
        } else {
            ""
        };
        return Err(InstallError::Failed(format!("Download answered {status}{hint}")).into());
    }
    // 206 is the rest of the file, as asked (the validator matched). Anything else is the whole file, from the start.
    let resumed = resume.is_some() && status == reqwest::StatusCode::PARTIAL_CONTENT;
    let total = if resumed {
        content_range_total(&res)
            .or(resume.map(|r| r.total))
            .unwrap_or(0)
    } else {
        res.content_length().unwrap_or(0)
    };
    let mut file = if resumed {
        tokio::fs::OpenOptions::new()
            .append(true)
            .open(dest)
            .await
            .map_err(|e| InstallError::Failed(e.to_string()))?
    } else {
        // A new file: record what it is, so a later attempt can continue it. Without a validator it cannot be continued.
        let _ = tokio::fs::remove_file(resume_path(dest)).await;
        if let Some(validator) = validator_of(&res) {
            let record = Resume { total, validator };
            if let Ok(text) = serde_json::to_vec(&record) {
                let _ = tokio::fs::write(resume_path(dest), text).await;
            }
        }
        tokio::fs::File::create(dest)
            .await
            .map_err(|e| InstallError::Failed(e.to_string()))?
    };
    let mut stream = res.bytes_stream();
    let mut got = if resumed { have } else { 0 };
    loop {
        let next = tokio::time::timeout(stall, stream.next());
        let chunk = tokio::select! {
            _ = cancel.cancelled() => return Err(InstallError::Cancelled.into()),
            chunk = next => chunk.map_err(|_| stalled(stall))?,
        };
        let Some(chunk) = chunk else { break };
        let chunk =
            chunk.map_err(|e| InstallError::Failed(format!("Download interrupted: {e}")))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| InstallError::Failed(e.to_string()))?;
        got += chunk.len() as u64;
        progress(got, total.max(got));
    }
    file.flush()
        .await
        .map_err(|e| InstallError::Failed(e.to_string()))?;
    if total > 0 && got != total {
        return Err(
            InstallError::Failed(format!("Download ended early ({got} of {total} bytes)")).into(),
        );
    }
    Ok(())
}

/// The folder a model of this kind goes to inside novira's own models folder.
pub fn target_dir(models_dir: &Path, kind: ModelType) -> Result<PathBuf, String> {
    let cat = category_for_kind(kind)
        .ok_or_else(|| format!("Models of type {kind:?} cannot be installed yet"))?;
    Ok(models_dir.join(cat.folder))
}

/// Brings a local file into the models folder without a second copy when possible (hard link), else copies it.
pub fn link_or_copy(src: &Path, dest: &Path) -> std::io::Result<()> {
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)?;
    }
    if std::fs::hard_link(src, dest).is_ok() {
        return Ok(());
    }
    std::fs::copy(src, dest).map(|_| ())
}

#[cfg(test)]
mod tests;
