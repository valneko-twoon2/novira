//! The backend service behind the frontend's `BackendClient`: boards, images, the generation queue,
//! models and workflows. State lives in memory and is written through to SQLite; image files live on disk.
//! Locks are never held across an `await`.
//!
//! This file holds the shared state and start-up; each area of the service is a module of its own
//! (`boards`, `gallery`, `guidance`, `queue`, `worker`, `model_store`, `keys`, `assistant`, `browse`, `pack_store`,
//! `workflows`, `memory`).
use crate::agent;
use crate::comfy::process::{ComfyProcess, OwnedProcessConfig};
use crate::comfy::ComfyEngine;
use crate::db::{Db, Table};
use crate::engine::{Engine, EngineError, EngineJob, EngineOutput, EngineProgress, GraphJob};
use crate::gpu_lock;
use crate::media::images::{self, ImageFiles};
use crate::models::civitai;
use crate::models::huggingface;
use crate::models::install::{self, InstallError, Source};
use crate::models::layout::{self, FoundModel};
use crate::models::{classify, registry, starter};
use crate::packs::{self, PackKind, PackStatus};
use crate::secret::{self, Secret};
use crate::settings::Settings;
use crate::sync::{LockExt, RwLockExt};
use crate::types::*;
use crate::unfinished::{self, UnfinishedDownload};
use crate::voice::{self, QwenVoice, VoiceEngine};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant};
use tokio::sync::Notify;
use tokio_util::sync::CancellationToken;

mod assistant;
mod backups;
mod boards;
mod browse;
pub mod canvas;
pub mod comics;
mod engine_settings;
mod gallery;
pub mod guidance;
mod keys;
mod memory;
mod model_store;
mod node_pack_store;
mod open_timing;
mod pack_store;
mod queue;
mod share;
pub mod ui_state;
mod worker;
mod workflows;

pub use open_timing::OpenTimings;
use open_timing::Stopwatch;

/// The largest seed, inclusive: seeds run from 0 to `MAX_SEED` (the full u32 range).
pub const MAX_SEED: u64 = 4_294_967_295;
/// How many seeds there are; seed arithmetic wraps modulo this.
const SEED_SPAN: u64 = MAX_SEED + 1;
const HIDDEN_MODELS_META: &str = "hidden_models";
/// Set once the stored LoRA bases were checked against the current detection (`registry::corrected_lora_bases`); bump
/// the number when the detection of a LoRA's family is fixed again.
const LORA_BASES_CHECKED_META: &str = "lora_bases_checked_1";
/// Set once the records stored without a family were checked against the current detection (`registry::corrected_any_bases`);
/// bump the number when the detection learns a family it did not tell before.
const ANY_BASES_CHECKED_META: &str = "any_bases_checked_2";
const EXTRA_MODEL_PATHS: &str = "extra_model_paths.yaml";
const INTERRUPTED: &str = "Interrupted because novira was closed";

pub type EventSink = Arc<dyn Fn(BackendEvent) + Send + Sync>;

pub struct BackendConfig {
    pub data_dir: PathBuf,
    /// Base of image URLs served by the shell, e.g. `http://novira-image.localhost`.
    pub image_url_base: String,
    pub settings: Settings,
}

#[derive(Debug, thiserror::Error)]
pub enum BackendError {
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Invalid(String),
    #[error("{0}")]
    Internal(String),
}

impl From<rusqlite::Error> for BackendError {
    fn from(e: rusqlite::Error) -> Self {
        BackendError::Internal(format!("database error: {e}"))
    }
}

pub type Result<T> = std::result::Result<T, BackendError>;

#[derive(Default)]
struct State {
    boards: Vec<BoardDTO>,
    /// Newest first.
    images: Vec<ImageDTO>,
    workflows: Vec<SavedWorkflow>,
    models: Vec<ModelConfig>,
    hidden_models: HashSet<String>,
    queue: Vec<QueueItem>,
    next_item_id: u64,
    paused: bool,
    running: Option<(u64, CancellationToken)>,
}

struct AgentRun {
    id: u64,
    cancel: CancellationToken,
    relay: Arc<agent::Relay>,
}

struct Install {
    job: ModelInstallJob,
    cancel: CancellationToken,
}

