//! IPC commands. Each one maps to a `BackendClient` method in `frontend/src/backend/client.ts`; errors reach the frontend
//! as their message. The commands that only need the backend call `novira_core::api::call`, the command layer the browser
//! server shares, so an argument is checked in one place. What stays here needs the window: dialogs, the raw upload body,
//! zoom, the browser, and the state the shell keeps between calls.
use novira_core::agent::{
    AgentEndpointInput, AgentEndpointTest, AgentProvider, AgentReply, AgentRequest, AgentStatus,
    AgentToolAnswer,
};
use novira_core::api::{call, Res};
use novira_core::backup::{BackupInfo, BackupSummary, RestoreOutcome};
use novira_core::media::export::{ExportOptions, ExportResult};
use novira_core::models::civitai::{SearchParams, SearchResult};
use novira_core::packs::{PackKind, PackStatus};
use novira_core::sync::LockExt;
use novira_core::types::*;
use novira_core::unfinished::UnfinishedDownload;
use novira_core::{Backend, BackendError};
use serde_json::Value;
use std::path::PathBuf;
use tauri::State;

/// The shared command layer's guard: a panic in a synchronous command becomes an error instead of ending the main thread.
pub use novira_core::api::guard;

fn msg(e: BackendError) -> String {
    e.to_string()
}

/// Header that carries the JSON options of a raw-body image upload.
pub const UPLOAD_OPTIONS_HEADER: &str = "x-novira-options";

#[tauri::command]
pub fn bootstrap(backend: State<'_, Backend>) -> Res<Bootstrap> {
    guard(|| call::bootstrap(&backend))
}

#[tauri::command]
pub fn create_board(backend: State<'_, Backend>, name: String) -> Res<BoardDTO> {
    guard(|| call::create_board(&backend, name))
}

#[tauri::command]
pub fn update_board(backend: State<'_, Backend>, id: String, patch: BoardPatch) -> Res<BoardDTO> {
    guard(|| call::update_board(&backend, id, patch))
}

#[tauri::command]
pub fn delete_board(
    backend: State<'_, Backend>,
    id: String,
    delete_images: bool,
) -> Res<Vec<String>> {
    guard(|| call::delete_board(&backend, id, delete_images))
}

/// The image bytes come as the raw request body; the options in a header.
#[tauri::command]
pub async fn upload_image(
    backend: State<'_, Backend>,
    request: tauri::ipc::Request<'_>,
) -> Res<ImageDTO> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("upload_image expects the image bytes as the request body".into());
    };
    let opts: ImageOptions = match request.headers().get(UPLOAD_OPTIONS_HEADER) {
        Some(v) => serde_json::from_str(v.to_str().map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?,
        None => ImageOptions::default(),
    };
    backend.upload_image(bytes.clone(), opts).await.map_err(msg)
}

#[tauri::command]
pub fn update_images(
    backend: State<'_, Backend>,
    names: Vec<String>,
    patch: ImagePatch,
) -> Res<Vec<ImageDTO>> {
    guard(|| call::update_images(&backend, names, patch))
}

#[tauri::command]
pub fn delete_images(backend: State<'_, Backend>, names: Vec<String>) -> Res<()> {
    guard(|| call::delete_images(&backend, names))
}

#[tauri::command]
pub fn enqueue(backend: State<'_, Backend>, request: EnqueueRequest) -> Res<Vec<QueueItem>> {
    guard(|| call::enqueue(&backend, request))
}

#[tauri::command]
pub fn cancel_queue_item(backend: State<'_, Backend>, id: u64) -> Res<()> {
    guard(|| call::cancel_queue_item(&backend, id))
}

#[tauri::command]
pub fn cancel_batch(backend: State<'_, Backend>, batch_id: String) -> Res<()> {
    guard(|| call::cancel_batch(&backend, batch_id))
}

#[tauri::command]
pub fn clear_queue(backend: State<'_, Backend>) -> Res<()> {
    guard(|| call::clear_queue(&backend))
}

#[tauri::command]
pub fn prune_queue(backend: State<'_, Backend>) -> Res<()> {
    guard(|| call::prune_queue(&backend))
}

#[tauri::command]
pub fn pause_processor(backend: State<'_, Backend>) -> Res<()> {
    guard(|| call::pause_processor(&backend))
}

