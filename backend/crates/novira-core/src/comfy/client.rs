//! ComfyUI over HTTP and WebSocket: `/prompt` to queue, `/ws` for progress and previews, `/history` and `/view`
//! for the result. Success is decided from the history entry, not from a single WebSocket message, and a lost
//! WebSocket falls back to polling instead of failing the job.
use super::graph::{self, ControlInput, GraphInput, GuidanceInput, RefInput, RegionInput};
use super::install;
use super::process::ComfyProcess;
use super::ui_locale::ComfyUiLocale;
use super::user_graph;
use crate::engine::{
    is_out_of_memory, Engine, EngineError, EngineJob, EngineOutput, EngineProgress, EngineStatus,
    GraphJob, ProgressFn, StatusSink,
};
use crate::sync::{LockExt, RwLockExt};
use crate::types::{ComfyRef, GenerationMode};
use base64::Engine as _;
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, RwLock};
use std::time::{Duration, Instant};
use tokio_tungstenite::tungstenite::Message;
use tokio_util::sync::CancellationToken;

const PING_TIMEOUT: Duration = Duration::from_secs(3);
const POLL_WITHOUT_WS: Duration = Duration::from_secs(1);
const POLL_WITH_WS: Duration = Duration::from_secs(10);

#[derive(Debug, Clone, PartialEq)]
pub enum WsEvent {
    /// `node` is the node reporting (ComfyUI sends it with every progress message).
    Progress {
        value: u32,
        max: u32,
        node: Option<String>,
    },
    Done,
    Error(String),
    Interrupted,
    Other,
}

/// Reads one JSON WebSocket message; events for other prompts are `Other`.
pub fn parse_ws_text(text: &str, prompt_id: &str) -> WsEvent {
    let Ok(v) = serde_json::from_str::<Value>(text) else {
        return WsEvent::Other;
    };
    let data = &v["data"];
    let ours = data["prompt_id"].as_str() == Some(prompt_id);
    match v["type"].as_str() {
        Some("progress") if ours || data["prompt_id"].is_null() => WsEvent::Progress {
            value: data["value"].as_u64().unwrap_or(0) as u32,
            max: data["max"].as_u64().unwrap_or(0) as u32,
            node: data["node"].as_str().map(Into::into),
        },
        Some("executing") if ours && data["node"].is_null() => WsEvent::Done,
        Some("execution_success") if ours => WsEvent::Done,
        Some("execution_error") if ours => WsEvent::Error(error_text(data)),
        Some("execution_interrupted") if ours => WsEvent::Interrupted,
        _ => WsEvent::Other,
    }
}

/// The step and total to show for a progress message. A graph with several sampling passes (`passes`) counts on
/// through its `total` (a sampler's step plus the steps before it), and progress of other nodes in between (an
/// upscale model's tiles) holds the last step. A graph with one pass shows the message as ComfyUI sends it.
pub fn shown_progress(
    passes: &[(String, u32)],
    total: u32,
    last_step: u32,
    node: Option<&str>,
    value: u32,
    max: u32,
) -> (u32, u32) {
    if passes.is_empty() {
        return (value, max.max(1));
    }
    match passes.iter().find(|(id, _)| Some(id.as_str()) == node) {
        Some((_, before)) => (before.saturating_add(value).min(total), total.max(1)),
        None => (last_step, total.max(1)),
    }
}

fn error_text(data: &Value) -> String {
    let node = data["node_type"].as_str().unwrap_or("node");
    let msg = data["exception_message"]
        .as_str()
        .unwrap_or("execution failed")
        .trim();
    format!("ComfyUI {node}: {msg}")
}

/// A binary preview frame as a `data:` URL. Handles `PREVIEW_IMAGE` (1) and `PREVIEW_IMAGE_WITH_METADATA` (4).
pub fn parse_preview(bytes: &[u8]) -> Option<String> {
    let event = u32::from_be_bytes(bytes.get(0..4)?.try_into().ok()?);
    let (mime, image) = match event {
        1 => {
            let kind = u32::from_be_bytes(bytes.get(4..8)?.try_into().ok()?);
            (
                if kind == 2 { "image/png" } else { "image/jpeg" },
                bytes.get(8..)?,
            )
        }
        4 => {
            let len = u32::from_be_bytes(bytes.get(4..8)?.try_into().ok()?) as usize;
            let meta: Value = serde_json::from_slice(bytes.get(8..8 + len)?).ok()?;
            let mime = if meta["image_type"].as_str() == Some("image/png") {
                "image/png"
            } else {
                "image/jpeg"
            };
            (mime, bytes.get(8 + len..)?)
        }
        _ => return None,
    };
    if image.is_empty() {
        return None;
    }
    Some(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(image)
    ))
}

/// The error text of a rejected `/prompt` (validation errors per node).
pub fn prompt_error_text(body: &Value) -> String {
    let mut parts = vec![body["error"]["message"]
        .as_str()
        .unwrap_or("ComfyUI rejected the prompt")
        .to_string()];
    if let Some(nodes) = body["node_errors"].as_object() {
        for n in nodes.values() {
            let class = n["class_type"].as_str().unwrap_or("node");
            for e in n["errors"].as_array().into_iter().flatten() {
                let details = e["details"]
                    .as_str()
                    .filter(|d| !d.is_empty())
                    .or(e["message"].as_str())
                    .unwrap_or("");
                parts.push(format!("{class}: {details}"));
            }
        }
    }
    parts.join(" / ")
}

pub struct ComfyEngine {
    pub(super) http: reqwest::Client,
    base: reqwest::Url,
    client_id: String,
    pub(super) process: Option<ComfyProcess>,
    start_timeout: Duration,
    pub(super) start_lock: tokio::sync::Mutex<()>,
    /// Where to download ComfyUI to (install root) and which package, when novira manages its own copy.
    pub(super) installer: Option<(PathBuf, String)>,
    status: Mutex<EngineStatus>,
    sink: RwLock<Option<StatusSink>>,
    /// Set while a package change runs (`change_package`): the start that the change ends must not look for another
    /// change, or a change that failed would be tried again in a loop.
    pub(super) switching_package: AtomicBool,
}