struct Inner {
    data_dir: PathBuf,
    /// The Civitai API key: the encrypted saved one, else the plain `civitaiApiKey` of the settings.
    civitai_key: RwLock<Option<String>>,
    hf_token: RwLock<Option<String>>,
    models_dir: PathBuf,
    roots: Vec<PathBuf>,
    image_url_base: String,
    gpu_lock: Option<PathBuf>,
    db: Mutex<Db>,
    state: Mutex<State>,
    files: ImageFiles,
    engine: Arc<dyn Engine>,
    voice: Arc<dyn VoiceEngine>,
    /// The Python for the voice libraries: an explicit setting, else the folder of ComfyUI's own.
    voice_python: (Option<PathBuf>, Option<PathBuf>),
    events: RwLock<Option<EventSink>>,
    /// The file that records where the data folder is, set by the shell when the data folder may be changed from the app.
    location_pointer: RwLock<Option<PathBuf>>,
    wake: Notify,
    http: reqwest::Client,
    /// For the model searches only: it asks for compressed answers (a page of results is over a megabyte of JSON). The client above
    /// does not, because a download's size must be the size of its file.
    search_http: reqwest::Client,
    installs: Mutex<Vec<Install>>,
    /// State of each model pack's download, and the token that stops a running one.
    packs: Mutex<HashMap<PackKind, PackStatus>>,
    pack_cancel: Mutex<HashMap<PackKind, CancellationToken>>,
    /// Custom node pack installs running, by GitHub address.
    node_pack_jobs: Mutex<HashMap<String, CancellationToken>>,
    /// The assistant's request that is running: its number, the token that stops it (the tool's process is killed when
    /// the request is dropped) and the relay that waits for the answers to its tool calls.
    agent_run: Mutex<Option<AgentRun>>,
    /// The ComfyUI Registry list as last read, and when (kept for an hour).
    registry_cache: Mutex<Option<(Instant, Arc<Vec<crate::comfy::registry::RegistryNode>>)>>,
    /// A read of the registry is running in the background (to freshen a list that was shown as it was).
    registry_refreshing: std::sync::atomic::AtomicBool,
    /// Packs changed since ComfyUI started: it must restart to load them.
    restart_needed: std::sync::atomic::AtomicBool,
    /// The `lowMemoryMode` setting as last saved.
    low_memory: std::sync::atomic::AtomicBool,
    /// The engine starts its own server, so low-memory mode takes effect.
    low_memory_owned: bool,
    /// The settings the app started with; a saved value that differs applies at the next start.
    started_settings: Settings,
    /// Held while the engine settings read, change and write `settings.json`, so two changes do not lose one.
    settings_write: Mutex<()>,
    /// The export watermark's files and model.
    watermark: crate::provenance::Tools,
    /// The key that signs content credentials, once loaded or made.
    signing: Mutex<Option<crate::provenance::credentials::Identity>>,
    shutdown: CancellationToken,
    /// How long each step of opening took.
    open_timings: OpenTimings,
}

#[derive(Clone)]
pub struct Backend {
    inner: Arc<Inner>,
}

fn now() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn new_id(prefix: &str) -> String {
    format!(
        "{prefix}-{}",
        &uuid::Uuid::new_v4().simple().to_string()[..12]
    )
}

fn random_seed() -> u64 {
    let b = uuid::Uuid::new_v4().into_bytes();
    u64::from_le_bytes(b[..8].try_into().expect("8 bytes")) % SEED_SPAN
}

/// The seed of the `i`-th item of a batch: `seed + i`, wrapping from `MAX_SEED` to 0.
/// Reducing first keeps the sum far from u64 overflow whatever seed the caller sent.
fn batch_seed(seed: u64, i: u32) -> u64 {
    (seed % SEED_SPAN + u64::from(i)) % SEED_SPAN
}

/// A free loopback port for the ComfyUI that novira starts.
fn free_port() -> std::io::Result<u16> {
    Ok(std::net::TcpListener::bind(("127.0.0.1", 0))?
        .local_addr()?
        .port())
}

fn internal(e: impl std::fmt::Display) -> BackendError {
    BackendError::Internal(e.to_string())
}