#[tauri::command]
pub fn resume_processor(backend: State<'_, Backend>) -> Res<()> {
    guard(|| call::resume_processor(&backend))
}

#[tauri::command]
pub fn retry_queue_item(
    backend: State<'_, Backend>,
    id: u64,
    size: Option<RetrySize>,
) -> Res<Option<QueueItem>> {
    guard(|| call::retry_queue_item(&backend, id, size))
}

#[tauri::command]
pub fn queue_snapshot(backend: State<'_, Backend>) -> Res<QueueSnapshot> {
    guard(|| call::queue_snapshot(&backend))
}

#[tauri::command]
pub fn list_starter_models(backend: State<'_, Backend>) -> Res<Vec<StarterModel>> {
    guard(|| call::list_starter_models(&backend))
}

#[tauri::command]
pub fn model_parts(backend: State<'_, Backend>, model_key: String) -> Res<ModelPartsReport> {
    guard(|| call::model_parts(&backend, model_key))
}

/// The model files the last "Scan Folder" found in a folder the user chose in the native dialog. `install_model` takes a
/// local path only from this list, so the WebView cannot make the backend read a file it typed.
#[derive(Default)]
pub struct ScannedModels(pub std::sync::Mutex<std::collections::HashSet<String>>);

/// Whether `source` may be installed: a local path only when the last scan listed it; every other kind of source (a
/// Civitai or Hugging Face reference, a checked address) is judged by the backend's own parsing.
pub fn source_is_allowed(source: &str, scanned: &std::collections::HashSet<String>) -> bool {
    match novira_core::models::install::parse_source(source) {
        Ok(novira_core::models::install::Source::Local(path)) => {
            scanned.contains(path.to_string_lossy().as_ref())
        }
        _ => true,
    }
}

#[tauri::command]
pub async fn install_model(
    backend: State<'_, Backend>,
    scanned: State<'_, ScannedModels>,
    source: String,
    name: Option<String>,
) -> Res<ModelInstallJob> {
    let allowed = source_is_allowed(&source, &scanned.0.lock_safe());
    if !allowed {
        return Err(
            "A local model file is installed from Scan Folder: choose its folder there".into(),
        );
    }
    backend.install_model(&source, name).map_err(msg)
}

#[tauri::command]
pub fn cancel_install(backend: State<'_, Backend>, job_id: String) -> Res<()> {
    guard(|| call::cancel_install(&backend, job_id))
}

#[tauri::command]
pub fn update_model(backend: State<'_, Backend>, key: String, patch: Value) -> Res<ModelConfig> {
    guard(|| call::update_model(&backend, key, patch))
}

#[tauri::command]
pub fn delete_model(backend: State<'_, Backend>, key: String) -> Res<()> {
    guard(|| call::delete_model(&backend, key))
}

/// Asks for a folder and lists the model files in it; `null` when the user cancels the dialog. The files found are the
/// only local paths `install_model` accepts afterwards.
#[tauri::command]
pub async fn scan_folder(
    webview: tauri::Webview,
    backend: State<'_, Backend>,
    scanned: State<'_, ScannedModels>,
) -> Res<Option<Vec<ScannedFile>>> {
    let Some(folder) = crate::dialogs::pick_folder(&webview).await else {
        return Ok(None);
    };
    let files = backend
        .scan_folder(&folder.to_string_lossy())
        .await
        .map_err(msg)?;
    *scanned.0.lock_safe() = files.iter().map(|f| f.path.clone()).collect();
    Ok(Some(files))
}

#[tauri::command]
pub async fn list_hugging_face_files(
    backend: State<'_, Backend>,
    repo: String,
) -> Res<Vec<String>> {
    call::list_hugging_face_files(&backend, repo).await
}

#[tauri::command]
pub async fn search_civitai(
    backend: State<'_, Backend>,
    params: SearchParams,
) -> Res<SearchResult> {
    call::search_civitai(&backend, params).await
}

#[tauri::command]
pub fn node_packs(backend: State<'_, Backend>) -> Res<NodePacks> {
    guard(|| call::node_packs(&backend))
}

#[tauri::command]
pub async fn install_node_pack(
    backend: State<'_, Backend>,
    url: String,
    version: Option<String>,
) -> Res<()> {
    call::install_node_pack(&backend, url, version).await
}

#[tauri::command]
pub async fn comfy_versions(backend: State<'_, Backend>) -> Res<Vec<String>> {
    call::comfy_versions(&backend).await
}

