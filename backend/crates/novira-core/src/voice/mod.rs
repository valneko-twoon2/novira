//! The voice engine: reading text aloud with Qwen3-TTS (Apache-2.0; Japanese, English and eight more languages).
//!
//! ComfyUI has no speech node, so the engine is a separate Python process run by ComfyUI's own embedded Python (the
//! worker script `voice_worker.py` is written next to the libraries). Everything stays inside novira's data folder:
//!
//! - `<data>/voice/site/`: the Python libraries the model needs, installed with `pip --target` so nothing in ComfyUI's
//!   own environment changes;
//! - `<data>/models/voice/<name>/`: the model folders, downloaded from Hugging Face;
//! - `<data>/cache/`: caches and temporary files, like ComfyUI's.
//!
//! The worker is started on the first request, keeps its model on the GPU between requests, and stops after a while
//! unused so the GPU memory is free for image generation.
use crate::models::install::{download, is_hugging_face_repo, is_repo_file_path, InstallError};
use crate::packs::PackStatus;
use crate::sync::LockExt;
use crate::types::{VoiceMode, VoiceParams};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio_util::sync::CancellationToken;

const WORKER_SCRIPT: &str = include_str!("worker.py");
const MARK: &str = "@@NOVIRA@@ ";
/// The worker stops after this long without a request.
const IDLE_STOP: Duration = Duration::from_secs(300);
/// How often the idle check runs.
const IDLE_CHECK: Duration = Duration::from_secs(30);

/// How long the worker may sit idle and how often that is checked. A debug build lets a test shorten both with
/// `NOVIRA_TEST_VOICE_IDLE_MS` (the release build never reads it).
fn idle_timing() -> (Duration, Duration) {
    #[cfg(debug_assertions)]
    if let Some(ms) = std::env::var("NOVIRA_TEST_VOICE_IDLE_MS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
    {
        return (Duration::from_millis(ms), Duration::from_millis(ms.min(50)));
    }
    (IDLE_STOP, IDLE_CHECK)
}
/// Longest wait for one answer (loading a model on the first request takes the longest).
const ANSWER_TIMEOUT: Duration = Duration::from_secs(900);

pub struct VoiceModel {
    pub repo: &'static str,
    /// Folder under `<models>/voice/`.
    pub dir: &'static str,
    pub approx_bytes: u64,
}

/// Built-in speakers, and a style instruction.
pub const CUSTOM_VOICE: VoiceModel = VoiceModel {
    repo: "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
    dir: "custom_voice_1.7b",
    approx_bytes: 4_500_000_000,
};
/// A voice described in words.
pub const VOICE_DESIGN: VoiceModel = VoiceModel {
    repo: "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
    dir: "voice_design_1.7b",
    approx_bytes: 4_500_000_000,
};
const LIBRARIES_APPROX_BYTES: u64 = 400_000_000;

/// Libraries the demo of `qwen-tts` pulls in but speech synthesis does not need.
const SKIPPED_LIBRARIES: &[&str] = &[
    "gradio",
    "gradio_client",
    "hf-gradio",
    "fastapi",
    "starlette",
    "uvicorn",
    "pandas",
    "pydub",
    "python-multipart",
    "safehttpx",
    "groovy",
    "orjson",
    "tomlkit",
    "brotli",
    "semantic-version",
    "audioop-lts",
    "opentelemetry-api",
    "pytz",
    "tzdata",
    "python-dateutil",
    "six",
];

/// The Python the voice libraries are installed for: the explicit one if it exists, else the one that goes with ComfyUI.
pub fn resolve_python(explicit: Option<&Path>, comfy_dir: Option<&Path>) -> Option<PathBuf> {
    explicit
        .map(Path::to_path_buf)
        .or_else(|| comfy_dir.map(crate::comfy::process::find_python))
        .filter(|p| p.is_file())
}

pub fn model_for(p: &VoiceParams) -> &'static VoiceModel {
    match p.mode {
        VoiceMode::Design => &VOICE_DESIGN,
        VoiceMode::Preset => &CUSTOM_VOICE,
    }
}

pub fn site_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("voice").join("site")
}