impl Backend {
    /// Opens the data folder and connects to ComfyUI as configured in the settings.
    pub fn open(config: BackendConfig) -> Result<Self> {
        let mut watch = Stopwatch::start();
        let yaml_path = config.data_dir.join(EXTRA_MODEL_PATHS);
        let install_root = config.settings.install_root(&config.data_dir);
        let st = &config.settings;
        // Without `comfyuiUrl` novira uses its own ComfyUI on a free loopback port; with it, an existing server.
        let managed = st.comfyui_url.is_none();
        let url = match &st.comfyui_url {
            Some(u) => u.clone(),
            None => format!("http://127.0.0.1:{}", free_port().map_err(internal)?),
        };
        let base = reqwest::Url::parse(&url)
            .map_err(|e| BackendError::Invalid(format!("comfyuiUrl: {e}")))?;
        // With a folder too, novira starts that ComfyUI listening on this address when nothing answers there: it must
        // be on this PC, or the engine would be opened to the network.
        if !managed
            && st.comfyui_dir.is_some()
            && !crate::comfy::process::is_this_pc(base.host_str().unwrap_or(""))
        {
            return Err(BackendError::Invalid(
                "comfyuiUrl: with comfyuiDir set, novira starts ComfyUI at this address, so it must be on this PC (127.0.0.1, localhost or [::1])".into(),
            ));
        }
        let dir = match (&st.comfyui_dir, managed) {
            (Some(d), _) => Some(d.clone()),
            (None, true) => Some(crate::comfy::install::comfyui_dir(&install_root)),
            (None, false) => None,
        };
        let voice_python = (st.comfyui_python.clone(), dir.clone());
        let process = dir.map(|dir| {
            ComfyProcess::new(OwnedProcessConfig {
                comfyui_dir: dir,
                python: st.comfyui_python.clone(),
                host: base.host_str().unwrap_or("127.0.0.1").to_string(),
                port: base.port_or_known_default().unwrap_or(8188),
                extra_model_paths: yaml_path.clone(),
                extra_args: st.comfyui_args.clone(),
                log_file: config.data_dir.join("logs").join("comfyui.log"),
            })
        });
        let mut engine = ComfyEngine::new(
            &url,
            process,
            Duration::from_secs(st.comfyui_start_timeout_secs),
        )
        .map_err(BackendError::Invalid)?;
        if managed && st.comfyui_dir.is_none() {
            crate::comfy::install::recover_switch(&install_root);
            engine = engine.with_installer(install_root, st.comfyui_package.clone());
        }
        let voice = Arc::new(
            QwenVoice::new(
                config.data_dir.clone(),
                config.data_dir.join("models"),
                voice_python.0.clone(),
                voice_python.1.clone(),
            )
            .with_read_roots(config.settings.model_roots.clone()),
        );
        watch.lap("engines");
        Self::open_timed(config, Arc::new(engine), voice, voice_python, watch)
    }

    /// Opens the data folder with a given engine (tests use a fake); speech is not available.
    pub fn open_with_engine(config: BackendConfig, engine: Arc<dyn Engine>) -> Result<Self> {
        let voice = Arc::new(QwenVoice::new(
            config.data_dir.clone(),
            config.data_dir.join("models"),
            None,
            None,
        ));
        Self::open_with_engines(config, engine, voice, (None, None))
    }

    /// Opens the data folder with given image and voice engines (tests use fakes). `voice_python` is the Python the
    /// voice engine's libraries are installed for: an explicit one, else the one inside the ComfyUI folder.
    pub fn open_with_engines(
        config: BackendConfig,
        engine: Arc<dyn Engine>,
        voice: Arc<dyn VoiceEngine>,
        voice_python: (Option<PathBuf>, Option<PathBuf>),
    ) -> Result<Self> {
        Self::open_timed(config, engine, voice, voice_python, Stopwatch::start())
    }