#[tauri::command]
pub async fn switch_comfy_version(
    backend: State<'_, Backend>,
    version: String,
) -> Res<Vec<String>> {
    call::switch_comfy_version(&backend, version).await
}

#[tauri::command]
pub async fn node_pack_versions(backend: State<'_, Backend>, url: String) -> Res<Vec<String>> {
    call::node_pack_versions(&backend, url).await
}

#[tauri::command]
pub async fn registry_nodes(
    backend: State<'_, Backend>,
    refresh: bool,
) -> Res<Vec<novira_core::comfy::registry::RegistryNode>> {
    call::registry_nodes(&backend, refresh).await
}

#[tauri::command]
pub async fn node_pack_info(
    backend: State<'_, Backend>,
    url: String,
) -> Res<novira_core::comfy::node_packs::RepoInfo> {
    call::node_pack_info(&backend, url).await
}

#[tauri::command]
pub fn cancel_node_pack(backend: State<'_, Backend>, url: String) -> Res<()> {
    guard(|| call::cancel_node_pack(&backend, url))
}

#[tauri::command]
pub fn remove_node_pack(backend: State<'_, Backend>, folder: String) -> Res<NodePacks> {
    guard(|| call::remove_node_pack(&backend, folder))
}

#[tauri::command]
pub async fn face_rig_library(backend: State<'_, Backend>) -> Res<Value> {
    call::face_rig_library(&backend).await
}

#[tauri::command]
pub async fn face_rig_preview(backend: State<'_, Backend>, request: FaceRigPreview) -> Res<Value> {
    call::face_rig_preview(&backend, request).await
}

#[tauri::command]
pub async fn restart_engine(backend: State<'_, Backend>) -> Res<NodePacks> {
    call::restart_engine(&backend).await
}

#[tauri::command]
pub fn low_memory_mode(backend: State<'_, Backend>) -> Res<LowMemoryMode> {
    guard(|| call::low_memory_mode(&backend))
}

#[tauri::command]
pub async fn set_low_memory_mode(backend: State<'_, Backend>, enabled: bool) -> Res<LowMemoryMode> {
    call::set_low_memory_mode(&backend, enabled).await
}

// Engine settings (settings.json). Changes apply at the next start. A model folder comes only from the shell's own
// folder dialog: the WebView never sends a path.

#[tauri::command]
pub fn engine_settings(backend: State<'_, Backend>) -> Res<EngineSettings> {
    guard(|| call::engine_settings(&backend))
}

#[tauri::command]
pub fn set_engine_settings(
    backend: State<'_, Backend>,
    patch: EngineSettingsPatch,
) -> Res<EngineSettings> {
    guard(|| call::set_engine_settings(&backend, patch))
}

/// Asks for a folder and adds it to the extra model folders; `null` when the user cancels the dialog.
#[tauri::command]
pub async fn add_model_root(
    webview: tauri::Webview,
    backend: State<'_, Backend>,
) -> Res<Option<EngineSettings>> {
    backend.check_model_root_room().map_err(msg)?;
    let Some(folder) = crate::dialogs::pick_folder(&webview).await else {
        return Ok(None);
    };
    backend.add_model_root(&folder).map(Some).map_err(msg)
}

#[tauri::command]
pub fn remove_model_root(backend: State<'_, Backend>, index: usize) -> Res<EngineSettings> {
    guard(|| call::remove_model_root(&backend, index))
}

#[tauri::command]
pub async fn node_defs(backend: State<'_, Backend>) -> Res<Value> {
    call::node_defs(&backend).await
}

#[tauri::command]
pub async fn comfy_ui_locale(
    backend: State<'_, Backend>,
    locale: String,
) -> Res<Option<novira_core::comfy::ui_locale::ComfyUiLocale>> {
    call::comfy_ui_locale(&backend, locale).await
}

#[tauri::command]
pub async fn agent_status(backend: State<'_, Backend>) -> Res<AgentStatus> {
    call::agent_status(&backend).await
}

#[tauri::command]
pub async fn agent_login(backend: State<'_, Backend>, provider: AgentProvider) -> Res<AgentStatus> {
    call::agent_login(&backend, provider).await
}

