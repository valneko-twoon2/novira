//! A thin shell: opens the backend, exposes it over IPC, forwards its events and serves images.
//! The logic lives in `backend/crates/novira-core`.
pub mod commands;
pub mod dialogs;
pub mod events;
pub mod first_run;
pub mod image_scheme;
pub mod startup;

use novira_core::Backend;
use std::path::{Path, PathBuf};
use tauri::Manager;

pub const DATA_DIR_ENV: &str = "NOVIRA_DATA_DIR";
/// Folder name beside the app (ignored by git).
pub const DATA_DIR_NAME: &str = "novira-data";

/// The folder the app lives in: the executable's folder, or the repository root in a debug build.
fn app_dir() -> PathBuf {
    if cfg!(debug_assertions) {
        // backend/src-tauri -> the repository root
        // `canonicalize` gives a `\\?\` path on Windows; the Python steps get paths below this one and cannot use it.
        novira_core::plain_path(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../..")
                .canonicalize()
                .unwrap_or_else(|_| PathBuf::from(".")),
        )
    } else {
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(PathBuf::from))
            .unwrap_or_else(|| PathBuf::from("."))
    }
}

/// The user's folder (`%USERPROFILE%`, else `$HOME`), where a release build keeps its data.
fn user_dir() -> Option<PathBuf> {
    ["USERPROFILE", "HOME"]
        .iter()
        .filter_map(std::env::var_os)
        .find(|p| !p.is_empty())
        .map(PathBuf::from)
}

/// Where the data goes when `NOVIRA_DATA_DIR` is not set. A debug build keeps it in the repository, as before. A release build
/// keeps it in the user's folder, but a copy that already has a data folder beside it keeps using that one, so an update
/// does not leave the models and pictures behind.
fn default_data_dir(app_dir: &Path, user_dir: Option<&Path>, debug: bool) -> PathBuf {
    let beside = app_dir.join(DATA_DIR_NAME);
    match user_dir {
        Some(user) if !debug && !beside.is_dir() => user.join(DATA_DIR_NAME),
        _ => beside,
    }
}

fn data_dir_from_env() -> Option<PathBuf> {
    std::env::var_os(DATA_DIR_ENV)
        .filter(|p| !p.is_empty())
        .map(|p| novira_core::plain_path(PathBuf::from(p)))
}

/// The file that records the data folder chosen in the Settings screen. Not used when `NOVIRA_DATA_DIR` fixes the
/// folder. A debug build has a pointer of its own, so it never moves the installed app's data.
fn location_pointer() -> Option<PathBuf> {
    if data_dir_from_env().is_some() {
        return None;
    }
    novira_core::data_location::pointer_path(cfg!(debug_assertions))
}

/// The folder a start with no choice would use.
fn default_data_dir_now() -> PathBuf {
    default_data_dir(&app_dir(), user_dir().as_deref(), cfg!(debug_assertions))
}

/// Whether nothing says where the data goes yet, so the first-start screen asks (`novira_core::first_run`). Data beside
/// the app, or in the user's folder where earlier versions kept it, is data already.
fn first_run_needed() -> bool {
    let Some(pointer) = location_pointer() else {
        return false;
    };
    let beside = app_dir().join(DATA_DIR_NAME);
    let user = user_dir().map(|u| u.join(DATA_DIR_NAME));
    let existing: Vec<&Path> = std::iter::once(beside.as_path())
        .chain(user.as_deref())
        .collect();
    novira_core::first_run::needed(&pointer, &existing)
}

/// Everything novira stores (models, generated images, ComfyUI, database, logs) goes in this folder: `NOVIRA_DATA_DIR`,
/// else the one chosen in the Settings screen, else the default one (see `default_data_dir`).
fn data_dir() -> PathBuf {
    if let Some(dir) = data_dir_from_env() {
        return dir;
    }
    location_pointer()
        .and_then(|pointer| novira_core::data_location::read(&pointer))
        .map(|location| location.data_dir)
        .unwrap_or_else(default_data_dir_now)
}

/// WebView2 keeps what the page stores itself (presets, layout, ...) in a profile folder. By default that is one folder
/// per app identifier, shared by the debug build, the release build and an installed copy, so none of them could be tried
/// with a clean state. The profile goes in the data folder instead, so `NOVIRA_DATA_DIR` also gives a clean page state.
/// An explicit `WEBVIEW2_USER_DATA_FOLDER` (the isolated real-app run) wins.
fn use_own_webview_profile() {
    const ENV: &str = "WEBVIEW2_USER_DATA_FOLDER";
    if std::env::var_os(ENV).is_none() {
        // At the first start the data folder is not chosen yet, and the page must not leave a profile in the default one.
        let profile = match location_pointer().filter(|_| first_run_needed()) {
            Some(pointer) => pointer.with_file_name("setup-webview"),
            None => data_dir().join("webview"),
        };
        std::env::set_var(ENV, profile);
    }
}

fn open_backend() -> Result<Backend, startup::Refusal> {
    novira_core::startup::open_backend(&data_dir(), image_scheme::url_base())
}