pub fn model_dir(models_dir: &Path, m: &VoiceModel) -> PathBuf {
    models_dir.join("voice").join(m.dir)
}

fn libraries_ready(data_dir: &Path) -> bool {
    site_dir(data_dir).join(".ready").is_file()
}

fn model_ready(models_dir: &Path, m: &VoiceModel) -> bool {
    model_dir(models_dir, m).join(".complete").is_file()
}

/// The folder of a voice model: in the first of `roots` (the data folder's models folder first, then the user's shared
/// model folders, read only) where it is complete; the first root's path when it is in none.
pub fn model_dir_in(roots: &[PathBuf], m: &VoiceModel) -> PathBuf {
    roots
        .iter()
        .find(|r| model_ready(r, m))
        .or(roots.first())
        .map(|r| model_dir(r, m))
        .unwrap_or_default()
}

fn model_ready_in(roots: &[PathBuf], m: &VoiceModel) -> bool {
    roots.iter().any(|r| model_ready(r, m))
}

pub fn is_installed(data_dir: &Path, models_dir: &Path) -> bool {
    is_installed_in(data_dir, &[models_dir.to_path_buf()])
}

/// Like `is_installed`, with the models looked for in every one of `roots`.
pub fn is_installed_in(data_dir: &Path, roots: &[PathBuf]) -> bool {
    libraries_ready(data_dir)
        && [&CUSTOM_VOICE, &VOICE_DESIGN]
            .iter()
            .all(|m| model_ready_in(roots, m))
}

/// `Ready` when the libraries and both models are in place, otherwise `Missing` with what is left to fetch.
pub fn disk_status(data_dir: &Path, models_dir: &Path) -> PackStatus {
    disk_status_in(data_dir, &[models_dir.to_path_buf()])
}

/// Like `disk_status`, with the models looked for in every one of `roots`.
pub fn disk_status_in(data_dir: &Path, roots: &[PathBuf]) -> PackStatus {
    if is_installed_in(data_dir, roots) {
        return PackStatus::Ready;
    }
    let models: u64 = [&CUSTOM_VOICE, &VOICE_DESIGN]
        .iter()
        .filter(|m| !model_ready_in(roots, m))
        .map(|m| m.approx_bytes)
        .sum();
    PackStatus::Missing {
        total_bytes: models
            + if libraries_ready(data_dir) {
                0
            } else {
                LIBRARIES_APPROX_BYTES
            },
    }
}

/// The JSON line the worker reads for one request.
pub fn request_json(id: u64, p: &VoiceParams, model: &Path, out: &Path) -> Value {
    json!({
        "id": id,
        "mode": match p.mode { VoiceMode::Design => "design", VoiceMode::Preset => "preset" },
        "model": model.to_string_lossy(),
        "text": p.text,
        "language": p.language,
        "speaker": p.speaker,
        "instruct": p.instruct,
        "out": out.to_string_lossy(),
    })
}

/// The libraries `pip` would add to ComfyUI's environment for `qwen-tts` (from its `--report`), pinned, without the
/// ones speech synthesis does not need. Libraries that ComfyUI already has (PyTorch, NumPy, ...) are not in the report.
pub fn libraries_from_report(report: &Value) -> Vec<String> {
    report["install"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|i| {
            let name = i["metadata"]["name"].as_str()?;
            let version = i["metadata"]["version"].as_str()?;
            (!SKIPPED_LIBRARIES.contains(&name.to_ascii_lowercase().as_str()))
                .then(|| format!("{name}=={version}"))
        })
        .collect()
}

/// Files of a model repository worth downloading: not the git bookkeeping, README or pictures.
pub fn wanted_files(tree: &Value) -> Vec<(String, u64)> {
    tree.as_array()
        .into_iter()
        .flatten()
        .filter(|e| e["type"] == "file")
        .filter_map(|e| {
            Some((
                e["path"].as_str()?.to_string(),
                e["size"].as_u64().unwrap_or(0),
            ))
        })
        .filter(|(path, _)| {
            let lower = path.to_ascii_lowercase();
            is_repo_file_path(path)
                && !lower.starts_with('.')
                && !lower.contains("/.")
                && !lower.starts_with("assets/")
                && !lower.starts_with("readme")
                && ![".png", ".jpg", ".jpeg", ".gif", ".webp", ".md"]
                    .iter()
                    .any(|e| lower.ends_with(e))
        })
        .collect()
}