#[tauri::command]
pub async fn agent_endpoint_save(
    backend: State<'_, Backend>,
    input: AgentEndpointInput,
) -> Res<AgentStatus> {
    call::agent_endpoint_save(&backend, input).await
}

#[tauri::command]
pub async fn agent_endpoint_models(
    backend: State<'_, Backend>,
    input: AgentEndpointInput,
) -> Res<Vec<String>> {
    call::agent_endpoint_models(&backend, input).await
}

#[tauri::command]
pub async fn agent_endpoint_test(
    backend: State<'_, Backend>,
    input: AgentEndpointInput,
) -> Res<AgentEndpointTest> {
    call::agent_endpoint_test(&backend, input).await
}

#[tauri::command]
pub async fn agent_chat(backend: State<'_, Backend>, request: AgentRequest) -> Res<AgentReply> {
    call::agent_chat(&backend, request).await
}

#[tauri::command]
pub fn agent_tool_result(backend: State<'_, Backend>, answer: AgentToolAnswer) -> Res<()> {
    guard(|| call::agent_tool_result(&backend, answer))
}

#[tauri::command]
pub async fn lookup_reference(
    backend: State<'_, Backend>,
    language: String,
    query: String,
) -> Res<Vec<novira_core::agent::reference::ReferenceHit>> {
    call::lookup_reference(&backend, language, query).await
}

#[tauri::command]
pub fn agent_cancel(backend: State<'_, Backend>) -> Res<()> {
    guard(|| call::agent_cancel(&backend))
}

#[tauri::command]
pub fn has_hf_token(backend: State<'_, Backend>) -> Res<bool> {
    guard(|| call::has_hf_token(&backend))
}

#[tauri::command]
pub fn set_hf_token(backend: State<'_, Backend>, token: Option<String>) -> Res<()> {
    guard(|| call::set_hf_token(&backend, token))
}

/// Opens a Hugging Face model page in the default browser (the address is checked by `api::huggingface_page_url`).
#[tauri::command]
pub fn open_huggingface_page(repo: String) -> Res<()> {
    guard(|| {
        open_in_browser(&novira_core::api::huggingface_page_url(&repo)?).map_err(|e| e.to_string())
    })
}

