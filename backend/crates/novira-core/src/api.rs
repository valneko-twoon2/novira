//! The one command layer of every shell: a command name and its JSON arguments in, JSON out.
//!
//! The desktop shell (`backend/src-tauri`) and the browser server (`backend/crates/novira-server`) both call the backend
//! through the functions in [`call`]. Each command is written once, in the `commands!` list below, and the macro makes
//! two things from it: the typed function (`call::create_board(&backend, name)`), which the Tauri commands call, and the
//! entry of [`dispatch`], which reads named JSON arguments and calls that same function. So the checks on an argument
//! (what the command rejects before it reaches the backend) exist once, whichever shell the request came through.
//!
//! The layer does not know a window, a socket or a dialog. Commands that need one (folder and file dialogs, the raw
//! bytes of an upload, state the shell keeps between calls) are not here: they are listed in [`SHELL_ONLY`].
use crate::agent::{
    AgentEndpointInput, AgentEndpointTest, AgentProvider, AgentReply, AgentRequest, AgentStatus,
    AgentToolAnswer,
};
use crate::backup::RestoreOutcome;
use crate::models::civitai::{SearchParams, SearchResult};
use crate::packs::{PackKind, PackStatus};
use crate::types::*;
use crate::unfinished::UnfinishedDownload;
use crate::{Backend, BackendError};
use serde_json::{Map, Value};

/// A command's result: the value, or the message the window shows.
pub type Res<T> = Result<T, String>;

/// Why a command could not run, by name and JSON arguments.
#[derive(Debug, PartialEq)]
pub enum CallError {
    /// No command of that name in this layer.
    UnknownCommand,
    /// The arguments are not an object of the command's parameters, or one of them has the wrong shape.
    BadArguments(String),
    /// The command ran and refused or failed; the message is the one the window shows.
    Failed(String),
}

impl std::fmt::Display for CallError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CallError::UnknownCommand => f.write_str("unknown command"),
            CallError::BadArguments(m) | CallError::Failed(m) => f.write_str(m),
        }
    }
}

/// Runs a command's body, turning a panic into an error for the caller. Synchronous commands run on the window's
/// main thread in the desktop app, where an unwinding panic would end the whole app; the panic itself is logged by the
/// shell's hook.
pub fn guard<T>(body: impl FnOnce() -> Res<T>) -> Res<T> {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(body)).unwrap_or_else(|panic| {
        let what = panic
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| panic.downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "unknown error".into());
        Err(format!("Internal error: {what}"))
    })
}

fn msg(e: BackendError) -> String {
    e.to_string()
}

/// `snake_case` to `camelCase`, the spelling of an argument name on the wire (Tauri renames the same way).
pub fn camel(snake: &str) -> String {
    let mut out = String::with_capacity(snake.len());
    let mut up = false;
    for c in snake.chars() {
        if c == '_' {
            up = true;
        } else if up {
            out.extend(c.to_uppercase());
            up = false;
        } else {
            out.push(c);
        }
    }
    out
}

fn take<T: serde::de::DeserializeOwned>(
    args: &mut Map<String, Value>,
    snake: &str,
) -> Result<T, CallError> {
    let key = camel(snake);
    let value = args.remove(&key).unwrap_or(Value::Null);
    serde_json::from_value(value).map_err(|e| CallError::BadArguments(format!("{key}: {e}")))
}

/// The JSON text of a command's result. Written straight to text: going through a `Value` first made a large answer
/// three times slower (the bootstrap of a gallery of 2400 pictures: 26 ms against 9).
fn finish<T: serde::Serialize>(result: Res<T>) -> Result<String, CallError> {
    let value = result.map_err(CallError::Failed)?;
    serde_json::to_string(&value).map_err(|e| CallError::Failed(e.to_string()))
}

fn arguments(args: Value) -> Result<Map<String, Value>, CallError> {
    match args {
        Value::Object(map) => Ok(map),
        Value::Null => Ok(Map::new()),
        _ => Err(CallError::BadArguments(
            "the arguments must be an object".into(),
        )),
    }
}

fn no_extra(args: &Map<String, Value>) -> Result<(), CallError> {
    match args.keys().next() {
        Some(key) => Err(CallError::BadArguments(format!(
            "unexpected argument: {key}"
        ))),
        None => Ok(()),
    }
}