fn hide_window(cmd: &mut Command) {
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    #[cfg(not(windows))]
    let _ = cmd;
}

/// Caches and temporary files stay in the data folder.
fn confine(cmd: &mut Command, data_dir: &Path) {
    let cache = data_dir.join("cache");
    let temp = cache.join("temp");
    let _ = std::fs::create_dir_all(&temp);
    cmd.env("HF_HOME", cache.join("huggingface"))
        .env("TORCH_HOME", cache.join("torch"))
        .env("XDG_CACHE_HOME", cache.join("xdg"))
        .env("PIP_CACHE_DIR", cache.join("pip"))
        .env("NUMBA_CACHE_DIR", cache.join("numba"))
        .env("TEMP", &temp)
        .env("TMP", &temp)
        .env("PYTHONUTF8", "1")
        .env("PYTHONUNBUFFERED", "1");
}

async fn run_pip(
    python: &Path,
    data_dir: &Path,
    args: &[&str],
    cancel: &CancellationToken,
) -> Result<String, String> {
    let mut cmd = Command::new(python);
    cmd.args(["-m", "pip", "--disable-pip-version-check"])
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    confine(&mut cmd, data_dir);
    hide_window(&mut cmd);
    let child = cmd.spawn().map_err(|e| format!("Cannot run Python: {e}"))?;
    let out = tokio::select! {
        _ = cancel.cancelled() => return Err("cancelled".into()),
        o = child.wait_with_output() => o.map_err(|e| e.to_string())?,
    };
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        let tail: String = err
            .lines()
            .rev()
            .take(6)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join("\n");
        return Err(format!("Installing the voice libraries failed: {tail}"));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Installs the libraries and downloads both models. Safe to run again: finished parts are skipped.
/// `Err("cancelled")` when stopped.
pub async fn install(
    http: &reqwest::Client,
    data_dir: &Path,
    models_dir: &Path,
    python: Option<&Path>,
    hf_token: Option<&str>,
    cancel: &CancellationToken,
    status: &(dyn Fn(PackStatus) + Send + Sync),
) -> Result<(), String> {
    let python = python
        .filter(|p| p.is_file())
        .ok_or("The voice engine runs on the image engine's Python. Wait until the image engine is installed")?;
    let site = site_dir(data_dir);
    if !libraries_ready(data_dir) {
        status(PackStatus::Installing {
            step: "libraries".into(),
        });
        std::fs::create_dir_all(&site).map_err(|e| e.to_string())?;
        let report = site.join("report.json");
        let report_arg = report.to_string_lossy().into_owned();
        run_pip(
            python,
            data_dir,
            &[
                "install",
                "--dry-run",
                "--quiet",
                "--report",
                &report_arg,
                "qwen-tts",
            ],
            cancel,
        )
        .await?;
        let text = std::fs::read_to_string(&report).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&report);
        let libraries =
            libraries_from_report(&serde_json::from_str(&text).map_err(|e| e.to_string())?);
        if !libraries.iter().any(|l| l.starts_with("qwen-tts==")) {
            return Err("Could not work out which libraries the voice engine needs".into());
        }
        let site_arg = site.to_string_lossy().into_owned();
        let mut args = vec![
            "install",
            "--target",
            site_arg.as_str(),
            "--no-deps",
            "--quiet",
        ];
        args.extend(libraries.iter().map(String::as_str));
        run_pip(python, data_dir, &args, cancel).await?;
        std::fs::write(site.join(".ready"), libraries.join("\n")).map_err(|e| e.to_string())?;
    }

    // Plan the downloads first so the progress covers everything.
    let mut plan: Vec<(&VoiceModel, Vec<(String, u64)>)> = Vec::new();
    for m in [&CUSTOM_VOICE, &VOICE_DESIGN] {
        if model_ready(models_dir, m) {
            continue;
        }
        if !is_hugging_face_repo(m.repo) {
            return Err(format!("Invalid repository {}", m.repo));
        }
        let url = crate::endpoints::url(
            crate::endpoints::Service::HuggingFace,
            &format!("/api/models/{}/tree/main?recursive=true", m.repo),
        );
        let mut req = http.get(&url);
        if let Some(t) = hf_token {
            req = req.bearer_auth(t);
        }
        let tree: Value = req
            .send()
            .await
            .map_err(|e| format!("Hugging Face request failed: {e}"))?
            .error_for_status()
            .map_err(|e| {
                format!(
                    "Hugging Face answered {}",
                    e.status()
                        .map_or_else(|| "an error".into(), |s| s.to_string())
                )
            })?
            .json()
            .await
            .map_err(|e| format!("Unexpected Hugging Face response: {e}"))?;
        plan.push((m, wanted_files(&tree)));
    }
    let total: u64 = plan
        .iter()
        .flat_map(|(_, f)| f.iter().map(|(_, s)| *s))
        .sum();
    let count = plan.iter().map(|(_, f)| f.len() as u32).sum::<u32>();
    let mut done_bytes = 0u64;
    let mut index = 0u32;
    for (model, files) in &plan {
        let root = model_dir(models_dir, model);
        for (path, size) in files {
            index += 1;
            let dest = root.join(path);
            if std::fs::metadata(&dest).is_ok_and(|m| m.len() == *size && *size > 0) {
                done_bytes += size;
                continue;
            }
            let part = root.join(".downloads").join(format!("{index}.part"));
            let url = crate::endpoints::hf_resolve(model.repo, path);
            let base = done_bytes;
            let mut last = Instant::now() - Duration::from_secs(1);
            let name = path.rsplit('/').next().unwrap_or(path).to_string();
            let mut report = |bytes: u64, _total: u64| {
                if last.elapsed() >= Duration::from_millis(500) {
                    last = Instant::now();
                    status(PackStatus::Downloading {
                        file: name.clone(),
                        index,
                        count,
                        bytes: base + bytes,
                        total_bytes: total.max(base + bytes),
                    });
                }
            };
            download(http, &url, hf_token, &part, cancel, &mut report)
                .await
                .map_err(|e| match e {
                    InstallError::Cancelled => "cancelled".to_string(),
                    InstallError::Failed(m) => m,
                })?;
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            std::fs::rename(&part, &dest).map_err(|e| e.to_string())?;
            done_bytes += size;
        }
        std::fs::write(root.join(".complete"), b"ok").map_err(|e| e.to_string())?;
        let _ = std::fs::remove_dir_all(root.join(".downloads"));
    }
    Ok(())
}

