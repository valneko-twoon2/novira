//! Custom node packs in ComfyUI's `custom_nodes` folder: listing them, installing one from GitHub (the source archive,
//! its Python requirements and its `install.py`) and removing one. ComfyUI loads a pack when it starts, so a change
//! takes effect after a restart.
use crate::models::install::{download, InstallError};
use crate::packs::PackStatus;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::process::Command;
use tokio_util::sync::CancellationToken;

/// Routes of custom node packs the app may call for them (the editors novira builds for a pack's nodes). A route is
/// refused unless it starts with one of these; add a prefix only together with the editor that uses it.
pub const PACK_ROUTES: &[&str] = &["nkd/facerig/"];

/// Whether `route` (without a leading slash) is one of the allowed pack routes and contains nothing that escapes it.
pub fn route_allowed(route: &str) -> bool {
    PACK_ROUTES.iter().any(|p| route.starts_with(p))
        && !route.contains("..")
        && !route.contains("//")
        && !route.contains(['?', '#', '\\', '%'])
        && !route.chars().any(char::is_control)
}

/// File novira leaves in a pack it installed, to remember where it came from.
const MARKER: &str = ".novira-pack.json";

/// A GitHub repository given as `https://github.com/<owner>/<repo>`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GithubRepo {
    pub owner: String,
    pub repo: String,
}

impl GithubRepo {
    pub fn url(&self) -> String {
        format!("https://github.com/{}/{}", self.owner, self.repo)
    }

    /// The source archive of the default branch.
    pub fn archive_url(&self) -> String {
        self.archive_url_for(None)
    }

    /// The source archive of a tag (`version`), or of the default branch when none is given. `version` must already
    /// have passed `valid_tag`.
    pub fn archive_url_for(&self, version: Option<&str>) -> String {
        let git_ref = match version {
            Some(tag) => format!("refs/tags/{tag}"),
            None => "HEAD".to_string(),
        };
        crate::endpoints::url(
            crate::endpoints::Service::Codeload,
            &format!("/{}/{}/zip/{git_ref}", self.owner, self.repo),
        )
    }
}

/// Whether `tag` is a plain release tag name (letters, digits and `._-+`, no `..`, not starting with `-` or `.`). A tag
/// is put into an address, so nothing else is accepted.
pub fn valid_tag(tag: &str) -> bool {
    !tag.is_empty()
        && tag.len() <= 100
        && !tag.starts_with(['-', '.'])
        && !tag.contains("..")
        && tag
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-' | '+'))
}

fn plain_name(s: &str) -> bool {
    !s.is_empty()
        && s != "."
        && s != ".."
        && s.chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
}