fn failed(e: impl std::fmt::Display) -> EngineError {
    EngineError::Failed(e.to_string())
}

impl ComfyEngine {
    pub fn new(
        base_url: &str,
        process: Option<ComfyProcess>,
        start_timeout: Duration,
    ) -> Result<Self, String> {
        let base = reqwest::Url::parse(base_url)
            .map_err(|e| format!("Invalid ComfyUI URL {base_url}: {e}"))?;
        if !matches!(base.scheme(), "http" | "https") {
            return Err(format!("Invalid ComfyUI URL {base_url}"));
        }
        let http = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(5))
            .no_gzip()
            .no_brotli()
            .build()
            .map_err(|e| e.to_string())?;
        Ok(Self {
            http,
            base,
            client_id: uuid::Uuid::new_v4().to_string(),
            process,
            start_timeout,
            start_lock: tokio::sync::Mutex::new(()),
            installer: None,
            status: Mutex::new(EngineStatus::Idle),
            sink: RwLock::new(None),
            switching_package: AtomicBool::new(false),
        })
    }

    /// Download ComfyUI into `root` when `main.py` is missing (the package name comes from the settings).
    pub fn with_installer(mut self, root: PathBuf, package: String) -> Self {
        self.installer = Some((root, package));
        self
    }

    pub(super) fn set_status(&self, next: EngineStatus) {
        {
            let mut cur = self.status.lock_safe();
            if *cur == next {
                return;
            }
            *cur = next.clone();
        }
        if let Some(sink) = self.sink.read_safe().as_ref() {
            sink(next);
        }
    }

    fn url(&self, path: &str) -> reqwest::Url {
        self.base.join(path).expect("static paths join")
    }

    fn ws_url(&self) -> String {
        let mut u = self.url("ws");
        let scheme = if self.base.scheme() == "https" {
            "wss"
        } else {
            "ws"
        };
        let _ = u.set_scheme(scheme);
        u.set_query(Some(&format!("clientId={}", self.client_id)));
        u.to_string()
    }

    pub async fn ping(&self) -> bool {
        matches!(
            self.http.get(self.url("system_stats")).timeout(PING_TIMEOUT).send().await,
            Ok(r) if r.status().is_success()
        )
    }

    /// Answers when the server is up; installs and starts the owned ComfyUI first when one is configured.
    pub async fn ensure_ready(&self, cancel: &CancellationToken) -> Result<(), EngineError> {
        match self.ensure_ready_inner(cancel).await {
            Ok(()) => {
                self.set_status(EngineStatus::Ready);
                Ok(())
            }
            Err(EngineError::Cancelled) => Err(EngineError::Cancelled),
            Err(e) => {
                self.set_status(EngineStatus::Error {
                    message: e.to_string(),
                });
                Err(e)
            }
        }
    }

    async fn ensure_ready_inner(&self, cancel: &CancellationToken) -> Result<(), EngineError> {
        if self.ping().await {
            return Ok(());
        }
        let Some(process) = &self.process else {
            return Err(EngineError::Failed(format!(
                "ComfyUI is not reachable at {}",
                self.base
            )));
        };
        let changed = {
            let _guard = self.start_lock.lock().await;
            if self.ping().await {
                return Ok(());
            }
            let mut changed = false;
            if let Some((root, package)) = &self.installer {
                if !install::is_installed(root) {
                    install::install(&self.http, root, package, cancel, &|s| self.set_status(s))
                        .await?;
                } else if !self.switching_package.load(Ordering::SeqCst) {
                    changed = install::package_changed(root, package).map_err(failed)?;
                }
            }
            changed
        };
        if changed {
            // The install came from another package than the settings name: that package is installed in its place,
            // and the start is done by that change. Boxed, because the change starts this function again (through
            // `switch_to`), and a future cannot contain itself.
            return Box::pin(self.change_package(cancel)).await;
        }
        self.set_status(EngineStatus::Starting);
        process.start().map_err(EngineError::Failed)?;
        let deadline = Instant::now() + self.start_timeout;
        while Instant::now() < deadline {
            tokio::select! {
                _ = cancel.cancelled() => return Err(EngineError::Cancelled),
                _ = tokio::time::sleep(Duration::from_secs(1)) => {}
            }
            if self.ping().await {
                return Ok(());
            }
            if !process.is_running() {
                return Err(EngineError::Failed(
                    "ComfyUI exited while starting; see logs/comfyui.log".into(),
                ));
            }
        }
        Err(EngineError::Failed(
            "ComfyUI did not answer in time; see logs/comfyui.log".into(),
        ))
    }

    /// A text file the server serves, at most `limit` bytes.
    async fn get_text(&self, path: &str, limit: usize) -> Result<String, EngineError> {
        let res = self.http.get(self.url(path)).send().await.map_err(failed)?;
        if !res.status().is_success() {
            return Err(failed(format!("ComfyUI {path} answered {}", res.status())));
        }
        if res.content_length().is_some_and(|n| n > limit as u64) {
            return Err(failed(format!("ComfyUI {path} is too large")));
        }
        let bytes = res.bytes().await.map_err(failed)?;
        if bytes.len() > limit {
            return Err(failed(format!("ComfyUI {path} is too large")));
        }
        String::from_utf8(bytes.to_vec()).map_err(failed)
    }

    async fn get_json(&self, path: &str) -> Result<Value, EngineError> {
        let res = self.http.get(self.url(path)).send().await.map_err(failed)?;
        if !res.status().is_success() {
            return Err(failed(format!("ComfyUI {path} answered {}", res.status())));
        }
        res.json().await.map_err(failed)
    }

    /// The GGUF files of a folder, as the loader node of the GGUF pack lists them.
    async fn list_gguf(&self, folder: &str) -> Result<Vec<String>, EngineError> {
        let (node, input) = match folder {
            "diffusion_models" | "unet" => ("UnetLoaderGGUF", "unet_name"),
            _ => ("CLIPLoaderGGUF", "clip_name"),
        };
        let info = self.get_json(&format!("object_info/{node}")).await?;
        Ok(info[node]["input"]["required"][input][0]
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|s| s.as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default())
    }

    async fn list_models(&self, folder: &str) -> Result<Vec<String>, EngineError> {
        let v = self.get_json(&format!("models/{folder}")).await?;
        Ok(v.as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|s| s.as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default())
    }

    async fn upload(&self, png: &[u8]) -> Result<String, EngineError> {
        self.upload_as(png, "png", "image/png").await
    }

    /// Puts a file in ComfyUI's input folder; `ext` decides which loader nodes list it.
    async fn upload_as(&self, bytes: &[u8], ext: &str, mime: &str) -> Result<String, EngineError> {
        let part = reqwest::multipart::Part::bytes(bytes.to_vec())
            .file_name(format!("novira-{}.{ext}", uuid::Uuid::new_v4().simple()))
            .mime_str(mime)
            .map_err(failed)?;
        let form = reqwest::multipart::Form::new()
            .part("image", part)
            .text("type", "input")
            .text("overwrite", "true");
        let res = self
            .http
            .post(self.url("upload/image"))
            .multipart(form)
            .send()
            .await
            .map_err(failed)?;
        if !res.status().is_success() {
            return Err(failed(format!(
                "ComfyUI image upload answered {}",
                res.status()
            )));
        }
        let v: Value = res.json().await.map_err(failed)?;
        let name = v["name"]
            .as_str()
            .ok_or_else(|| failed("ComfyUI upload returned no name"))?;
        Ok(match v["subfolder"].as_str() {
            Some(sub) if !sub.is_empty() => format!("{sub}/{name}"),
            _ => name.to_string(),
        })
    }

    async fn queue_prompt(&self, prompt: &Value) -> Result<String, EngineError> {
        let res = self
            .http
            .post(self.url("prompt"))
            .json(&json!({ "prompt": prompt, "client_id": self.client_id }))
            .send()
            .await
            .map_err(failed)?;
        let status = res.status();
        let body: Value = res.json().await.unwrap_or(Value::Null);
        if !status.is_success() {
            return Err(EngineError::Failed(prompt_error_text(&body)));
        }
        body["prompt_id"]
            .as_str()
            .map(str::to_string)
            .ok_or_else(|| failed("ComfyUI returned no prompt id"))
    }

    async fn history(&self, prompt_id: &str) -> Result<Option<Value>, EngineError> {
        let v = self.get_json(&format!("history/{prompt_id}")).await?;
        Ok(v.get(prompt_id).cloned())
    }

    /// Asks ComfyUI to unload its models and drop its cached results (`POST /free`). Its prompt worker does it before
    /// the next prompt; a failed request is only logged, the job's own error is what the user sees.
    async fn free_memory(&self) {
        let res = self
            .http
            .post(self.url("free"))
            .json(&json!({ "unload_models": true, "free_memory": true }))
            .send()
            .await;
        match res {
            Ok(r) if r.status().is_success() => {}
            Ok(r) => crate::applog::warn("comfy", format!("ComfyUI /free answered {}", r.status())),
            Err(e) => crate::applog::warn("comfy", format!("ComfyUI /free failed: {e}")),
        }
    }

    async fn interrupt(&self, prompt_id: &str) {
        // Remove it if it is still waiting, then stop it if it is running. Both are scoped to our prompt id.
        let _ = self
            .http
            .post(self.url("queue"))
            .json(&json!({ "delete": [prompt_id] }))
            .send()
            .await;
        let _ = self
            .http
            .post(self.url("interrupt"))
            .json(&json!({ "prompt_id": prompt_id }))
            .send()
            .await;
    }

    /// Reads what the finished job produced: the PNG of an image job, the MP4 and first frame of a video job, or the
    /// audio file of a music job. The graphs the editor builds say what their output is only by the file it saved, so
    /// the kind comes from the file's name (`ResultKind`).
    async fn fetch_result(
        &self,
        entry: &Value,
        built: &graph::BuiltGraph,
    ) -> Result<EngineOutput, EngineError> {
        if let Some(text) = output_text(entry, &built.output_node)? {
            return Ok(EngineOutput::Text(text));
        }
        let file = self.fetch_output_file(entry, &built.output_node).await?;
        if let Some(ext) = built.audio_ext {
            return Ok(EngineOutput::Audio {
                bytes: file.bytes,
                ext,
            });
        }
        match result_kind(&file.name)? {
            ResultKind::Audio(ext) => Ok(EngineOutput::Audio {
                bytes: file.bytes,
                ext,
            }),
            ResultKind::Video => {
                let thumb = built.thumbnail_node.as_deref().ok_or_else(|| {
                    failed("A video output needs a node that gives its first frame")
                })?;
                Ok(EngineOutput::Video {
                    mp4: file.bytes,
                    frame_png: self.fetch_output(entry, thumb).await?,
                })
            }
            ResultKind::Image => Ok(EngineOutput::Image(file.bytes)),
        }
    }

    /// The picture a `no_result` job's first output node showed, or `Nothing`. The job's own
    /// result is already in ComfyUI's folder, so a picture that cannot be read is only logged.
    async fn side_picture(&self, entry: &Value, node: &str) -> EngineOutput {
        if entry["outputs"][node]["images"].get(0).is_none() {
            return EngineOutput::Nothing;
        }
        match self.fetch_output(entry, node).await {
            Ok(png) => EngineOutput::Image(png),
            Err(e) => {
                crate::applog::warn("comfy", format!("cannot read the picture of {node}: {e}"));
                EngineOutput::Nothing
            }
        }
    }

    async fn fetch_output(&self, entry: &Value, node: &str) -> Result<Vec<u8>, EngineError> {
        Ok(self.fetch_output_file(entry, node).await?.bytes)
    }

    /// The first file an output node reported, with the name ComfyUI gave it.
    async fn fetch_output_file(
        &self,
        entry: &Value,
        node: &str,
    ) -> Result<OutputFile, EngineError> {
        entry_failed(entry)?;
        let out = &entry["outputs"][node];
        let img = ["images", "videos", "gifs", "audio"]
            .iter()
            .find_map(|k| out[*k].get(0))
            .ok_or_else(|| failed("ComfyUI finished without a result file"))?;
        let name = img["filename"].as_str().unwrap_or_default();
        let res = self
            .http
            .get(self.url("view"))
            .query(&[
                ("filename", name),
                ("subfolder", img["subfolder"].as_str().unwrap_or_default()),
                ("type", img["type"].as_str().unwrap_or("temp")),
            ])
            .send()
            .await
            .map_err(failed)?;
        if !res.status().is_success() {
            return Err(failed(format!("ComfyUI /view answered {}", res.status())));
        }
        Ok(OutputFile {
            bytes: res.bytes().await.map_err(failed)?.to_vec(),
            name: name.to_string(),
        })
    }

    /// Fails with a readable reason when ComfyUI cannot see one of the models.
    async fn check_models(&self, refs: Vec<&ComfyRef>) -> Result<(), EngineError> {
        let mut lists: HashMap<String, Vec<String>> = HashMap::new();
        for r in refs {
            // ComfyUI lists no `.gguf` file under its folders: the GGUF pack's loaders list their own.
            let gguf = super::split::is_gguf(&r.name);
            let key = format!("{}{}", r.folder, if gguf { "#gguf" } else { "" });
            if !lists.contains_key(&key) {
                let list = if gguf {
                    self.list_gguf(&r.folder).await?
                } else {
                    self.list_models(&r.folder).await?
                };
                lists.insert(key.clone(), list);
            }
            let known = &lists[&key];
            let normalize = |s: &str| s.replace('\\', "/");
            if !known.iter().any(|k| normalize(k) == normalize(&r.name)) {
                return Err(EngineError::Failed(format!(
                    "ComfyUI does not see {} in {} (check model roots / extra_model_paths)",
                    r.name, r.folder
                )));
            }
        }
        Ok(())
    }

    /// An editor-built prompt: its models are visible and every node class it uses is installed.
    async fn validate_graph(&self, g: &GraphJob) -> Result<(), EngineError> {
        self.ensure_ready(&CancellationToken::new()).await?;
        self.check_models(g.models.iter().collect()).await?;
        let info = self.get_json("object_info").await?;
        let missing: Vec<String> = user_graph::classes(&g.prompt)
            .into_iter()
            .filter(|c| info.get(c).is_none())
            .collect();
        if !missing.is_empty() {
            return Err(EngineError::Failed(format!(
                "ComfyUI has no {} node; install the custom node pack that provides it",
                missing.join(", ")
            )));
        }
        Ok(())
    }

    /// Uploads the pictures of an editor-built prompt and puts their ComfyUI names in.
    async fn graph_prompt(&self, g: &GraphJob) -> Result<graph::BuiltGraph, EngineError> {
        let mut uploaded = HashMap::new();
        for (name, bytes) in &g.images {
            let up = if crate::media::images::is_video(name) {
                self.upload_as(bytes, "mp4", "video/mp4").await?
            } else if let Some(ext) = crate::media::audio::extension_of(name) {
                self.upload_as(bytes, ext, "application/octet-stream")
                    .await?
            } else {
                self.upload(bytes).await?
            };
            uploaded.insert(name.clone(), up);
        }
        let mut prompt = g.prompt.clone();
        user_graph::fill_images(&mut prompt, &uploaded).map_err(EngineError::Failed)?;
        let output_node = g
            .outputs
            .first()
            .cloned()
            .ok_or_else(|| failed("The graph has no output node"))?;
        Ok(graph::BuiltGraph {
            prompt,
            output_node,
            total_steps: 1,
            thumbnail_node: g.thumbnail.clone(),
            audio_ext: None,
            passes: Vec::new(),
        })
    }

    /// Puts the mask, control pictures and reference pictures of a job in ComfyUI's input folder.
    async fn upload_guidance(&self, job: &EngineJob) -> Result<Uploaded, EngineError> {
        let g = &job.guidance;
        let mask = match &g.mask {
            Some(png) => Some(self.upload(png).await?),
            None => None,
        };
        let mut controls = Vec::with_capacity(g.controls.len());
        for c in &g.controls {
            controls.push(self.upload(&c.image).await?);
        }
        let mut regions = Vec::with_capacity(g.regions.len());
        for r in &g.regions {
            regions.push(self.upload(&r.mask).await?);
        }
        let mut refs = Vec::with_capacity(g.refs.len());
        let mut ref_regions = Vec::with_capacity(g.refs.len());
        for r in &g.refs {
            refs.push(self.upload(&r.image).await?);
            ref_regions.push(match &r.region {
                Some(png) => Some(self.upload(png).await?),
                None => None,
            });
        }
        let mut references = Vec::with_capacity(g.references.len());
        for png in &g.references {
            references.push(self.upload(png).await?);
        }
        Ok(Uploaded {
            mask,
            controls,
            regions,
            refs,
            ref_regions,
            references,
        })
    }
}