/// Commands the desktop shell implements itself because they need its window, a dialog, a raw request body or state it
/// keeps between calls. The browser server answers them with "not available in the browser yet".
pub const SHELL_ONLY: &[&str] = &[
    "upload_image",
    "install_model",
    "scan_folder",
    "add_model_root",
    "choose_data_dir",
    "cancel_data_dir_change",
    "choose_comfyui_install_dir",
    "reset_comfyui_install_dir",
    "open_civitai_page",
    "open_huggingface_page",
    "open_source_page",
    "set_ui_zoom",
    "export_images",
    "reveal_export_folder",
    "prepare_watermark",
    "check_watermark_file",
    "create_backup",
    "open_backup",
    "confirm_restore",
];

macro_rules! commands {
    ($($kind:ident $name:ident($b:ident $(, $arg:ident : $ty:ty)*) -> $ret:ty $body:block)*) => {
        /// The typed form of every command, called directly by the desktop shell.
        pub mod call {
            use super::*;
            $(commands!(@function $kind $name($b $(, $arg: $ty)*) -> $ret $body);)*
        }

        /// Every command of this layer, in the order of the list.
        pub const NAMES: &[&str] = &[$(stringify!($name)),*];

        /// Every command with the names of its parameters (snake case), for tests that compare them with a client.
        pub const PARAMETERS: &[(&str, &[&str])] = &[$((stringify!($name), &[$(stringify!($arg)),*])),*];

        /// Runs the command `name` with named JSON arguments (camelCase, as the frontend sends them) and gives the JSON
        /// text of its result.
        pub async fn dispatch(backend: &Backend, name: &str, args: Value) -> Result<String, CallError> {
            $(
                if name == stringify!($name) {
                    return commands!(@arm $kind $name backend, args, $($arg: $ty),*);
                }
            )*
            Err(CallError::UnknownCommand)
        }
    };
    (@function sync $name:ident($b:ident $(, $arg:ident : $ty:ty)*) -> $ret:ty $body:block) => {
        #[allow(unused_variables)]
        pub fn $name($b: &Backend $(, $arg: $ty)*) -> Res<$ret> $body
    };
    (@function async $name:ident($b:ident $(, $arg:ident : $ty:ty)*) -> $ret:ty $body:block) => {
        #[allow(unused_variables)]
        pub async fn $name($b: &Backend $(, $arg: $ty)*) -> Res<$ret> $body
    };
    // A synchronous command may block on the database or a file, so it runs on the blocking pool, guarded.
    (@arm sync $name:ident $backend:ident, $args:ident, $($arg:ident : $ty:ty),*) => {{
        #[allow(unused_mut)]
        let mut map = arguments($args)?;
        $(let $arg: $ty = take(&mut map, stringify!($arg))?;)*
        no_extra(&map)?;
        let backend = $backend.clone();
        let result = tokio::task::spawn_blocking(move || guard(|| call::$name(&backend $(, $arg)*)))
            .await
            .map_err(|e| CallError::Failed(format!("Internal error: {e}")))?;
        finish(result)
    }};
    (@arm async $name:ident $backend:ident, $args:ident, $($arg:ident : $ty:ty),*) => {{
        #[allow(unused_mut)]
        let mut map = arguments($args)?;
        $(let $arg: $ty = take(&mut map, stringify!($arg))?;)*
        no_extra(&map)?;
        finish(call::$name($backend $(, $arg)*).await)
    }};
}

/// `install_model` for a shell that has no folder dialog: a Civitai or Hugging Face reference or a checked address is
/// judged by the backend's own parsing, a local file path is refused (the desktop app accepts one only when its last
/// "Scan Folder" listed it, and a shell without that dialog has no such list).
pub async fn install_model_remote(backend: &Backend, args: Value) -> Result<String, CallError> {
    let mut map = arguments(args)?;
    let source: String = take(&mut map, "source")?;
    let name: Option<String> = take(&mut map, "name")?;
    no_extra(&map)?;
    if matches!(
        crate::models::install::parse_source(&source),
        Ok(crate::models::install::Source::Local(_))
    ) {
        return finish::<ModelInstallJob>(Err(
            "A local model file is installed from Scan Folder, which is not available in the browser"
                .into(),
        ));
    }
    let backend = backend.clone();
    let result = tokio::task::spawn_blocking(move || {
        guard(|| backend.install_model(&source, name).map_err(msg))
    })
    .await
    .map_err(|e| CallError::Failed(format!("Internal error: {e}")))?;
    finish(result)
}

/// Commands that open a web page outside the app. The address is built and checked here for both shells: the desktop
/// shell hands it to the default browser, the browser server answers it to the page, which opens it in a new tab. So
/// which sites can be opened is decided once, whichever shell asked.
pub const PAGE_COMMANDS: &[&str] = &[
    "open_civitai_page",
    "open_huggingface_page",
    "open_source_page",
];