/// Accepts only `https://github.com/<owner>/<repo>` (with an optional `.git` or trailing slash).
pub fn parse_github(url: &str) -> Result<GithubRepo, String> {
    let rest = url
        .trim()
        .strip_prefix("https://github.com/")
        .ok_or_else(|| {
            format!("Only https://github.com/<owner>/<repo> addresses are accepted: {url}")
        })?;
    let rest = rest.trim_end_matches('/');
    let rest = rest.strip_suffix(".git").unwrap_or(rest);
    let mut parts = rest.split('/');
    match (parts.next(), parts.next(), parts.next()) {
        (Some(owner), Some(repo), None) if plain_name(owner) && plain_name(repo) => {
            Ok(GithubRepo {
                owner: owner.into(),
                repo: repo.into(),
            })
        }
        _ => Err(format!("Not a GitHub repository address: {url}")),
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledNodePack {
    /// Folder name under `custom_nodes`.
    pub folder: String,
    /// Where novira installed it from (none for packs put there by hand).
    pub url: Option<String>,
    /// The tag it was installed at (none when it came from the default branch, or was put there by hand).
    pub version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Marker {
    url: String,
    #[serde(default)]
    version: Option<String>,
}

pub fn custom_nodes_dir(comfyui_dir: &Path) -> PathBuf {
    comfyui_dir.join("custom_nodes")
}

/// The packs in `custom_nodes`: every folder but caches, novira's temporary ones and those ComfyUI skips (`.disabled`).
pub fn list(custom_nodes: &Path) -> Vec<InstalledNodePack> {
    let mut packs: Vec<InstalledNodePack> = std::fs::read_dir(custom_nodes)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|e| e.path().is_dir())
        .filter_map(|e| {
            let folder = e.file_name().to_string_lossy().into_owned();
            if folder.starts_with('.') || folder == "__pycache__" || folder.ends_with(".disabled") {
                return None;
            }
            let marker = std::fs::read(e.path().join(MARKER))
                .ok()
                .and_then(|b| serde_json::from_slice::<Marker>(&b).ok());
            let (url, version) = match marker {
                Some(m) => (Some(m.url), m.version),
                None => (None, None),
            };
            Some(InstalledNodePack {
                folder,
                url,
                version,
            })
        })
        .collect();
    packs.sort_by_key(|p| p.folder.to_lowercase());
    packs
}

/// The tag names in a GitHub `tags` answer, in the order given (newest first), without the ones `valid_tag` refuses.
pub fn parse_tags(body: &[u8]) -> Vec<String> {
    serde_json::from_slice::<Vec<serde_json::Value>>(body)
        .unwrap_or_default()
        .iter()
        .filter_map(|t| t["name"].as_str())
        .filter(|n| valid_tag(n))
        .map(str::to_string)
        .collect()
}

/// The tags of a repository, newest first (the latest 50; GitHub's answer is capped at 1 MB here).
pub async fn tags(http: &reqwest::Client, repo: &GithubRepo) -> Result<Vec<String>, String> {
    let url = crate::endpoints::url(
        crate::endpoints::Service::GitHubApi,
        &format!("/repos/{}/{}/tags?per_page=50", repo.owner, repo.repo),
    );
    let resp = http
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Cannot reach GitHub: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!(
            "GitHub did not list the versions of {} (HTTP {})",
            repo.repo,
            resp.status().as_u16()
        ));
    }
    if resp.content_length().is_some_and(|n| n > 1_000_000) {
        return Err("GitHub's list of versions is unexpectedly large".into());
    }
    let body = resp.bytes().await.map_err(|e| e.to_string())?;
    if body.len() > 1_000_000 {
        return Err("GitHub's list of versions is unexpectedly large".into());
    }
    Ok(parse_tags(&body))
}

/// What GitHub says about a repository: who made it, its licence and its own description.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoInfo {
    pub author: String,
    /// SPDX id of the licence GitHub recognised (none when the repository has no licence file or it is not recognised).
    pub license: Option<String>,
    pub description: Option<String>,
    pub stars: u64,
}

pub fn parse_repo_info(body: &[u8], repo: &GithubRepo) -> RepoInfo {
    let v: serde_json::Value = serde_json::from_slice(body).unwrap_or_default();
    let license = v["license"]["spdx_id"]
        .as_str()
        .filter(|s| *s != "NOASSERTION" && !s.is_empty() && s.len() <= 40)
        .map(str::to_string);
    RepoInfo {
        author: v["owner"]["login"]
            .as_str()
            .unwrap_or(&repo.owner)
            .to_string(),
        license,
        description: v["description"]
            .as_str()
            .map(|d| d.chars().take(300).collect()),
        stars: v["stargazers_count"].as_u64().unwrap_or(0),
    }
}

/// The author and licence of a repository (GitHub's answer is capped at 1 MB here).
pub async fn repo_info(http: &reqwest::Client, repo: &GithubRepo) -> Result<RepoInfo, String> {
    let url = crate::endpoints::url(
        crate::endpoints::Service::GitHubApi,
        &format!("/repos/{}/{}", repo.owner, repo.repo),
    );
    let resp = http
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Cannot reach GitHub: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!(
            "GitHub did not describe {} (HTTP {})",
            repo.repo,
            resp.status().as_u16()
        ));
    }
    let body = resp.bytes().await.map_err(|e| e.to_string())?;
    if body.len() > 1_000_000 {
        return Err("GitHub's answer is unexpectedly large".into());
    }
    Ok(parse_repo_info(&body, repo))
}