/// ComfyUI's names of a job's uploaded guidance pictures, in the job's order.
#[derive(Debug, Default)]
struct Uploaded {
    mask: Option<String>,
    controls: Vec<String>,
    regions: Vec<String>,
    refs: Vec<String>,
    /// The region of each reference, when it has one.
    ref_regions: Vec<Option<String>>,
    /// The pictures the main model takes in itself as references.
    references: Vec<String>,
}

impl Uploaded {
    /// Stand-in names for a dry build before anything is uploaded.
    fn placeholders(job: &EngineJob) -> Self {
        let g = &job.guidance;
        Uploaded {
            mask: g.mask.as_ref().map(|_| "validate-mask.png".to_string()),
            controls: vec!["validate-control.png".to_string(); g.controls.len()],
            regions: vec!["validate-region.png".to_string(); g.regions.len()],
            refs: vec!["validate-ref.png".to_string(); g.refs.len()],
            ref_regions: g
                .refs
                .iter()
                .map(|r| {
                    r.region
                        .as_ref()
                        .map(|_| "validate-ref-region.png".to_string())
                })
                .collect(),
            references: vec!["validate-reference.png".to_string(); g.references.len()],
        }
    }
}

fn graph_input<'a>(
    job: &'a EngineJob,
    init_image: Option<&'a str>,
    uploaded: &'a Uploaded,
) -> GraphInput<'a> {
    let g = &job.guidance;
    GraphInput {
        params: &job.params,
        checkpoint: &job.checkpoint,
        vae: job.vae.as_ref(),
        loras: job.loras.iter().map(|(r, w)| (r, *w)).collect(),
        upscale_model: job.upscale_model.as_ref(),
        tile_controlnet: job.tile_controlnet.as_ref(),
        post_processing_model: job.post_processing_model.as_ref(),
        text_encoder: job.text_encoder.as_ref(),
        split: job.split.as_ref(),
        init_image,
        guidance: GuidanceInput {
            mask_image: uploaded.mask.as_deref(),
            controls: g
                .controls
                .iter()
                .zip(&uploaded.controls)
                .map(|(c, image)| ControlInput {
                    model: &c.model,
                    image,
                    weight: c.weight,
                    begin_end: c.begin_end,
                    mode: c.mode,
                    union_type: c.union_type,
                })
                .collect(),
            regions: g
                .regions
                .iter()
                .zip(&uploaded.regions)
                .map(|(r, image)| RegionInput {
                    mask_image: image,
                    positive: r.positive.as_deref(),
                    negative: r.negative.as_deref(),
                    auto_negative: r.auto_negative,
                })
                .collect(),
            refs: g
                .refs
                .iter()
                .zip(&uploaded.refs)
                .zip(&uploaded.ref_regions)
                .map(|((r, image), region)| RefInput {
                    model: &r.model,
                    clip_vision: &r.clip_vision,
                    image,
                    weight: r.weight,
                    begin_end: r.begin_end,
                    method: r.method,
                    region: region.as_deref(),
                })
                .collect(),
            references: uploaded.references.iter().map(String::as_str).collect(),
        },
    }
}