/// Gives the window the small frame of the app's icon (16 px at 100 % scale, 20 at 125 %, and so on). Tauri hands the window the
/// 32 px frame as its small icon, which Windows then shrinks for the title bar and the Task Manager, so the row of the window
/// looked heavier than the row of the program, which shows the small frame itself. The frame is picked again when the window
/// moves to a display of another scale, or the scale changes.
#[cfg(windows)]
fn fit_window_icon(app: &tauri::App) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    set_small_icon(&window, window.scale_factor().unwrap_or(1.0));
    let refit = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::ScaleFactorChanged { scale_factor, .. } = event {
            set_small_icon(&refit, *scale_factor);
        }
    });
}

#[cfg(windows)]
fn set_small_icon(window: &tauri::WebviewWindow, scale: f64) {
    let size = (16.0 * scale).round().max(16.0) as u32;
    match tauri::image::Image::from_app_icon_resource(size) {
        Ok(icon) => {
            if let Err(e) = window.set_icon(icon) {
                novira_core::applog::warn("window", format!("could not set the window icon: {e}"));
            }
        }
        Err(e) => novira_core::applog::warn("window", format!("no {size} px app icon: {e}")),
    }
}

/// Panics are logged (file, developer log) before the default report. Tauri commands are guarded (see
/// `commands::guard`) and background tasks are separate tokio tasks, so a panic there does not end the app.
fn install_panic_hook() {
    let default = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let place = info
            .location()
            .map(|l| format!(" at {}:{}", l.file(), l.line()))
            .unwrap_or_default();
        let what = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "unknown panic".into());
        novira_core::applog::error("panic", format!("{what}{place}"));
        default(info);
    }));
}

pub fn run() {
    install_panic_hook();
    // A change of the data folder asked for in the Settings screen is carried out now, before the folder is opened.
    if let Some(pointer) = location_pointer() {
        novira_core::data_location::apply_pending(&pointer);
    }
    use_own_webview_profile();
    let app = tauri::Builder::default()
        .setup(|app| {
            app.manage(first_run::FirstRun::default());
            app.manage(commands::LastExport::default());
            app.manage(commands::ScannedModels::default());
            if first_run_needed() {
                // The first-start screen asks for the folders; the app restarts and opens them as a normal start.
                return Ok(());
            }
            let backend =
                open_backend().unwrap_or_else(|refusal| startup::fail(refusal, &data_dir()));
            backend.set_event_sink(events::sink(app.handle().clone()));
            backend.set_location_pointer(location_pointer());
            tauri::async_runtime::spawn(backend.clone().run_worker());
            // Download (first run) and start the local ComfyUI right away.
            let engine = backend.clone();
            tauri::async_runtime::spawn(async move { engine.prepare_engine().await });
            // The export watermark's files: next to the app, or downloaded into the data folder.
            let watermark = backend.clone();
            tauri::async_runtime::spawn(async move { watermark.prepare_watermark().await });
            // Models that have no picture ask Civitai for theirs, by the hash of the file; then the licenses. Only when
            // the user turned `civitaiLookup` on, since the hashes go to Civitai.
            if backend.civitai_lookup_at_start() {
                let lookups = backend.clone();
                tauri::async_runtime::spawn(async move {
                    lookups.clone().fill_model_covers().await;
                    lookups.fill_model_licenses().await;
                });
            }
            #[cfg(windows)]
            fit_window_icon(app);
            app.manage(backend);
            Ok(())
        })
        .register_asynchronous_uri_scheme_protocol(
            image_scheme::SCHEME,
            |ctx, request, responder| {
                // Before the first start is over there is no backend, and no picture to serve.
                let Some(backend) = ctx.app_handle().try_state::<Backend>() else {
                    responder.respond(
                        tauri::http::Response::builder()
                            .status(404)
                            .body(Vec::new())
                            .expect("static headers are valid"),
                    );
                    return;
                };
                let backend = backend.inner().clone();
                let path = request.uri().path().to_string();
                let range = request
                    .headers()
                    .get("range")
                    .and_then(|v| v.to_str().ok())
                    .map(str::to_string);
                tauri::async_runtime::spawn_blocking(move || {
                    let served = image_scheme::serve(&backend, &path, range.as_deref());
                    let mut response = tauri::http::Response::builder()
                        .status(served.status)
                        .header("Content-Type", served.content_type)
                        .header("Accept-Ranges", "bytes")
                        .header("Access-Control-Allow-Origin", "*")
                        .header("Cache-Control", "max-age=31536000, immutable");
                    if let Some(range) = &served.content_range {
                        response = response.header("Content-Range", range.as_str());
                    }
                    let response = response
                        .body(served.body)
                        .expect("static headers are valid");
                    responder.respond(response);
                });
            },
        )
        .invoke_handler(tauri::generate_handler![
            commands::bootstrap,
            commands::create_board,
            commands::update_board,
            commands::delete_board,
            commands::upload_image,
            commands::update_images,
            commands::delete_images,
            commands::restore_images,
            commands::enqueue,
            commands::cancel_queue_item,
            commands::cancel_batch,
            commands::clear_queue,
            commands::prune_queue,
            commands::pause_processor,
            commands::resume_processor,
            commands::retry_queue_item,
            commands::queue_snapshot,
            commands::list_starter_models,
            commands::model_parts,
            commands::install_model,
            commands::cancel_install,
            commands::update_model,
            commands::delete_model,
            commands::scan_folder,
            commands::list_hugging_face_files,
            commands::search_civitai,
            commands::save_workflow,
            commands::delete_workflow,
            commands::list_comics,
            commands::save_comic,
            commands::delete_comic,
            commands::load_canvas,
            commands::save_canvas,
            commands::adopt_ui_state,
            commands::save_ui_state,
            commands::open_civitai_page,
            commands::agent_status,
            commands::agent_login,
            commands::agent_endpoint_save,
            commands::agent_endpoint_models,
            commands::agent_endpoint_test,
            commands::agent_chat,
            commands::agent_tool_result,
            commands::agent_cancel,
            commands::lookup_reference,
            commands::has_hf_token,
            commands::set_hf_token,
            commands::open_huggingface_page,
            commands::set_ui_zoom,
            commands::open_source_page,
            commands::pack_status,
            commands::hardware_info,
            commands::list_fonts,
            commands::install_pack,
            commands::cancel_pack,
            commands::has_civitai_key,
            commands::set_civitai_key,
            commands::node_defs,
            commands::comfy_ui_locale,
            commands::node_packs,
            commands::install_node_pack,
            commands::node_pack_versions,
            commands::node_pack_info,
            commands::registry_nodes,
            commands::comfy_versions,
            commands::switch_comfy_version,
            commands::cancel_node_pack,
            commands::remove_node_pack,
            commands::restart_engine,
            commands::low_memory_mode,
            commands::set_low_memory_mode,
            commands::engine_settings,
            commands::set_engine_settings,
            commands::add_model_root,
            commands::remove_model_root,
            commands::choose_data_dir,
            commands::cancel_data_dir_change,
            commands::choose_comfyui_install_dir,
            commands::reset_comfyui_install_dir,
            commands::face_rig_library,
            commands::face_rig_preview,
            commands::export_images,
            commands::reveal_export_folder,
            commands::watermark_status,
            commands::prepare_watermark,
            commands::check_watermark_file,
            commands::check_watermark_image,
            commands::create_backup,
            commands::open_backup,
            commands::confirm_restore,
            commands::discard_restore,
            commands::take_restored_ui_state,
            commands::list_unfinished_downloads,
            commands::delete_unfinished_downloads,
            first_run::first_run_info,
            first_run::first_run_choose,
            first_run::first_run_reset,
            first_run::first_run_finish,
        ])
        .build(tauri::generate_context!())
        .expect("failed to start novira");
    app.run(|handle, event| {
        if let tauri::RunEvent::Exit = event {
            if let Some(backend) = handle.try_state::<Backend>() {
                backend.shutdown();
            }
            // A running job's guard is never dropped on exit, so free the GPU lock here.
            novira_core::gpu_lock::release_all();
        }
    });
}