// Running ---------------------------------------------------------------------------------------------------------

/// What the queue needs from a voice engine; tests use a fake.
#[async_trait::async_trait]
pub trait VoiceEngine: Send + Sync {
    /// Reads the text aloud into the WAV file `out`; returns its length in seconds.
    async fn speak(
        &self,
        params: &VoiceParams,
        out: &Path,
        cancel: &CancellationToken,
    ) -> Result<f64, String>;

    /// Stops the engine's process, if any.
    fn shutdown(&self) {}
}

struct Worker {
    child: Child,
    stdin: ChildStdin,
    lines: tokio::io::Lines<BufReader<ChildStdout>>,
}

struct Inner {
    data_dir: PathBuf,
    models_dir: PathBuf,
    /// The user's shared model folders: voice models are also looked for there, never written.
    read_roots: Vec<PathBuf>,
    python: Option<PathBuf>,
    comfy_dir: Option<PathBuf>,
    worker: tokio::sync::Mutex<Option<Worker>>,
    last_used: Mutex<Instant>,
    next_id: AtomicU64,
    reaper_running: Mutex<bool>,
}

/// Qwen3-TTS in a worker process.
#[derive(Clone)]
pub struct QwenVoice {
    inner: Arc<Inner>,
}

impl QwenVoice {
    /// `python` is an explicit interpreter; without one the Python next to ComfyUI in `comfy_dir` is used.
    pub fn new(
        data_dir: PathBuf,
        models_dir: PathBuf,
        python: Option<PathBuf>,
        comfy_dir: Option<PathBuf>,
    ) -> Self {
        Self {
            inner: Arc::new(Inner {
                data_dir,
                models_dir,
                read_roots: Vec::new(),
                python,
                comfy_dir,
                worker: tokio::sync::Mutex::new(None),
                last_used: Mutex::new(Instant::now()),
                next_id: AtomicU64::new(1),
                reaper_running: Mutex::new(false),
            }),
        }
    }