/// The error a history entry reports, if the job failed.
fn entry_failed(entry: &Value) -> Result<(), EngineError> {
    let status = &entry["status"];
    if status["status_str"].as_str() == Some("error") {
        let msg = status["messages"]
            .as_array()
            .into_iter()
            .flatten()
            .find(|m| m[0] == "execution_error")
            .map(|m| error_text(&m[1]))
            .unwrap_or_else(|| "ComfyUI reported an error".into());
        return Err(EngineError::Failed(msg));
    }
    Ok(())
}

/// A file an output node saved.
struct OutputFile {
    bytes: Vec<u8>,
    /// The name ComfyUI gave it (`ComfyUI_00001_.mp4`).
    name: String,
}

/// What a result file is, by its name.
#[derive(Debug, PartialEq)]
enum ResultKind {
    Image,
    Video,
    /// With the extension the gallery stores it under.
    Audio(&'static str),
}

const VIDEO_EXTENSIONS: [&str; 4] = ["mp4", "webm", "mkv", "mov"];

/// The kind of a result file. The gallery keeps pictures as PNG, videos as MP4 and sounds as MP3, WAV or FLAC, so a
/// file in another container is refused with the way out instead of failing at the store.
fn result_kind(name: &str) -> Result<ResultKind, EngineError> {
    let ext = name
        .rsplit_once('.')
        .map(|(_, e)| e.to_ascii_lowercase())
        .unwrap_or_default();
    if let Some(known) = crate::media::audio::EXTENSIONS
        .iter()
        .find(|e| **e == ext.as_str())
    {
        return Ok(ResultKind::Audio(known));
    }
    if ["opus", "ogg", "m4a", "aac"].contains(&ext.as_str()) {
        return Err(failed(format!(
            "The gallery keeps sound as MP3, WAV or FLAC, not .{ext}; save it in one of those formats"
        )));
    }
    if ext == "mp4" {
        return Ok(ResultKind::Video);
    }
    if VIDEO_EXTENSIONS.contains(&ext.as_str()) {
        return Err(failed(format!(
            "The gallery keeps video as MP4, not .{ext}; save the video as MP4"
        )));
    }
    Ok(ResultKind::Image)
}

/// The text an output node showed (`PreviewAny` reports `{"text": [value]}`), when it showed text and no file.
pub fn output_text(entry: &Value, node: &str) -> Result<Option<String>, EngineError> {
    entry_failed(entry)?;
    let out = &entry["outputs"][node];
    if ["images", "videos", "gifs", "audio"]
        .iter()
        .any(|k| out[*k].get(0).is_some())
    {
        return Ok(None);
    }
    Ok(match &out["text"] {
        Value::Array(parts) if !parts.is_empty() => Some(
            parts
                .iter()
                .map(|p| {
                    p.as_str()
                        .map(str::to_string)
                        .unwrap_or_else(|| p.to_string())
                })
                .collect::<Vec<_>>()
                .join(
                    "
",
                ),
        ),
        Value::String(t) => Some(t.clone()),
        _ => None,
    })
}

fn is_done(entry: &Value) -> bool {
    entry["status"]["completed"].as_bool() == Some(true)
        || matches!(
            entry["status"]["status_str"].as_str(),
            Some("success" | "error")
        )
}

#[async_trait::async_trait]
impl Engine for ComfyEngine {
    async fn validate(&self, job: &EngineJob) -> Result<(), EngineError> {
        if let Some(g) = &job.graph {
            return self.validate_graph(g).await;
        }
        // A dry build catches unsupported parameters before anything is uploaded.
        let placeholders = Uploaded::placeholders(job);
        // The dry build sees a source picture only when the job has one: a text-to-video model refuses a picture.
        let source = job.init_image.as_ref().map(|_| "validate.png");
        let built =
            graph::build(&graph_input(job, source, &placeholders)).map_err(EngineError::Failed)?;
        self.ensure_ready(&CancellationToken::new()).await?;
        // Some graphs use the nodes of a custom node pack (GGUF loaders, seamless tiling), which ComfyUI does not have.
        for need in super::split::packs_needed(&built.prompt) {
            let node = &need.node;
            let info = self.get_json(&format!("object_info/{node}")).await;
            if info.is_err() || info.is_ok_and(|i| i.get(node).is_none()) {
                return Err(EngineError::Failed(format!(
                    "{} need the {} custom node pack (no {node} node); install {} from the Extensions screen and restart ComfyUI",
                    need.what, need.pack, need.address
                )));
            }
        }
        if !job.guidance.refs.is_empty() {
            // Without the pack ComfyUI has neither the nodes nor the `ipadapter` model folder.
            let node = graph::IPADAPTER_NODE;
            let info = self.get_json(&format!("object_info/{node}")).await;
            if info.is_err() || info.is_ok_and(|i| i.get(node).is_none()) {
                return Err(EngineError::Failed(format!(
                    "Reference images need the ComfyUI_IPAdapter_plus custom node pack (no {node} node); install it and restart ComfyUI"
                )));
            }
        }
        let mut refs = vec![&job.checkpoint];
        refs.extend(job.vae.iter());
        refs.extend(job.loras.iter().map(|(r, _)| r));
        refs.extend(job.upscale_model.iter());
        refs.extend(job.tile_controlnet.iter());
        refs.extend(job.post_processing_model.iter());
        refs.extend(job.text_encoder.iter());
        refs.extend(job.split.iter().flat_map(|s| s.text_encoders.iter()));
        refs.extend(job.guidance.models());
        self.check_models(refs).await?;
        if job.params.generation_mode == GenerationMode::Video {
            let node = job
                .split
                .as_ref()
                .map_or("Wan22ImageToVideoLatent", |s| s.video_node());
            let info = self.get_json(&format!("object_info/{node}")).await;
            if info.is_err() || info.is_ok_and(|i| i.get(node).is_none()) {
                return Err(EngineError::Failed(format!(
                    "This ComfyUI is too old for video (no {node} node); update ComfyUI"
                )));
            }
        }
        if job.params.generation_mode == GenerationMode::Music {
            let info = self.get_json("object_info/TextEncodeAceStepAudio1.5").await;
            if info.is_err() || info.is_ok_and(|i| i.get("TextEncodeAceStepAudio1.5").is_none()) {
                return Err(EngineError::Failed(
                    "This ComfyUI is too old for ACE-Step 1.5 music (no TextEncodeAceStepAudio1.5 node); update ComfyUI".into(),
                ));
            }
        }
        if let Ok(info) = self.get_json("object_info/KSampler").await {
            let req = &info["KSampler"]["input"]["required"];
            let has = |field: &str, value: &str| {
                req[field][0]
                    .as_array()
                    .is_none_or(|opts| opts.iter().any(|o| o.as_str() == Some(value)))
            };
            if let Some((sampler, scheduler)) = graph::sampler_for(&job.params.scheduler) {
                if !has("sampler_name", sampler) || !has("scheduler", scheduler) {
                    return Err(EngineError::Failed(format!(
                        "This ComfyUI has no {sampler}/{scheduler} sampler"
                    )));
                }
            }
        }
        Ok(())
    }