    fn open_timed(
        config: BackendConfig,
        engine: Arc<dyn Engine>,
        voice: Arc<dyn VoiceEngine>,
        voice_python: (Option<PathBuf>, Option<PathBuf>),
        mut watch: Stopwatch,
    ) -> Result<Self> {
        std::fs::create_dir_all(&config.data_dir).map_err(internal)?;
        // A restore the user confirmed is applied before anything opens the database or the gallery folders.
        crate::backup::restore::apply_pending(&config.data_dir);
        watch.lap("restore");
        let models_dir = config.data_dir.join("models");
        let roots = model_roots(&models_dir, &config.settings);
        prepare_model_dirs(
            &models_dir,
            &roots,
            &config.data_dir.join(EXTRA_MODEL_PATHS),
        )?;
        watch.lap("model folders");
        let mut db = Db::open(&config.data_dir)?;
        let files = ImageFiles::new(&config.data_dir).map_err(internal)?;
        let base = config.image_url_base.trim_end_matches('/').to_string();
        watch.lap("database");

        let mut state = State {
            boards: db.load(Table::Boards)?,
            workflows: db.load(Table::Workflows)?,
            queue: db.load(Table::Queue)?,
            hidden_models: db
                .meta(HIDDEN_MODELS_META)?
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default(),
            ..State::default()
        };
        watch.lap("boards, workflows, queue");
        let mut images: Vec<ImageDTO> = db.load(Table::Images)?;
        watch.lap("images");
        images.reverse();
        for img in &mut images {
            img.url = format!("{base}/full/{}", img.name);
            img.thumbnail_url = format!("{base}/thumb/{}", img.name);
        }
        state.images = images;
        watch.lap("image urls");
        // Every original goes in the folder of its board (pictures an older version stored flat, a board renamed).
        files.index();
        crate::media::arrangement::arrange(&files, &state.boards, &state.images);
        watch.lap("gallery folders");

        // Models: the files on disk decide what is listed; stored records keep the user's edits.
        let stored: Vec<ModelConfig> = db.load(Table::Models)?;
        watch.lap("stored models");
        // Files an older version saved under the wrong kind (an IP-Adapter among the checkpoints) go where they belong.
        layout::move_misfiled(&models_dir);
        watch.lap("misfiled models");
        let found = layout::scan_roots(&roots);
        watch.lap("model scan");
        let mut merged = registry::merge(&found, &stored, &state.hidden_models);
        watch.lap("model merge");
        if db.meta(LORA_BASES_CHECKED_META)?.is_none() {
            for fixed in registry::corrected_lora_bases(&merged.listed) {
                if let Some(m) = merged.listed.iter_mut().find(|m| m.key == fixed.key) {
                    *m = fixed.clone();
                }
                merged.changed.retain(|m| m.key != fixed.key);
                merged.changed.push(fixed);
            }
            db.set_meta(LORA_BASES_CHECKED_META, "1")?;
        }
        if db.meta(ANY_BASES_CHECKED_META)?.is_none() {
            for fixed in registry::corrected_any_bases(&merged.listed) {
                if let Some(m) = merged.listed.iter_mut().find(|m| m.key == fixed.key) {
                    *m = fixed.clone();
                }
                merged.changed.retain(|m| m.key != fixed.key);
                merged.changed.push(fixed);
            }
            db.set_meta(ANY_BASES_CHECKED_META, "1")?;
        }
        for fixed in registry::corrected_license_summaries(&merged.listed) {
            if let Some(m) = merged.listed.iter_mut().find(|m| m.key == fixed.key) {
                *m = fixed.clone();
            }
            merged.changed.retain(|m| m.key != fixed.key);
            merged.changed.push(fixed);
        }
        watch.lap("model corrections");
        db.put_many(
            Table::Models,
            merged.changed.iter().map(|m| (m.key.as_str(), 0i64, m)),
        )?;
        state.models = merged.listed;
        watch.lap("model writes");

        // A job that was running when the app closed did not finish; leftover pending jobs wait for an explicit resume.
        state.next_item_id = state.queue.iter().map(|q| q.id).max().unwrap_or(0) + 1;
        let t = now();
        for item in &mut state.queue {
            if item.status == QueueItemStatus::InProgress {
                item.status = QueueItemStatus::Failed;
                item.error = Some(INTERRUPTED.into());
                item.completed_at = Some(t);
            }
        }
        for q in state
            .queue
            .iter()
            .filter(|q| q.error.as_deref() == Some(INTERRUPTED) && q.completed_at == Some(t))
        {
            db.put(Table::Queue, &q.id.to_string(), q.id as i64, q)?;
        }
        state.paused = state
            .queue
            .iter()
            .any(|q| q.status == QueueItemStatus::Pending);
        watch.lap("queue fix-up");

        let gpu_lock = config.settings.gpu_lock_path();
        let http = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .user_agent("novira")
            .no_gzip()
            .no_brotli()
            .build()
            .map_err(internal)?;
        let search_http = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .user_agent("novira")
            .build()
            .map_err(internal)?;
        watch.lap("http clients");
        let civitai_key = match secret::load_civitai_key(&config.data_dir) {
            Ok(saved) => saved.or_else(|| config.settings.civitai_api_key.clone()),
            Err(e) => {
                crate::applog::warn("backend", e.to_string());
                config.settings.civitai_api_key.clone()
            }
        };
        let roots_for_pack = roots.clone();
        let data_dir_for_pack = config.data_dir.clone();
        let hf_token =
            secret::load_secret(&config.data_dir, Secret::HuggingFace).unwrap_or_else(|e| {
                crate::applog::warn("backend", e.to_string());
                None
            });
        let low_memory_owned = engine.set_low_memory(config.settings.low_memory_mode);
        watch.lap("secrets");
        let packs = PackKind::ALL
            .into_iter()
            .map(|k| {
                (
                    k,
                    pack_store::initial_status(&roots_for_pack, k, &data_dir_for_pack),
                )
            })
            .collect();
        watch.lap("packs");
        let watermark = crate::provenance::Tools::new(bundled_watermark_dir(), &config.data_dir);
        watch.lap("watermark");
        let open_timings = watch.finish();
        crate::applog::info("backend", open_timings.summary());
        let inner = Arc::new(Inner {
            data_dir: config.data_dir.clone(),
            civitai_key: RwLock::new(civitai_key),
            hf_token: RwLock::new(hf_token),
            models_dir,
            roots,
            image_url_base: base,
            gpu_lock,
            db: Mutex::new(db),
            state: Mutex::new(state),
            files,
            engine,
            voice,
            voice_python,
            events: RwLock::new(None),
            location_pointer: RwLock::new(None),
            wake: Notify::new(),
            http,
            search_http,
            installs: Mutex::new(Vec::new()),
            packs: Mutex::new(packs),
            pack_cancel: Mutex::new(HashMap::new()),
            node_pack_jobs: Mutex::new(HashMap::new()),
            agent_run: Mutex::new(None),
            registry_cache: Mutex::new(None),
            registry_refreshing: std::sync::atomic::AtomicBool::new(false),
            restart_needed: std::sync::atomic::AtomicBool::new(false),
            low_memory: std::sync::atomic::AtomicBool::new(config.settings.low_memory_mode),
            low_memory_owned,
            started_settings: config.settings.clone(),
            settings_write: Mutex::new(()),
            watermark,
            signing: Mutex::new(None),
            shutdown: CancellationToken::new(),
            open_timings,
        });
        // Engine status changes (download, unpack, start) reach the frontend as events.
        let weak = Arc::downgrade(&inner);
        inner.engine.set_status_sink(Arc::new(move |status| {
            if let Some(inner) = weak.upgrade() {
                Backend { inner }.emit(BackendEvent::EngineStatus { status });
            }
        }));
        Ok(Self { inner })
    }