/// Opens the page a model came from, in the default browser (the address is checked by `api::source_page_url`).
#[tauri::command]
pub fn open_source_page(url: String) -> Res<()> {
    guard(|| open_in_browser(&novira_core::api::source_page_url(&url)?).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn pack_status(backend: State<'_, Backend>, kind: PackKind) -> Res<PackStatus> {
    guard(|| call::pack_status(&backend, kind))
}

#[tauri::command]
pub async fn hardware_info(
    backend: State<'_, Backend>,
) -> Res<novira_core::hardware::HardwareInfo> {
    call::hardware_info(&backend).await
}

#[tauri::command]
pub async fn list_fonts(backend: State<'_, Backend>) -> Res<Vec<String>> {
    call::list_fonts(&backend).await
}

#[tauri::command]
pub async fn install_pack(backend: State<'_, Backend>, kind: PackKind) -> Res<()> {
    call::install_pack(&backend, kind).await
}

#[tauri::command]
pub fn cancel_pack(backend: State<'_, Backend>, kind: PackKind) -> Res<()> {
    guard(|| call::cancel_pack(&backend, kind))
}

#[tauri::command]
pub fn has_civitai_key(backend: State<'_, Backend>) -> Res<bool> {
    guard(|| call::has_civitai_key(&backend))
}

#[tauri::command]
pub fn set_civitai_key(backend: State<'_, Backend>, key: Option<String>) -> Res<()> {
    guard(|| call::set_civitai_key(&backend, key))
}

#[tauri::command]
pub fn save_workflow(backend: State<'_, Backend>, workflow: WorkflowInput) -> Res<SavedWorkflow> {
    guard(|| call::save_workflow(&backend, workflow))
}

/// Smallest and largest zoom of the whole UI (Ctrl+- / Ctrl++ in the desktop app).
pub const UI_ZOOM_RANGE: (f64, f64) = (0.5, 3.0);

/// Checks a requested UI zoom factor: finite and inside `UI_ZOOM_RANGE`.
pub fn valid_ui_zoom(scale: f64) -> Result<f64, String> {
    let (min, max) = UI_ZOOM_RANGE;
    if scale.is_finite() && (min..=max).contains(&scale) {
        Ok(scale)
    } else {
        Err(format!("zoom must be between {min} and {max}"))
    }
}

/// Zooms the whole page, like a browser's Ctrl+/-, which the desktop WebView does not offer by itself.
#[tauri::command]
pub fn set_ui_zoom(webview: tauri::Webview, scale: f64) -> Res<()> {
    guard(|| {
        webview
            .set_zoom(valid_ui_zoom(scale)?)
            .map_err(|e| e.to_string())
    })
}

/// Opens a model's Civitai page in the default browser (the address is checked by `api::civitai_page_url`).
#[tauri::command]
pub fn open_civitai_page(model_id: String) -> Res<()> {
    guard(|| {
        open_in_browser(&novira_core::api::civitai_page_url(&model_id)?).map_err(|e| e.to_string())
    })
}

fn open_in_browser(url: &str) -> std::io::Result<()> {
    novira_core::api::browser_command(url).spawn().map(|_| ())
}

#[tauri::command]
pub fn delete_workflow(backend: State<'_, Backend>, id: String) -> Res<()> {
    guard(|| call::delete_workflow(&backend, id))
}

#[tauri::command]
pub fn list_comics(backend: State<'_, Backend>) -> Res<Vec<ComicRecord>> {
    guard(|| call::list_comics(&backend))
}

#[tauri::command]
pub fn save_comic(backend: State<'_, Backend>, id: String, document: Value) -> Res<()> {
    guard(|| call::save_comic(&backend, id, document))
}

#[tauri::command]
pub fn delete_comic(backend: State<'_, Backend>, id: String) -> Res<()> {
    guard(|| call::delete_comic(&backend, id))
}

#[tauri::command]
pub fn load_canvas(backend: State<'_, Backend>) -> Res<Option<String>> {
    guard(|| call::load_canvas(&backend))
}

#[tauri::command]
pub fn save_canvas(backend: State<'_, Backend>, document: String) -> Res<()> {
    guard(|| call::save_canvas(&backend, document))
}

#[tauri::command]
pub fn adopt_ui_state(backend: State<'_, Backend>, local: Option<String>) -> Res<Option<String>> {
    guard(|| call::adopt_ui_state(&backend, local))
}

#[tauri::command]
pub fn save_ui_state(
    backend: State<'_, Backend>,
    state: String,
    origin: Option<String>,
) -> Res<()> {
    guard(|| call::save_ui_state(&backend, state, origin))
}

// Unfinished downloads (Settings → Data) -----------------------------------------
// Only the files the backend lists can be deleted; the paths the WebView sends are matched against that list.

#[tauri::command]
pub async fn list_unfinished_downloads(
    backend: State<'_, Backend>,
) -> Res<Vec<UnfinishedDownload>> {
    call::list_unfinished_downloads(&backend).await
}

#[tauri::command]
pub async fn delete_unfinished_downloads(
    backend: State<'_, Backend>,
    paths: Vec<String>,
) -> Res<Vec<UnfinishedDownload>> {
    call::delete_unfinished_downloads(&backend, paths).await
}

// Export for sharing and backups --------------------------------
// The shell opens the native dialog itself and hands the chosen path straight to the backend; the WebView only
// learns whether the user cancelled (`null`) and what was written.

/// The folder the last export wrote into, so "open the folder" never takes a path from the WebView.
#[derive(Default)]
pub struct LastExport(pub std::sync::Mutex<Option<PathBuf>>);

/// Asks for a folder and writes clean copies of the pictures there; `null` when the user cancels the dialog.
#[tauri::command]
pub async fn export_images(
    webview: tauri::Webview,
    backend: State<'_, Backend>,
    last: State<'_, LastExport>,
    names: Vec<String>,
    options: ExportOptions,
) -> Res<Option<ExportResult>> {
    backend.check_export(&names, &options).map_err(msg)?;
    let Some(folder) = crate::dialogs::pick_folder(&webview).await else {
        return Ok(None);
    };
    let result = backend
        .export_images(names, options, folder.clone())
        .await
        .map_err(msg)?;
    *last.0.lock_safe() = Some(folder);
    Ok(Some(result))
}

#[tauri::command]
pub fn watermark_status(backend: State<'_, Backend>) -> Res<WatermarkStatus> {
    guard(|| call::watermark_status(&backend))
}

/// Downloads the watermark's files again after a failure; returns at once (the status tells how it goes).
#[tauri::command]
pub fn prepare_watermark(backend: State<'_, Backend>) -> Res<()> {
    guard(|| {
        let backend = backend.inner().clone();
        tauri::async_runtime::spawn(async move { backend.prepare_watermark().await });
        Ok(())
    })
}

/// Asks for a picture file in the native dialog and reads its marks; `null` when the user cancels the dialog.
#[tauri::command]
pub async fn check_watermark_file(
    webview: tauri::Webview,
    backend: State<'_, Backend>,
) -> Res<Option<WatermarkCheck>> {
    let Some(path) = crate::dialogs::open_picture(&webview).await else {
        return Ok(None);
    };
    backend
        .check_watermark_file(path)
        .await
        .map(Some)
        .map_err(msg)
}

#[tauri::command]
pub async fn check_watermark_image(
    backend: State<'_, Backend>,
    name: String,
) -> Res<WatermarkCheck> {
    call::check_watermark_image(&backend, name).await
}

/// Opens the folder of the last export in Explorer.
#[tauri::command]
pub fn reveal_export_folder(last: State<'_, LastExport>) -> Res<()> {
    guard(|| {
        let folder = last
            .0
            .lock_safe()
            .clone()
            .ok_or("nothing was exported yet")?;
        open_folder(&folder).map_err(|e| e.to_string())
    })
}

/// Asks where to save and writes a backup there; `null` when the user cancels the dialog.
#[tauri::command]
pub async fn create_backup(
    webview: tauri::Webview,
    backend: State<'_, Backend>,
    ui_state: String,
) -> Res<Option<BackupSummary>> {
    backend.check_ui_state(&ui_state).map_err(msg)?;
    let name = novira_core::backup::default_file_name();
    let Some(target) = crate::dialogs::save_zip(&webview, &name).await else {
        return Ok(None);
    };
    backend
        .create_backup(ui_state, target)
        .await
        .map(Some)
        .map_err(msg)
}

/// Asks for a backup, checks it and unpacks it for a restore; `null` when the user cancels the dialog.
#[tauri::command]
pub async fn open_backup(
    webview: tauri::Webview,
    backend: State<'_, Backend>,
) -> Res<Option<BackupInfo>> {
    let Some(zip) = crate::dialogs::open_zip(&webview).await else {
        return Ok(None);
    };
    backend.stage_restore(zip).await.map(Some).map_err(msg)
}

/// The user confirmed the restore: it is applied when the app starts again, which happens right away.
#[tauri::command]
pub fn confirm_restore(webview: tauri::Webview, backend: State<'_, Backend>) -> Res<()> {
    guard(|| {
        backend.confirm_restore().map_err(msg)?;
        // Exits through the normal path (RunEvent::Exit stops the engine), then starts the app again.
        tauri::Manager::app_handle(&webview).request_restart();
        Ok(())
    })
}

#[tauri::command]
pub fn discard_restore(backend: State<'_, Backend>) -> Res<()> {
    guard(|| call::discard_restore(&backend))
}

#[tauri::command]
pub fn take_restored_ui_state(backend: State<'_, Backend>) -> Res<RestoreOutcome> {
    guard(|| call::take_restored_ui_state(&backend))
}

#[cfg(windows)]
fn open_folder(folder: &std::path::Path) -> std::io::Result<()> {
    // The folder came from the native dialog, never from the WebView; passed as one argument, no shell.
    std::process::Command::new("explorer.exe")
        .arg(folder)
        .spawn()
        .map(|_| ())
}

#[cfg(not(windows))]
fn open_folder(folder: &std::path::Path) -> std::io::Result<()> {
    std::process::Command::new("xdg-open")
        .arg(folder)
        .spawn()
        .map(|_| ())
}

include!("command_list.rs");

#[cfg(test)]
mod tests {
    use super::{source_is_allowed, COMMANDS};

    #[test]
    fn a_local_model_path_is_installed_only_when_the_last_scan_listed_it() {
        let scanned: std::collections::HashSet<String> =
            ["D:\\models\\a.safetensors".to_string()].into();
        let none = std::collections::HashSet::new();
        assert!(source_is_allowed("D:\\models\\a.safetensors", &scanned));
        assert!(source_is_allowed("  D:\\models\\a.safetensors ", &scanned));
        for typed in [
            "D:\\models\\b.safetensors",
            "D:\\models\\..\\secret.safetensors",
            "C:\\Windows\\win.ini",
            "\\\\server\\share\\a.safetensors",
        ] {
            assert!(!source_is_allowed(typed, &scanned), "{typed}");
        }
        assert!(!source_is_allowed("D:\\models\\a.safetensors", &none));
        // Everything that is not a local path is left to the backend's own parsing.
        for other in [
            "civitai:1/2-3",
            "https://civitai.com/models/1",
            "owner/repo::x.safetensors",
            "not a source",
        ] {
            assert!(source_is_allowed(other, &none), "{other}");
        }
    }

    #[test]
    fn the_capability_allows_exactly_the_registered_commands() {
        let cap: serde_json::Value =
            serde_json::from_str(include_str!("../capabilities/default.json")).unwrap();
        let allowed: Vec<String> = cap["permissions"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|p| {
                p.as_str()?
                    .strip_prefix("allow-")
                    .map(|s| s.replace('-', "_"))
            })
            .collect();
        let mut expected: Vec<String> = COMMANDS.iter().map(|c| c.to_string()).collect();
        let mut allowed = allowed;
        expected.sort();
        allowed.sort();
        assert_eq!(allowed, expected);
        // No plugin permissions beyond event listening and colouring the window frame to match the theme.
        assert!(cap["permissions"].as_array().unwrap().iter().all(|p| {
            let p = p.as_str().unwrap();
            p.starts_with("allow-")
                || p.starts_with("core:event:")
                || p == "core:window:allow-set-theme"
        }));
        // Only the app's own window gets the commands; remote pages get none.
        assert_eq!(cap["windows"], serde_json::json!(["main"]));
        assert!(cap.get("remote").is_none() && cap.get("webviews").is_none());
    }

    #[test]
    fn every_registered_command_is_in_the_shared_layer_or_in_its_shell_only_list() {
        use novira_core::api::{NAMES, SHELL_ONLY};
        let mut shared: Vec<&str> = NAMES.iter().chain(SHELL_ONLY).copied().collect();
        let mut registered: Vec<&str> = COMMANDS.to_vec();
        shared.sort();
        registered.sort();
        assert_eq!(shared, registered);
    }

    #[test]
    fn a_delegated_command_takes_the_parameters_of_the_shared_layer() {
        // The IPC argument names are the shared layer's parameters (camelCase on the wire in both shells).
        let code = include_str!("commands.rs");
        let command =
            regex::Regex::new(r"#\[tauri::command\]\s*pub (?:async )?fn (\w+)\(([^)]*)\)").unwrap();
        let param = regex::Regex::new(r"(?:^|,)\s*(\w+)\s*:\s*([^,]+)").unwrap();
        let mut checked = 0;
        for c in command.captures_iter(code) {
            let Some((_, expected)) = novira_core::api::PARAMETERS
                .iter()
                .find(|(n, _)| *n == &c[1])
            else {
                continue;
            };
            let own: Vec<String> = param
                .captures_iter(&c[2])
                .filter(|p| !p[2].trim_start().starts_with("State<"))
                .map(|p| p[1].to_string())
                .collect();
            assert_eq!(own, *expected, "{}", &c[1]);
            checked += 1;
        }
        assert_eq!(checked, novira_core::api::NAMES.len());
    }

    #[test]
    fn a_panicking_command_body_becomes_an_error() {
        let r: super::Res<u32> = super::guard(|| panic!("lock gone"));
        assert_eq!(r, Err("Internal error: lock gone".to_string()));
        let r: super::Res<u32> = super::guard(|| panic!("{}", String::from("formatted")));
        assert_eq!(r, Err("Internal error: formatted".to_string()));
        assert_eq!(super::guard(|| Ok(7)), Ok(7));
    }

    #[test]
    fn ui_zoom_accepts_only_finite_factors_in_range() {
        use super::valid_ui_zoom;
        assert_eq!(valid_ui_zoom(1.0), Ok(1.0));
        assert_eq!(valid_ui_zoom(0.5), Ok(0.5));
        assert_eq!(valid_ui_zoom(3.0), Ok(3.0));
        for bad in [0.0, 0.49, 3.01, -1.0, f64::NAN, f64::INFINITY] {
            assert!(valid_ui_zoom(bad).is_err(), "{bad} must be refused");
        }
    }
}