    /// Also looks for the voice models in these folders (the `modelRoots` setting). Call it before the engine is shared.
    pub fn with_read_roots(mut self, roots: Vec<PathBuf>) -> Self {
        if let Some(inner) = Arc::get_mut(&mut self.inner) {
            inner.read_roots = roots;
        }
        self
    }

    /// The data folder's models folder, then the shared ones.
    fn roots(&self) -> Vec<PathBuf> {
        std::iter::once(self.inner.models_dir.clone())
            .chain(self.inner.read_roots.iter().cloned())
            .collect()
    }

    async fn start(&self) -> Result<Worker, String> {
        let python = resolve_python(
            self.inner.python.as_deref(),
            self.inner.comfy_dir.as_deref(),
        )
        .ok_or("The voice engine runs on the image engine's Python, which is not installed")?;
        let python = python.as_path();
        if !is_installed_in(&self.inner.data_dir, &self.roots()) {
            return Err(
                "The voice engine is not installed yet. Install it on the Voice screen first"
                    .into(),
            );
        }
        let root = self.inner.data_dir.join("voice");
        std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
        let script = root.join("worker.py");
        std::fs::write(&script, WORKER_SCRIPT).map_err(|e| e.to_string())?;
        let logs = self.inner.data_dir.join("logs");
        std::fs::create_dir_all(&logs).map_err(|e| e.to_string())?;
        let log = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(logs.join("voice.log"))
            .map_err(|e| e.to_string())?;
        let mut cmd = Command::new(python);
        cmd.arg(&script)
            .arg(site_dir(&self.inner.data_dir))
            .current_dir(&root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::from(log))
            .kill_on_drop(true);
        confine(&mut cmd, &self.inner.data_dir);
        hide_window(&mut cmd);
        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Cannot start the voice engine: {e}"))?;
        #[cfg(windows)]
        if let Some(handle) = child.raw_handle() {
            crate::child_job::bind(handle);
        }
        let stdin = child.stdin.take().ok_or("no stdin")?;
        let stdout = child.stdout.take().ok_or("no stdout")?;
        let mut worker = Worker {
            child,
            stdin,
            lines: BufReader::new(stdout).lines(),
        };
        // The worker says "ready" once its libraries are loaded.
        match read_answer(&mut worker, None).await {
            Ok(v) if v["ready"] == true => Ok(worker),
            Ok(v) => Err(format!(
                "Unexpected start-up message from the voice engine: {v}"
            )),
            Err(e) => Err(format!("{e} (see logs/voice.log)")),
        }
    }

    fn touch(&self) {
        *self.inner.last_used.lock_safe() = Instant::now();
        let mut running = self.inner.reaper_running.lock_safe();
        if *running {
            return;
        }
        *running = true;
        let this = self.clone();
        let (idle_stop, check_every) = idle_timing();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(check_every).await;
                let idle = this.inner.last_used.lock_safe().elapsed() >= idle_stop;
                // Never stop a worker that is in the middle of a request: the lock is held then.
                if idle {
                    if let Ok(mut slot) = this.inner.worker.try_lock() {
                        if let Some(mut w) = slot.take() {
                            let _ = w.child.start_kill();
                        }
                        *this.inner.reaper_running.lock_safe() = false;
                        return;
                    }
                }
            }
        });
    }
}