/// The version ComfyUI reports (`__version__` in its `comfyui_version.py`), when the file is there.
pub fn comfyui_version(comfyui_dir: &Path) -> Option<String> {
    let text = std::fs::read_to_string(comfyui_dir.join("comfyui_version.py")).ok()?;
    text.lines().find_map(|l| {
        let rest = l.trim().strip_prefix("__version__")?.trim_start();
        let value = rest.strip_prefix('=')?.trim().trim_matches(['"', '\'']);
        (!value.is_empty() && value.len() <= 40).then(|| value.to_string())
    })
}

/// Deletes a pack folder. Only a plain folder name directly under `custom_nodes` is accepted.
pub fn remove(custom_nodes: &Path, folder: &str) -> Result<(), String> {
    if !plain_name(folder) {
        return Err(format!("Not a pack folder: {folder}"));
    }
    let dir = custom_nodes.join(folder);
    if !dir.is_dir() {
        return Err(format!("{folder} is not installed"));
    }
    std::fs::remove_dir_all(&dir).map_err(|e| format!("Cannot remove {folder}: {e}"))
}

/// Caches and temporary files of the Python steps stay in the data folder.
fn confine(cmd: &mut Command, data_dir: &Path) {
    let cache = data_dir.join("cache");
    let temp = cache.join("temp");
    let _ = std::fs::create_dir_all(&temp);
    cmd.env("PIP_CACHE_DIR", cache.join("pip"))
        .env("HF_HOME", cache.join("huggingface"))
        .env("TORCH_HOME", cache.join("torch"))
        .env("TEMP", &temp)
        .env("TMP", &temp)
        .env("PYTHONUTF8", "1")
        .env("PYTHONUNBUFFERED", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
}

/// Runs a Python step; on failure the error carries the last lines it printed.
async fn run(mut cmd: Command, what: &str, cancel: &CancellationToken) -> Result<String, String> {
    let child = cmd
        .spawn()
        .map_err(|e| format!("Cannot run Python for {what}: {e}"))?;
    let out = tokio::select! {
        _ = cancel.cancelled() => return Err("cancelled".into()),
        o = child.wait_with_output() => o.map_err(|e| e.to_string())?,
    };
    if !out.status.success() {
        let text = format!(
            "{}\n{}",
            String::from_utf8_lossy(&out.stdout),
            String::from_utf8_lossy(&out.stderr)
        );
        let tail: Vec<&str> = text.lines().filter(|l| !l.trim().is_empty()).collect();
        let tail = tail[tail.len().saturating_sub(6)..].join("\n");
        return Err(format!("{what} failed: {tail}"));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Libraries a pack's requirements must not replace: ComfyUI's PyTorch build matches its GPU.
const KEEP: &[&str] = &["torch", "torchvision", "torchaudio", "xformers"];

/// Libraries a pack needs but does not list in its `requirements.txt`.
pub fn extra_requirements(repo: &GithubRepo) -> &'static [&'static str] {
    match (repo.owner.as_str(), repo.repo.as_str()) {
        // The face nodes (Face Rig, Face Crop) import cv2 and are skipped without it.
        ("Nekodificador", "ComfyUI-NKD-Basic-Tools") => &["opencv-python-headless"],
        // Its SAM3 module imports triton, which Windows gets from a separate package; without it the whole pack fails to load.
        #[cfg(windows)]
        ("1038lab", "ComfyUI-RMBG") => &["triton-windows"],
        _ => &[],
    }
}

/// Libraries left out of a pack's `requirements.txt` because installing them would break the running ComfyUI. pip
/// would replace a DLL that ComfyUI holds open (Windows refuses: "access denied"), or change a library that an installed
/// one is pinned to. The pack works without them.
pub fn skipped_requirements(repo: &GithubRepo) -> &'static [&'static str] {
    if repo.owner.eq_ignore_ascii_case("Fannovel16")
        && repo.repo.eq_ignore_ascii_case("comfyui_controlnet_aux")
    {
        // MediaPipe needs opencv-contrib-python, whose cv2.pyd replaces the one ComfyUI has loaded. Only the face-mesh
        // and mesh-graphormer nodes use it (they import it when they run); DWPose and the other preprocessors do not.
        // albumentationsx 2.5 needs albucore 0.2.21, but the installed albumentations 2.0.8 is pinned to albucore
        // 0.0.24. The pack imports albumentations only in its DiffusionEdge node, and only when that node runs.
        return &["mediapipe", "albumentationsx"];
    }
    &[]
}

/// The name a requirements line asks for, as pip compares names: lower case, with `-`, `_` and `.` alike. None for a
/// blank line, a comment or an option (`-r other.txt`).
fn requirement_name(line: &str) -> Option<String> {
    let line = line.trim();
    if line.is_empty() || line.starts_with(['#', '-']) {
        return None;
    }
    let name: String = line
        .chars()
        .take_while(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        .map(|c| match c {
            '_' | '.' => '-',
            c => c.to_ascii_lowercase(),
        })
        .collect();
    (!name.is_empty()).then_some(name)
}

/// `requirements` without the lines that ask for a library of `skip`.
pub fn without_requirements(requirements: &str, skip: &[&str]) -> String {
    let skip: Vec<String> = skip.iter().filter_map(|s| requirement_name(s)).collect();
    requirements
        .lines()
        .filter(|l| requirement_name(l).is_none_or(|n| !skip.contains(&n)))
        .map(|l| format!("{l}\n"))
        .collect()
}

/// Pins from `pip freeze` that keep ComfyUI's PyTorch as it is (pip takes only `name==version` as a constraint). A
/// portable build lists its wheels as `name @ file:///…/name-version-….whl#sha256=…`, so the version comes from the
/// wheel's file name there.
pub fn constraints(freeze: &str) -> String {
    freeze
        .lines()
        .filter_map(pin)
        .filter(|(name, _)| KEEP.contains(&requirement_name(name).unwrap_or_default().as_str()))
        .map(|(name, version)| format!("{name}=={version}\n"))
        .collect()
}

/// The name and version a `pip freeze` line pins: `name==version`, or `name @ <wheel URL>`. None for any other line.
fn pin(line: &str) -> Option<(String, String)> {
    let line = line.trim();
    if let Some((name, url)) = line.split_once(" @ ") {
        let name = name.trim();
        return Some((name.to_string(), wheel_version(name, url)?));
    }
    let (name, version) = line.split_once("==")?;
    let (name, version) = (name.trim(), version.trim());
    (!name.is_empty() && !version.is_empty()).then(|| (name.to_string(), version.to_string()))
}

/// The version in the file name of the wheel at `url`, when that wheel is for `name`. The `+` of a local version
/// (`2.14.0+cu130`) is written `%2B` in the URL.
fn wheel_version(name: &str, url: &str) -> Option<String> {
    let file = url.split(['#', '?']).next()?.rsplit('/').next()?;
    let mut parts = file.strip_suffix(".whl")?.split('-');
    let (dist, version) = (parts.next()?, parts.next()?);
    if requirement_name(dist) != requirement_name(name) || version.is_empty() {
        return None;
    }
    Some(version.replace("%2B", "+").replace("%2b", "+"))
}

fn install_error(e: InstallError) -> String {
    match e {
        InstallError::Cancelled => "cancelled".to_string(),
        InstallError::Failed(m) => m,
    }
}

/// `[submodule]` entries of a `.gitmodules` file as (path, url).
pub fn parse_gitmodules(text: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let (mut path, mut url) = (None::<String>, None::<String>);
    for line in text.lines().map(str::trim) {
        if line.starts_with('[') {
            if let (Some(p), Some(u)) = (path.take(), url.take()) {
                out.push((p, u));
            }
        } else if let Some((k, v)) = line.split_once('=') {
            match k.trim() {
                "path" => path = Some(v.trim().to_string()),
                "url" => url = Some(v.trim().to_string()),
                _ => {}
            }
        }
    }
    if let (Some(p), Some(u)) = (path, url) {
        out.push((p, u));
    }
    out
}

/// The commit a repository pins a submodule at (GitHub's contents API; at `version` when a tag is given), or `HEAD`
/// when it cannot tell.
async fn submodule_commit(
    http: &reqwest::Client,
    repo: &GithubRepo,
    path: &str,
    version: Option<&str>,
) -> String {
    let at = version.map(|v| format!("?ref={v}")).unwrap_or_default();
    let url = crate::endpoints::url(
        crate::endpoints::Service::GitHubApi,
        &format!("/repos/{}/{}/contents/{path}{at}", repo.owner, repo.repo),
    );
    let sha = async {
        let v: serde_json::Value = http.get(url).send().await.ok()?.json().await.ok()?;
        if v["type"] == "submodule" {
            v["sha"].as_str().map(str::to_string)
        } else {
            None
        }
    };
    sha.await.unwrap_or_else(|| "HEAD".into())
}

/// Downloads a GitHub archive and unpacks it under `into`; returns its single top folder.
#[allow(clippy::too_many_arguments)]
async fn fetch_tree(
    http: &reqwest::Client,
    archive_url: &str,
    label: &str,
    into: &Path,
    python: &Path,
    data_dir: &Path,
    cancel: &CancellationToken,
    report: &(dyn Fn(PackStatus) + Send + Sync),
) -> Result<PathBuf, String> {
    std::fs::create_dir_all(into).map_err(|e| e.to_string())?;
    let archive = into.join("archive.zip");
    download(http, archive_url, None, &archive, cancel, |bytes, total| {
        report(PackStatus::Downloading {
            file: label.to_string(),
            index: 1,
            count: 1,
            bytes,
            total_bytes: total,
        })
    })
    .await
    .map_err(install_error)?;
    report(PackStatus::Installing {
        step: "unpack".into(),
    });
    let unpacked = into.join("unpacked");
    let mut cmd = Command::new(python);
    cmd.args(["-m", "zipfile", "-e"])
        .arg(&archive)
        .arg(&unpacked);
    confine(&mut cmd, data_dir);
    run(cmd, "Unpacking the pack", cancel).await?;
    // GitHub archives hold one folder, `<repo>-<commit>`.
    let mut tops = std::fs::read_dir(&unpacked)
        .map_err(|e| e.to_string())?
        .flatten()
        .filter(|e| e.path().is_dir());
    match (tops.next(), tops.next()) {
        (Some(t), None) => Ok(t.path()),
        _ => Err("The pack archive has an unexpected layout".to_string()),
    }
}

/// Renames a folder, trying again a few times when Windows says access is denied: a virus scanner that is still
/// looking at the freshly unpacked files holds them for a moment.
async fn rename_retrying(from: &Path, to: &Path) -> std::io::Result<()> {
    let mut tries = 0;
    loop {
        match std::fs::rename(from, to) {
            Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied && tries < 8 => {
                tries += 1;
                tokio::time::sleep(crate::test_timing::retry_pause(
                    std::time::Duration::from_millis(250 * tries),
                ))
                .await;
            }
            other => return other,
        }
    }
}

/// Installs (or replaces) a pack from GitHub: its files and submodules, then its Python requirements and
/// `install.py`, run where ComfyUI will load it. `Err("cancelled")` when stopped; a failed install leaves the pack
/// as it was before.
#[allow(clippy::too_many_arguments)]
pub async fn install(
    http: &reqwest::Client,
    repo: &GithubRepo,
    comfyui_dir: &Path,
    python: &Path,
    data_dir: &Path,
    cancel: &CancellationToken,
    report: &(dyn Fn(PackStatus) + Send + Sync),
) -> Result<String, String> {
    install_version(
        http,
        repo,
        None,
        comfyui_dir,
        python,
        data_dir,
        cancel,
        report,
    )
    .await
}

/// `install`, at a tag of the repository (`version`) instead of its default branch.
#[allow(clippy::too_many_arguments)]
pub async fn install_version(
    http: &reqwest::Client,
    repo: &GithubRepo,
    version: Option<&str>,
    comfyui_dir: &Path,
    python: &Path,
    data_dir: &Path,
    cancel: &CancellationToken,
    report: &(dyn Fn(PackStatus) + Send + Sync),
) -> Result<String, String> {
    if let Some(tag) = version {
        if !valid_tag(tag) {
            return Err(format!("Not a version tag: {tag}"));
        }
    }
    let custom_nodes = custom_nodes_dir(comfyui_dir);
    let work = custom_nodes.join(format!(".novira-{}", uuid::Uuid::new_v4().simple()));
    let dest = custom_nodes.join(&repo.repo);
    let backup = work.join("previous");
    let mut placed = false;
    let result = async {
        let top = fetch_tree(
            http,
            &repo.archive_url_for(version),
            &repo.repo,
            &work.join("pack"),
            python,
            data_dir,
            cancel,
            report,
        )
        .await?;
        if let Ok(text) = std::fs::read_to_string(top.join(".gitmodules")) {
            for (i, (path, url)) in parse_gitmodules(&text).into_iter().enumerate() {
                if path.contains("..") || Path::new(&path).is_absolute() {
                    return Err(format!("Unexpected submodule path {path}"));
                }
                let sub = parse_github(&url)
                    .map_err(|_| format!("The pack needs {url}, which is not on GitHub"))?;
                let commit = submodule_commit(http, repo, &path, version).await;
                let archive = crate::endpoints::url(
                    crate::endpoints::Service::Codeload,
                    &format!("/{}/{}/zip/{commit}", sub.owner, sub.repo),
                );
                let sub_top = fetch_tree(
                    http,
                    &archive,
                    &sub.repo,
                    &work.join(format!("sub{i}")),
                    python,
                    data_dir,
                    cancel,
                    report,
                )
                .await?;
                let target = top.join(&path);
                let _ = std::fs::remove_dir_all(&target);
                if let Some(parent) = target.parent() {
                    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                rename_retrying(&sub_top, &target)
                    .await
                    .map_err(|e| e.to_string())?;
            }
        }
        std::fs::write(
            top.join(MARKER),
            serde_json::to_vec(&Marker {
                url: repo.url(),
                version: version.map(str::to_string),
            })
            .map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;

        if dest.exists() {
            std::fs::rename(&dest, &backup)
                .map_err(|e| format!("Cannot replace the installed {}: {e}", repo.repo))?;
        }
        rename_retrying(&top, &dest)
            .await
            .map_err(|e| format!("Cannot put the pack in place: {e}"))?;
        placed = true;

        let requirements = dest.join("requirements.txt");
        let extra = extra_requirements(repo);
        if requirements.is_file() || !extra.is_empty() {
            report(PackStatus::Installing {
                step: "requirements".into(),
            });
            let mut freeze = Command::new(python);
            freeze.args(["-m", "pip", "freeze", "--disable-pip-version-check"]);
            confine(&mut freeze, data_dir);
            let pins = constraints(&run(freeze, "Reading the installed libraries", cancel).await?);
            let pins_file = work.join("constraints.txt");
            std::fs::write(&pins_file, pins).map_err(|e| e.to_string())?;
            let mut pip = Command::new(python);
            pip.args(["-m", "pip", "install", "--disable-pip-version-check", "-c"])
                .arg(&pins_file)
                .args(extra);
            if requirements.is_file() {
                let skip = skipped_requirements(repo);
                if skip.is_empty() {
                    pip.arg("-r").arg(&requirements);
                } else {
                    let text = std::fs::read(&requirements).map_err(|e| e.to_string())?;
                    let kept = without_requirements(&String::from_utf8_lossy(&text), skip);
                    let kept_file = work.join("requirements.txt");
                    std::fs::write(&kept_file, kept).map_err(|e| e.to_string())?;
                    pip.arg("-r").arg(&kept_file);
                }
            }
            confine(&mut pip, data_dir);
            run(pip, "Installing the pack's libraries", cancel).await?;
        }
        if dest.join("install.py").is_file() {
            report(PackStatus::Installing {
                step: "install.py".into(),
            });
            let mut setup = Command::new(python);
            setup.arg("install.py").current_dir(&dest);
            confine(&mut setup, data_dir);
            run(setup, "The pack's install.py", cancel).await?;
        }
        Ok(repo.repo.clone())
    }
    .await;
    if result.is_err() && placed {
        let _ = std::fs::remove_dir_all(&dest);
        if backup.exists() {
            let _ = std::fs::rename(&backup, &dest);
        }
    }
    let _ = std::fs::remove_dir_all(&work);
    result
}

#[cfg(test)]
mod tests;