    /// Installs and starts the engine in the background of app start, so the first job does not wait for it.
    pub async fn prepare_engine(&self) {
        if let Err(e) = self.inner.engine.prepare(&self.inner.shutdown).await {
            crate::applog::warn("engine", format!("engine not ready: {e}"));
        }
    }

    /// Every node the engine can run, as ComfyUI describes them (`object_info`); starts the engine when needed.
    pub async fn node_defs(&self) -> Result<Value> {
        self.inner
            .engine
            .node_defs(&self.inner.shutdown)
            .await
            .map_err(|e| BackendError::Internal(e.to_string()))
    }

    /// The words ComfyUI's own screens show in the app's language `locale` (`ja`, `zh-CN`, …), or None when it has none.
    pub async fn comfy_ui_locale(
        &self,
        locale: &str,
    ) -> Result<Option<crate::comfy::ui_locale::ComfyUiLocale>> {
        self.inner
            .engine
            .ui_locale(&self.inner.shutdown, locale)
            .await
            .map_err(|e| BackendError::Internal(e.to_string()))
    }

    /// How long each step of opening this backend took.
    pub fn open_timings(&self) -> &OpenTimings {
        &self.inner.open_timings
    }

    pub fn engine_status(&self) -> crate::engine::EngineStatus {
        self.inner.engine.status()
    }

    pub fn set_event_sink(&self, sink: EventSink) {
        crate::applog::set_sink(sink.clone());
        *self.inner.events.write_safe() = Some(sink);
    }

    fn emit(&self, event: BackendEvent) {
        if let Some(sink) = self.inner.events.read_safe().as_ref() {
            sink(event);
        }
    }