/// The next answer line of the worker (lines without the marker are ignored); `id` of `None` accepts any.
async fn read_answer(w: &mut Worker, id: Option<u64>) -> Result<Value, String> {
    loop {
        let line = tokio::time::timeout(ANSWER_TIMEOUT, w.lines.next_line())
            .await
            .map_err(|_| "The voice engine took too long".to_string())?
            .map_err(|e| e.to_string())?
            .ok_or("The voice engine stopped")?;
        let Some(json) = line.strip_prefix(MARK) else {
            continue;
        };
        let value: Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
        if id.is_none() || value["id"].as_u64() == id {
            return Ok(value);
        }
    }
}

#[async_trait::async_trait]
impl VoiceEngine for QwenVoice {
    async fn speak(
        &self,
        p: &VoiceParams,
        out: &Path,
        cancel: &CancellationToken,
    ) -> Result<f64, String> {
        let model = model_for(p);
        let model_path = model_dir_in(&self.roots(), model);
        let id = self.inner.next_id.fetch_add(1, Ordering::Relaxed);
        let mut slot = self.inner.worker.lock().await;
        let exited = match slot.as_mut() {
            Some(w) => w.child.try_wait().map_err(|e| e.to_string())?.is_some(),
            None => true,
        };
        if exited {
            *slot = Some(tokio::select! {
                _ = cancel.cancelled() => return Err("cancelled".into()),
                w = self.start() => w?,
            });
        }
        let worker = slot.as_mut().expect("started above");
        let line = format!("{}\n", request_json(id, p, &model_path, out));
        worker
            .stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|e| e.to_string())?;
        worker.stdin.flush().await.map_err(|e| e.to_string())?;
        let answer = tokio::select! {
            _ = cancel.cancelled() => None,
            a = read_answer(worker, Some(id)) => Some(a),
        };
        let Some(answer) = answer else {
            // A synthesis cannot be interrupted: stop the process, the next request starts a fresh one.
            if let Some(mut w) = slot.take() {
                let _ = w.child.start_kill();
            }
            return Err("cancelled".into());
        };
        drop(slot);
        self.touch();
        let answer = answer?;
        if answer["ok"] == true {
            Ok(answer["seconds"].as_f64().unwrap_or(0.0))
        } else {
            Err(answer["error"]
                .as_str()
                .unwrap_or("The voice engine failed")
                .to_string())
        }
    }

    fn shutdown(&self) {
        if let Ok(mut slot) = self.inner.worker.try_lock() {
            if let Some(mut w) = slot.take() {
                let _ = w.child.start_kill();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn params(mode: VoiceMode) -> VoiceParams {
        VoiceParams {
            text: "こんにちは".into(),
            language: "Japanese".into(),
            mode,
            speaker: "Ono_Anna".into(),
            instruct: String::new(),
        }
    }

    #[test]
    fn the_mode_picks_the_model() {
        assert_eq!(
            model_for(&params(VoiceMode::Preset)).dir,
            "custom_voice_1.7b"
        );
        assert_eq!(
            model_for(&params(VoiceMode::Design)).dir,
            "voice_design_1.7b"
        );
    }

    #[test]
    fn installed_needs_the_libraries_and_both_models() {
        let data = tempfile::tempdir().unwrap();
        let models = data.path().join("models");
        assert!(
            matches!(disk_status(data.path(), &models), PackStatus::Missing { total_bytes } if total_bytes > 8_000_000_000)
        );
        std::fs::create_dir_all(site_dir(data.path())).unwrap();
        std::fs::write(site_dir(data.path()).join(".ready"), b"x").unwrap();
        std::fs::create_dir_all(model_dir(&models, &CUSTOM_VOICE)).unwrap();
        std::fs::write(model_dir(&models, &CUSTOM_VOICE).join(".complete"), b"x").unwrap();
        // One model is still missing.
        assert!(
            matches!(disk_status(data.path(), &models), PackStatus::Missing { total_bytes } if total_bytes < 5_000_000_000)
        );
        std::fs::create_dir_all(model_dir(&models, &VOICE_DESIGN)).unwrap();
        std::fs::write(model_dir(&models, &VOICE_DESIGN).join(".complete"), b"x").unwrap();
        assert_eq!(disk_status(data.path(), &models), PackStatus::Ready);
    }

    #[test]
    fn voice_models_in_a_shared_root_count_and_are_loaded_from_there() {
        let data = tempfile::tempdir().unwrap();
        let own = data.path().join("models");
        let shared = tempfile::tempdir().unwrap();
        let roots = [own.clone(), shared.path().to_path_buf()];
        std::fs::create_dir_all(site_dir(data.path())).unwrap();
        std::fs::write(site_dir(data.path()).join(".ready"), b"x").unwrap();
        for m in [&CUSTOM_VOICE, &VOICE_DESIGN] {
            std::fs::create_dir_all(model_dir(shared.path(), m)).unwrap();
            std::fs::write(model_dir(shared.path(), m).join(".complete"), b"x").unwrap();
        }
        assert!(matches!(
            disk_status(data.path(), &own),
            PackStatus::Missing { .. }
        ));
        assert_eq!(disk_status_in(data.path(), &roots), PackStatus::Ready);
        assert_eq!(
            model_dir_in(&roots, &CUSTOM_VOICE),
            model_dir(shared.path(), &CUSTOM_VOICE)
        );
        // Complete in the own folder too: the own copy is used. Complete nowhere: the own path (where an install writes).
        std::fs::create_dir_all(model_dir(&own, &CUSTOM_VOICE)).unwrap();
        std::fs::write(model_dir(&own, &CUSTOM_VOICE).join(".complete"), b"x").unwrap();
        assert_eq!(
            model_dir_in(&roots, &CUSTOM_VOICE),
            model_dir(&own, &CUSTOM_VOICE)
        );
        let empty = [own.clone(), data.path().join("nowhere")];
        assert_eq!(
            model_dir_in(&empty, &VOICE_DESIGN),
            model_dir(&own, &VOICE_DESIGN)
        );
    }

    #[test]
    fn the_request_line_carries_everything_the_worker_needs() {
        let v = request_json(
            7,
            &params(VoiceMode::Preset),
            Path::new("D:/m/custom"),
            Path::new("D:/out/a.wav"),
        );
        assert_eq!(v["id"], 7);
        assert_eq!(v["mode"], "preset");
        assert_eq!(v["speaker"], "Ono_Anna");
        assert_eq!(v["language"], "Japanese");
        assert_eq!(v["out"], "D:/out/a.wav");
        assert_eq!(
            request_json(
                1,
                &params(VoiceMode::Design),
                Path::new("m"),
                Path::new("o")
            )["mode"],
            "design"
        );
    }

    #[test]
    fn libraries_come_from_the_pip_report_without_the_demo_extras() {
        let report = json!({"install": [
            {"metadata": {"name": "qwen-tts", "version": "0.1.1"}},
            {"metadata": {"name": "transformers", "version": "4.57.3"}},
            {"metadata": {"name": "gradio", "version": "6.0"}},
            {"metadata": {"name": "Pandas", "version": "3.0"}},
            {"metadata": {"name": "narwhals", "version": "2.26.0"}},
        ]});
        assert_eq!(
            libraries_from_report(&report),
            [
                "qwen-tts==0.1.1",
                "transformers==4.57.3",
                "narwhals==2.26.0"
            ]
        );
        assert!(libraries_from_report(&json!({})).is_empty());
    }

    #[test]
    fn only_model_files_are_downloaded() {
        let tree = json!([
            {"type": "file", "path": "config.json", "size": 10},
            {"type": "file", "path": "model.safetensors", "size": 20},
            {"type": "file", "path": "speech_tokenizer/model.safetensors", "size": 30},
            {"type": "file", "path": "README.md", "size": 1},
            {"type": "file", "path": "assets/cover.png", "size": 1},
            {"type": "file", "path": ".gitattributes", "size": 1},
            {"type": "file", "path": "../evil.json", "size": 1},
            {"type": "directory", "path": "speech_tokenizer"},
        ]);
        let names: Vec<String> = wanted_files(&tree).into_iter().map(|(p, _)| p).collect();
        assert_eq!(
            names,
            [
                "config.json",
                "model.safetensors",
                "speech_tokenizer/model.safetensors"
            ]
        );
    }
}