/// A model's Civitai page. Only the model id is accepted, never a URL.
pub fn civitai_page_url(model_id: &str) -> Res<String> {
    if model_id.is_empty() || model_id.len() > 12 || !model_id.bytes().all(|b| b.is_ascii_digit()) {
        return Err("invalid model id".into());
    }
    Ok(format!("https://civitai.com/models/{model_id}"))
}

/// A Hugging Face model page. Only `owner/repo` is accepted, never a URL.
pub fn huggingface_page_url(repo: &str) -> Res<String> {
    if !crate::models::install::is_hugging_face_repo(repo) {
        return Err("invalid repository".into());
    }
    Ok(format!("https://huggingface.co/{repo}"))
}

/// The page a model came from. Only https addresses on the model sites are accepted.
pub fn source_page_url(url: &str) -> Res<String> {
    if !crate::models::install::is_source_page(url) {
        return Err("this address cannot be opened".into());
    }
    Ok(url.to_string())
}

/// The process that hands a checked address to the default browser, without a shell. Not `explorer.exe <url>`: with a
/// query in the address (`?token=`, `?modelVersionId=`) it opens the Documents folder instead of the browser.
pub fn browser_command(url: &str) -> std::process::Command {
    let mut command;
    if cfg!(windows) {
        command = std::process::Command::new("rundll32.exe");
        command.arg("url.dll,FileProtocolHandler");
    } else {
        command = std::process::Command::new("xdg-open");
    }
    command.arg(url);
    command
}

/// The checked address of a [`PAGE_COMMANDS`] command, by name and JSON arguments, as JSON text (a string).
pub fn page_url(name: &str, args: Value) -> Result<String, CallError> {
    let mut map = arguments(args)?;
    let url = match name {
        "open_civitai_page" => civitai_page_url(&take::<String>(&mut map, "model_id")?),
        "open_huggingface_page" => huggingface_page_url(&take::<String>(&mut map, "repo")?),
        "open_source_page" => source_page_url(&take::<String>(&mut map, "url")?),
        _ => return Err(CallError::UnknownCommand),
    };
    no_extra(&map)?;
    finish(url)
}