    async fn generate(
        &self,
        job: &EngineJob,
        progress: ProgressFn<'_>,
        cancel: &CancellationToken,
    ) -> Result<EngineOutput, EngineError> {
        let result = self.run_job(job, progress, cancel).await;
        if let Err(EngineError::Failed(message)) = &result {
            // The next job needs the memory this one could not get.
            if is_out_of_memory(message) {
                self.free_memory().await;
            }
        }
        result
    }

    async fn prepare(&self, cancel: &CancellationToken) -> Result<(), EngineError> {
        self.ensure_ready(cancel).await
    }

    async fn pack_request(
        &self,
        cancel: &CancellationToken,
        route: &str,
        body: Option<Value>,
    ) -> Result<Value, EngineError> {
        self.ensure_ready(cancel).await?;
        let req = match body {
            Some(b) => self.http.post(self.url(route)).json(&b),
            None => self.http.get(self.url(route)),
        };
        let res = req.send().await.map_err(failed)?;
        if !res.status().is_success() {
            return Err(failed(format!(
                "ComfyUI {route} answered {}; is the custom node pack installed and loaded?",
                res.status()
            )));
        }
        res.json().await.map_err(failed)
    }

    async fn switch_version(
        &self,
        tag: &str,
        data_dir: &std::path::Path,
        cancel: &CancellationToken,
        on_pack: &(dyn Fn(String, crate::packs::PackStatus) + Send + Sync),
    ) -> Result<Vec<String>, EngineError> {
        self.switch_to(tag, data_dir, cancel, on_pack).await
    }