    fn state(&self) -> std::sync::MutexGuard<'_, State> {
        self.inner.state.lock_safe()
    }

    fn db(&self) -> std::sync::MutexGuard<'_, Db> {
        self.inner.db.lock_safe()
    }

    fn image_dto(&self, mut img: ImageDTO) -> ImageDTO {
        img.url = format!("{}/full/{}", self.inner.image_url_base, img.name);
        img.thumbnail_url = format!("{}/thumb/{}", self.inner.image_url_base, img.name);
        img
    }

    // Startup -----------------------------------------------------------------

    pub fn bootstrap(&self) -> Bootstrap {
        let s = self.state();
        Bootstrap {
            models: s.models.clone(),
            boards: s.boards.clone(),
            images: s.images.clone(),
            workflows: s.workflows.clone(),
            queue: QueueSnapshot {
                items: s.queue.clone(),
                status: queue_status(&s),
            },
            engine: self.inner.engine.status(),
            packs: self.packs(),
        }
    }

    /// The downloads that were interrupted and left a partial file in the data folder (Settings → Data).
    pub fn list_unfinished_downloads(&self) -> Vec<UnfinishedDownload> {
        unfinished::list(&self.inner.data_dir)
    }

    /// Deletes the picked unfinished downloads and returns the ones left (a download running now is kept).
    pub fn delete_unfinished_downloads(&self, paths: &[String]) -> Result<Vec<UnfinishedDownload>> {
        unfinished::check_picked(paths).map_err(BackendError::Invalid)?;
        Ok(unfinished::delete(&self.inner.data_dir, paths))
    }
}

fn queue_status(s: &State) -> QueueStatus {
    let count = |st: QueueItemStatus| s.queue.iter().filter(|q| q.status == st).count() as u32;
    QueueStatus {
        pending: count(QueueItemStatus::Pending),
        in_progress: count(QueueItemStatus::InProgress),
        completed: count(QueueItemStatus::Completed),
        failed: count(QueueItemStatus::Failed),
        canceled: count(QueueItemStatus::Canceled),
        total: s.queue.len() as u32,
        is_paused: s.paused,
    }
}

/// The folder next to the app where a packaged build puts the watermark's files (`<exe folder>/resources/trustmark`).
fn bundled_watermark_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    Some(
        exe.parent()?
            .join("resources")
            .join(crate::provenance::files::DIR),
    )
}

/// novira's own models folder first (installs land there), then the configured roots.
fn model_roots(models_dir: &Path, settings: &Settings) -> Vec<PathBuf> {
    let mut roots = vec![models_dir.to_path_buf()];
    for r in &settings.model_roots {
        if !roots.contains(r) {
            roots.push(r.clone());
        }
    }
    roots
}

/// Creates the category folders novira installs into and writes the matching ComfyUI model-path file.
fn prepare_model_dirs(models_dir: &Path, roots: &[PathBuf], yaml_path: &Path) -> Result<()> {
    for cat in layout::CATEGORIES {
        std::fs::create_dir_all(models_dir.join(cat.folder)).map_err(internal)?;
    }
    packs::prepare_dirs(models_dir).map_err(internal)?;
    if let Some(parent) = yaml_path.parent() {
        std::fs::create_dir_all(parent).map_err(internal)?;
    }
    let yaml = format!(
        "{}{}",
        layout::extra_model_paths_yaml(roots),
        packs::extra_paths_yaml_in(roots)
    );
    std::fs::write(yaml_path, yaml).map_err(internal)
}

#[cfg(test)]
mod seed_tests {
    use super::*;

    #[test]
    fn batch_seeds_keep_max_seed_and_wrap_after_it() {
        assert_eq!(batch_seed(MAX_SEED, 0), MAX_SEED);
        assert_eq!(batch_seed(MAX_SEED - 1, 1), MAX_SEED);
        assert_eq!(batch_seed(MAX_SEED, 1), 0);
        assert_eq!(batch_seed(7, 3), 10);
    }

    #[test]
    fn batch_seeds_do_not_overflow_for_out_of_range_seeds() {
        assert_eq!(
            batch_seed(u64::MAX, u32::MAX),
            (MAX_SEED + u64::from(u32::MAX)) % SEED_SPAN
        );
    }

    #[test]
    fn random_seeds_stay_in_range() {
        assert!((0..200).map(|_| random_seed()).all(|s| s <= MAX_SEED));
    }
}