commands! {
    sync bootstrap(b) -> Bootstrap {
        Ok(b.bootstrap())
    }
    sync create_board(b, name: String) -> BoardDTO {
        b.create_board(&name).map_err(msg)
    }
    sync update_board(b, id: String, patch: BoardPatch) -> BoardDTO {
        b.update_board(&id, patch).map_err(msg)
    }
    sync delete_board(b, id: String, delete_images: bool) -> Vec<String> {
        b.delete_board(&id, delete_images).map_err(msg)
    }
    sync update_images(b, names: Vec<String>, patch: ImagePatch) -> Vec<ImageDTO> {
        b.update_images(&names, patch).map_err(msg)
    }
    sync delete_images(b, names: Vec<String>) -> () {
        b.delete_images(&names).map_err(msg)
    }
    sync enqueue(b, request: EnqueueRequest) -> Vec<QueueItem> {
        b.enqueue(request).map_err(msg)
    }
    sync cancel_queue_item(b, id: u64) -> () {
        b.cancel_queue_item(id);
        Ok(())
    }
    sync cancel_batch(b, batch_id: String) -> () {
        b.cancel_batch(&batch_id);
        Ok(())
    }
    sync clear_queue(b) -> () {
        b.clear_queue().map_err(msg)
    }
    sync prune_queue(b) -> () {
        b.prune_queue().map_err(msg)
    }
    sync pause_processor(b) -> () {
        b.pause_processor();
        Ok(())
    }
    sync resume_processor(b) -> () {
        b.resume_processor();
        Ok(())
    }
    sync retry_queue_item(b, id: u64, size: Option<RetrySize>) -> Option<QueueItem> {
        b.retry_queue_item(id, size).map_err(msg)
    }
    sync queue_snapshot(b) -> QueueSnapshot {
        Ok(b.queue_snapshot())
    }
    sync list_starter_models(b) -> Vec<StarterModel> {
        Ok(b.list_starter_models())
    }
    sync model_parts(b, model_key: String) -> ModelPartsReport {
        b.model_parts(&model_key).map_err(msg)
    }
    sync cancel_install(b, job_id: String) -> () {
        b.cancel_install(&job_id);
        Ok(())
    }
    sync update_model(b, key: String, patch: Value) -> ModelConfig {
        b.update_model(&key, patch).map_err(msg)
    }
    sync delete_model(b, key: String) -> () {
        b.delete_model(&key).map_err(msg)
    }
    async list_hugging_face_files(b, repo: String) -> Vec<String> {
        b.hugging_face_files(&repo).await.map_err(msg)
    }
    async search_civitai(b, params: SearchParams) -> SearchResult {
        b.search_civitai(params).await.map_err(msg)
    }
    sync node_packs(b) -> NodePacks {
        Ok(b.node_packs())
    }
    async install_node_pack(b, url: String, version: Option<String>) -> () {
        b.install_node_pack(&url, version.as_deref()).await.map_err(msg)
    }
    async comfy_versions(b) -> Vec<String> {
        b.comfy_versions().await.map_err(msg)
    }
    async switch_comfy_version(b, version: String) -> Vec<String> {
        b.switch_comfy_version(&version).await.map_err(msg)
    }
    async node_pack_versions(b, url: String) -> Vec<String> {
        b.node_pack_versions(&url).await.map_err(msg)
    }
    // Every pack of the ComfyUI Registry, most downloaded first (read once and kept for an hour; `refresh` reads it again).
    async registry_nodes(b, refresh: bool) -> Vec<crate::comfy::registry::RegistryNode> {
        b.registry_nodes(refresh).await.map_err(msg)
    }
    async node_pack_info(b, url: String) -> crate::comfy::node_packs::RepoInfo {
        b.node_pack_info(&url).await.map_err(msg)
    }
    sync cancel_node_pack(b, url: String) -> () {
        b.cancel_node_pack(&url);
        Ok(())
    }
    sync remove_node_pack(b, folder: String) -> NodePacks {
        b.remove_node_pack(&folder).map_err(msg)
    }
    async face_rig_library(b) -> Value {
        b.face_rig_library().await.map_err(msg)
    }
    async face_rig_preview(b, request: FaceRigPreview) -> Value {
        b.face_rig_preview(request).await.map_err(msg)
    }
    async restart_engine(b) -> NodePacks {
        b.restart_engine().await.map_err(msg)
    }
    sync low_memory_mode(b) -> LowMemoryMode {
        Ok(b.low_memory_mode())
    }
    // Saves the setting and restarts ComfyUI to apply it, unless a job is running.
    async set_low_memory_mode(b, enabled: bool) -> LowMemoryMode {
        b.set_low_memory_mode(enabled).await.map_err(msg)
    }
    sync engine_settings(b) -> EngineSettings {
        b.engine_settings().map_err(msg)
    }
    // Saves the package, the start timeout and the Civitai lookup switch; each value is checked in the backend before
    // anything is written.
    sync set_engine_settings(b, patch: EngineSettingsPatch) -> EngineSettings {
        b.set_engine_settings(patch).map_err(msg)
    }
    sync remove_model_root(b, index: usize) -> EngineSettings {
        b.remove_model_root(index).map_err(msg)
    }
    async node_defs(b) -> Value {
        b.node_defs().await.map_err(msg)
    }
    // The words ComfyUI's own screens show in one of the app's languages; any other `locale` is refused here.
    async comfy_ui_locale(b, locale: String) -> Option<crate::comfy::ui_locale::ComfyUiLocale> {
        if crate::comfy::ui_locale::comfy_language(&locale).is_none() {
            return Err("unknown language".into());
        }
        b.comfy_ui_locale(&locale).await.map_err(msg)
    }
    async agent_status(b) -> AgentStatus {
        Ok(b.agent_status().await)
    }
    async agent_login(b, provider: AgentProvider) -> AgentStatus {
        b.agent_login(provider).await.map_err(msg)
    }
    // Saves the OpenAI-compatible server (address, model, key) and selects it. The address, the model and the key are
    // checked in the backend; the key is stored with DPAPI and never comes back.
    async agent_endpoint_save(b, input: AgentEndpointInput) -> AgentStatus {
        b.agent_endpoint_save(input).await.map_err(msg)
    }
    async agent_endpoint_models(b, input: AgentEndpointInput) -> Vec<String> {
        b.agent_endpoint_models(input).await.map_err(msg)
    }
    async agent_endpoint_test(b, input: AgentEndpointInput) -> AgentEndpointTest {
        b.agent_endpoint_test(input).await.map_err(msg)
    }
    async agent_chat(b, request: AgentRequest) -> AgentReply {
        b.agent_chat(request).await.map_err(msg)
    }
    // The answer to one of the running request's tool calls. The id, the size and the shape are checked in the backend.
    sync agent_tool_result(b, answer: AgentToolAnswer) -> () {
        b.agent_tool_result(answer).map_err(msg)
    }
    // The assistant's fact look-up on Wikipedia (`ja` or `en` only; the words are checked and sent from the backend,
    // never from the WebView). The window asks the user before it calls this.
    async lookup_reference(b, language: String, query: String) -> Vec<crate::agent::reference::ReferenceHit> {
        b.lookup_reference(&language, &query).await.map_err(msg)
    }
    sync agent_cancel(b) -> () {
        b.agent_cancel();
        Ok(())
    }
    sync has_hf_token(b) -> bool {
        Ok(b.has_hf_token())
    }
    sync set_hf_token(b, token: Option<String>) -> () {
        b.set_hf_token(token).map_err(msg)
    }
    sync pack_status(b, kind: PackKind) -> PackStatus {
        Ok(b.pack_status(kind))
    }
    // The graphics card and its memory, for the screens that recommend models.
    async hardware_info(b) -> crate::hardware::HardwareInfo {
        tokio::task::spawn_blocking(crate::hardware::detect)
            .await
            .map_err(|e| e.to_string())
    }
    // The font families installed on this computer, for the font lists of the comic and the text editor.
    async list_fonts(b) -> Vec<String> {
        tokio::task::spawn_blocking(crate::fonts::installed_families)
            .await
            .map_err(|e| e.to_string())
    }
    async install_pack(b, kind: PackKind) -> () {
        b.install_pack(kind).await.map_err(msg)
    }
    sync cancel_pack(b, kind: PackKind) -> () {
        b.cancel_pack(kind);
        Ok(())
    }
    sync has_civitai_key(b) -> bool {
        Ok(b.has_civitai_key())
    }
    sync set_civitai_key(b, key: Option<String>) -> () {
        b.set_civitai_key(key).map_err(msg)
    }
    sync save_workflow(b, workflow: WorkflowInput) -> SavedWorkflow {
        b.save_workflow(workflow).map_err(msg)
    }
    sync delete_workflow(b, id: String) -> () {
        b.delete_workflow(&id).map_err(msg)
    }
    // Every saved comic project, oldest change first.
    sync list_comics(b) -> Vec<ComicRecord> {
        b.list_comics().map_err(msg)
    }
    // Saves a comic project under `id`. The backend checks the id, the JSON shape and the size before writing anything.
    sync save_comic(b, id: String, document: Value) -> () {
        b.save_comic(&id, document).map_err(msg)
    }
    // Removes a saved comic project; nothing happens when there is none.
    sync delete_comic(b, id: String) -> () {
        b.delete_comic(&id).map_err(msg)
    }
    // The saved canvas document (layers and masks), `null` before the first save.
    sync load_canvas(b) -> Option<String> {
        b.load_canvas().map_err(msg)
    }
    // Saves the canvas document. The backend checks the size limit and the JSON shape before writing anything.
    sync save_canvas(b, document: String) -> () {
        b.save_canvas(&document).map_err(msg)
    }
    // The first call of a page: the screen state the backend holds (settings, history, drafts...), or `null` when it holds
    // none and takes `local` (what the page's own storage has, sent only by a page never synced before) as its state.
    sync adopt_ui_state(b, local: Option<String>) -> Option<String> {
        b.adopt_ui_state(local.as_deref()).map_err(msg)
    }
    // Saves the screen state. The backend checks the size limit and the shape (an object of `novira.*` keys with text) first,
    // then tells the open pages (`ui_state_changed`, carrying `origin`, the saving page's own id).
    sync save_ui_state(b, state: String, origin: Option<String>) -> () {
        b.save_ui_state(&state, origin.as_deref()).map_err(msg)
    }
    // Unfinished downloads (Settings -> Data): only the files the backend lists can be deleted; the paths the caller
    // sends are matched against that list.
    async list_unfinished_downloads(b) -> Vec<UnfinishedDownload> {
        Ok(b.list_unfinished_downloads())
    }
    // Deletes the picked unfinished downloads and returns the ones left (a download running now is kept).
    async delete_unfinished_downloads(b, paths: Vec<String>) -> Vec<UnfinishedDownload> {
        b.delete_unfinished_downloads(&paths).map_err(msg)
    }
    // Whether the export watermark's files are on this PC.
    sync watermark_status(b) -> WatermarkStatus {
        Ok(b.watermark_status())
    }
    // Reads the marks of a gallery picture (the name is checked by the backend).
    async check_watermark_image(b, name: String) -> WatermarkCheck {
        b.check_watermark_image(name).await.map_err(msg)
    }
    sync discard_restore(b) -> () {
        b.discard_restore().map_err(msg)
    }
    // Whether this start applied a restore (with the screen state to put back) or failed one; answered once.
    sync take_restored_ui_state(b) -> RestoreOutcome {
        Ok(b.take_restore_outcome())
    }
}