    async fn restart(&self, cancel: &CancellationToken) -> Result<(), EngineError> {
        let Some(process) = &self.process else {
            return Err(failed(
                "novira did not start this ComfyUI; restart it yourself",
            ));
        };
        {
            // Not while another caller is starting it.
            let _guard = self.start_lock.lock().await;
            process.stop();
            self.set_status(EngineStatus::Starting);
        }
        self.ensure_ready(cancel).await
    }

    async fn node_defs(&self, cancel: &CancellationToken) -> Result<Value, EngineError> {
        self.ensure_ready(cancel).await?;
        self.get_json("object_info").await
    }

    /// Follows the frontend ComfyUI serves to its locale files: the page names the entry script, which names the
    /// script that maps each language to its files. A frontend laid out otherwise (another version) gives None.
    async fn ui_locale(
        &self,
        cancel: &CancellationToken,
        locale: &str,
    ) -> Result<Option<ComfyUiLocale>, EngineError> {
        use super::ui_locale::{self as ui, MAX_SCRIPT_BYTES};
        let Some(language) = ui::comfy_language(locale) else {
            return Ok(None);
        };
        self.ensure_ready(cancel).await?;
        let asset = |name: String| format!("assets/{name}");
        let page = self.get_text("", MAX_SCRIPT_BYTES).await?;
        let Some(entry) = ui::entry_script(&page) else {
            return Ok(None);
        };
        let entry = self.get_text(&asset(entry), MAX_SCRIPT_BYTES).await?;
        let Some(map) = ui::i18n_script(&entry) else {
            return Ok(None);
        };
        let map = self.get_text(&asset(map), MAX_SCRIPT_BYTES).await?;
        let Some((main, nodes)) = ui::locale_scripts(&map, language) else {
            return Ok(None);
        };
        let main = self.get_text(&asset(main), MAX_SCRIPT_BYTES).await?;
        let nodes = self.get_text(&asset(nodes), MAX_SCRIPT_BYTES).await?;
        match ui::read_locale(&main, &nodes) {
            Ok(l) => Ok(Some(l)),
            Err(e) => {
                crate::applog::warn(
                    "engine",
                    format!("ComfyUI's {language} words are unreadable: {e}"),
                );
                Ok(None)
            }
        }
    }