#[cfg(test)]
mod tests {
    use super::{default_data_dir, DATA_DIR_NAME};
    use std::path::Path;

    #[test]
    fn a_release_build_keeps_its_data_in_the_user_folder() {
        let app = tempfile::tempdir().unwrap();
        let user = Path::new("C:/Users/someone");
        assert_eq!(
            default_data_dir(app.path(), Some(user), false),
            user.join(DATA_DIR_NAME)
        );
    }

    #[test]
    fn a_debug_build_keeps_its_data_beside_the_app() {
        let app = Path::new("C:/repo");
        let user = Path::new("C:/Users/someone");
        assert_eq!(
            default_data_dir(app, Some(user), true),
            app.join(DATA_DIR_NAME)
        );
    }

    #[test]
    fn a_copy_with_a_data_folder_beside_it_keeps_using_it() {
        let app = tempfile::tempdir().unwrap();
        std::fs::create_dir(app.path().join(DATA_DIR_NAME)).unwrap();
        let user = Path::new("C:/Users/someone");
        assert_eq!(
            default_data_dir(app.path(), Some(user), false),
            app.path().join(DATA_DIR_NAME)
        );
    }

    #[test]
    fn without_a_user_folder_the_data_stays_beside_the_app() {
        let app = Path::new("C:/app");
        assert_eq!(default_data_dir(app, None, false), app.join(DATA_DIR_NAME));
    }

    /// The About dialog and the Settings screen show the frontend's `package.json` version, which must equal the
    /// version every crate inherits from `[workspace.package]`.
    #[test]
    fn the_frontend_package_has_the_app_version() {
        let package: serde_json::Value =
            serde_json::from_str(include_str!("../../../frontend/package.json")).unwrap();
        assert_eq!(package["version"], env!("CARGO_PKG_VERSION"));
    }
}