    fn set_low_memory(&self, on: bool) -> bool {
        match &self.process {
            Some(p) => {
                p.set_low_memory(on);
                true
            }
            None => false,
        }
    }

    fn low_memory_pending(&self) -> bool {
        self.process
            .as_ref()
            .is_some_and(|p| p.low_memory_pending())
    }

    fn status(&self) -> EngineStatus {
        self.status.lock_safe().clone()
    }

    fn set_status_sink(&self, sink: StatusSink) {
        *self.sink.write_safe() = Some(sink);
    }

    fn shutdown(&self) {
        if let Some(p) = &self.process {
            p.stop();
        }
    }
}

impl ComfyEngine {
    /// One job from upload to result; `generate` adds the clean-up after running out of memory.
    async fn run_job(
        &self,
        job: &EngineJob,
        progress: ProgressFn<'_>,
        cancel: &CancellationToken,
    ) -> Result<EngineOutput, EngineError> {
        self.ensure_ready(cancel).await?;
        let built = if let Some(g) = &job.graph {
            self.graph_prompt(g).await?
        } else {
            let uploaded = match &job.init_image {
                Some(png) => Some(self.upload(png).await?),
                None => None,
            };
            let guidance = self.upload_guidance(job).await?;
            graph::build(&graph_input(job, uploaded.as_deref(), &guidance))
                .map_err(EngineError::Failed)?
        };
        let total = built.total_steps;

        // Connect before queueing so no progress message is missed.
        let mut ws = tokio_tungstenite::connect_async(self.ws_url())
            .await
            .ok()
            .map(|(s, _)| s);
        let prompt_id = self.queue_prompt(&built.prompt).await?;
        progress(EngineProgress {
            step: 0,
            total_steps: total,
            preview: None,
            message: "queued".into(),
        });

        let mut step = 0;
        let mut preview: Option<String> = None;
        let mut last_poll = Instant::now();
        loop {
            let poll_every = if ws.is_some() {
                POLL_WITH_WS
            } else {
                POLL_WITHOUT_WS
            };
            let next = async {
                match ws.as_mut() {
                    Some(s) => s.next().await,
                    None => std::future::pending().await,
                }
            };
            enum Next {
                Cancel,
                Ws(Option<Result<Message, tokio_tungstenite::tungstenite::Error>>),
                Poll,
            }
            let event = tokio::select! {
                _ = cancel.cancelled() => Next::Cancel,
                msg = next => Next::Ws(msg),
                _ = tokio::time::sleep(poll_every.saturating_sub(last_poll.elapsed())) => Next::Poll,
            };
            match event {
                Next::Cancel => {
                    self.interrupt(&prompt_id).await;
                    return Err(EngineError::Cancelled);
                }
                Next::Ws(Some(Ok(Message::Text(t)))) => match parse_ws_text(t.as_str(), &prompt_id)
                {
                    WsEvent::Progress { value, max, node } => {
                        let (shown, of) =
                            shown_progress(&built.passes, total, step, node.as_deref(), value, max);
                        step = shown;
                        progress(EngineProgress {
                            step: shown,
                            total_steps: of,
                            preview: preview.clone(),
                            message: "denoise".into(),
                        });
                    }
                    WsEvent::Done => break,
                    WsEvent::Error(e) => return Err(EngineError::Failed(e)),
                    WsEvent::Interrupted => {
                        return Err(EngineError::Failed("ComfyUI interrupted the job".into()))
                    }
                    WsEvent::Other => {}
                },
                Next::Ws(Some(Ok(Message::Binary(b)))) => {
                    if let Some(url) = parse_preview(&b) {
                        preview = Some(url);
                        progress(EngineProgress {
                            step,
                            total_steps: total,
                            preview: preview.clone(),
                            message: "denoise".into(),
                        });
                    }
                }
                Next::Ws(Some(Ok(_))) => {}
                // The socket dropped: keep going by polling the history.
                Next::Ws(Some(Err(_)) | None) => ws = None,
                Next::Poll => {
                    last_poll = Instant::now();
                    if let Some(entry) = self.history(&prompt_id).await? {
                        if is_done(&entry) {
                            break;
                        }
                    }
                }
            }
        }

        let no_result = job.graph.as_ref().is_some_and(|g| g.no_result);
        // The history entry may lag the WebSocket a little.
        for _ in 0..50 {
            if let Some(entry) = self.history(&prompt_id).await? {
                if no_result && is_done(&entry) {
                    entry_failed(&entry)?;
                    return Ok(self.side_picture(&entry, &built.output_node).await);
                }
                if is_done(&entry) || entry["outputs"][&built.output_node].is_object() {
                    return self.fetch_result(&entry, &built).await;
                }
            }
            tokio::time::sleep(crate::test_timing::retry_pause(Duration::from_millis(100))).await;
        }
        Err(failed(
            "ComfyUI finished but the result was not found in its history",
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ws_messages_for_other_prompts_are_ignored() {
        let p = r#"{"type":"progress","data":{"value":3,"max":20,"prompt_id":"a"}}"#;
        assert_eq!(
            parse_ws_text(p, "a"),
            WsEvent::Progress {
                value: 3,
                max: 20,
                node: None
            }
        );
        assert_eq!(parse_ws_text(p, "b"), WsEvent::Other);
        assert_eq!(
            parse_ws_text(
                r#"{"type":"progress","data":{"value":1,"max":4,"prompt_id":"a","node":"9"}}"#,
                "a"
            ),
            WsEvent::Progress {
                value: 1,
                max: 4,
                node: Some("9".into())
            }
        );
        assert_eq!(
            parse_ws_text(
                r#"{"type":"executing","data":{"node":null,"prompt_id":"a"}}"#,
                "a"
            ),
            WsEvent::Done
        );
        assert_eq!(
            parse_ws_text(
                r#"{"type":"executing","data":{"node":"5","prompt_id":"a"}}"#,
                "a"
            ),
            WsEvent::Other
        );
        assert_eq!(
            parse_ws_text(
                r#"{"type":"execution_error","data":{"prompt_id":"a","node_type":"KSampler","exception_message":"OOM\n"}}"#,
                "a"
            ),
            WsEvent::Error("ComfyUI KSampler: OOM".into())
        );
        assert_eq!(parse_ws_text("not json", "a"), WsEvent::Other);
    }

    #[test]
    fn two_sampling_passes_count_on_instead_of_starting_over() {
        // One pass: as ComfyUI sends it.
        assert_eq!(shown_progress(&[], 20, 0, Some("7"), 5, 20), (5, 20));
        // First pass 20 steps (node 7), upscale model tiles (node 11), second pass 12 steps (node 15).
        let passes = vec![("7".to_string(), 0), ("15".to_string(), 20)];
        assert_eq!(shown_progress(&passes, 32, 0, Some("7"), 20, 20), (20, 32));
        assert_eq!(shown_progress(&passes, 32, 20, Some("11"), 3, 16), (20, 32));
        assert_eq!(shown_progress(&passes, 32, 20, Some("15"), 4, 12), (24, 32));
        assert_eq!(
            shown_progress(&passes, 32, 24, Some("15"), 12, 12),
            (32, 32)
        );
    }

    #[test]
    fn previews_become_data_urls() {
        let mut frame = 1u32.to_be_bytes().to_vec();
        frame.extend(1u32.to_be_bytes());
        frame.extend([0xFF, 0xD8, 0xFF]);
        assert_eq!(
            parse_preview(&frame).unwrap(),
            "data:image/jpeg;base64,/9j/"
        );
        let meta = br#"{"image_type":"image/png","prompt_id":"a"}"#;
        let mut frame = 4u32.to_be_bytes().to_vec();
        frame.extend((meta.len() as u32).to_be_bytes());
        frame.extend(meta);
        frame.extend([1, 2, 3]);
        assert!(parse_preview(&frame)
            .unwrap()
            .starts_with("data:image/png;base64,"));
        assert_eq!(parse_preview(&[0, 0, 0, 2, 1]), None);
    }

    #[test]
    fn prompt_errors_name_the_failing_nodes() {
        let body = serde_json::json!({
            "error": { "message": "Prompt outputs failed validation" },
            "node_errors": { "1": { "class_type": "CheckpointLoaderSimple", "errors": [{ "message": "Value not in list", "details": "ckpt_name: 'x' not in []" }] } }
        });
        assert_eq!(
            prompt_error_text(&body),
            "Prompt outputs failed validation / CheckpointLoaderSimple: ckpt_name: 'x' not in []"
        );
    }

    #[test]
    fn text_outputs_are_read_and_files_win_over_text() {
        let entry = serde_json::json!({ "status": { "status_str": "success" }, "outputs": {
            "9": { "text": ["1girl, solo, smile"] },
            "7": { "images": [{ "filename": "a.png" }], "text": ["x"] }
        } });
        assert_eq!(
            output_text(&entry, "9").unwrap().as_deref(),
            Some("1girl, solo, smile")
        );
        assert_eq!(output_text(&entry, "7").unwrap(), None);
        assert_eq!(output_text(&entry, "8").unwrap(), None);
        let failed = serde_json::json!({ "status": { "status_str": "error", "messages": [["execution_error", { "node_type": "Florence2Run", "exception_message": "no model" }]] } });
        assert_eq!(
            output_text(&failed, "9").unwrap_err(),
            EngineError::Failed("ComfyUI Florence2Run: no model".into())
        );
    }

    #[test]
    fn a_result_file_is_told_by_its_extension() {
        let kind = |n: &str| result_kind(n).unwrap();
        assert_eq!(kind("ComfyUI_00001_.png"), ResultKind::Image);
        assert_eq!(kind("noext"), ResultKind::Image);
        assert_eq!(kind("video/novira_00001_.mp4"), ResultKind::Video);
        assert_eq!(kind("a.FLAC"), ResultKind::Audio("flac"));
        assert_eq!(kind("a.mp3"), ResultKind::Audio("mp3"));
        assert_eq!(kind("a.wav"), ResultKind::Audio("wav"));
        for refused in ["a.opus", "a.ogg", "a.m4a", "a.webm", "a.MKV", "a.mov"] {
            assert!(result_kind(refused).is_err(), "{refused}");
        }
    }

    #[test]
    fn ws_url_follows_the_base_url() {
        let e = ComfyEngine::new("http://127.0.0.1:8188", None, Duration::from_secs(1)).unwrap();
        assert!(e.ws_url().starts_with("ws://127.0.0.1:8188/ws?clientId="));
        assert!(ComfyEngine::new("file:///x", None, Duration::from_secs(1)).is_err());
    }
}
