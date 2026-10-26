//! The first start: before anything is opened, the app asks where the data and novira's own ComfyUI go. Nothing of the
//! backend exists yet, so these commands take no `Backend`. The WebView never sends a path: the folders come from the
//! shell's own dialog and wait here until `first_run_finish` writes them and restarts the app. Every command refuses
//! once the first start is over, so the page cannot move the data folder through them later.
use crate::commands::guard;
use novira_core::api::Res;
use novira_core::first_run::{self, Choice};
use novira_core::sync::LockExt;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

/// The folders picked so far; a missing one is the default.
#[derive(Default)]
pub struct FirstRun {
    data: Mutex<Option<PathBuf>>,
    comfyui: Mutex<Option<PathBuf>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FirstRunInfo {
    pub needed: bool,
    pub data_dir: String,
    pub comfyui_dir: String,
    pub data_is_default: bool,
    pub comfyui_is_default: bool,
}

#[derive(Clone, Copy)]
enum Kind {
    Data,
    Comfyui,
}

fn kind_of(name: &str) -> Result<Kind, String> {
    match name {
        "data" => Ok(Kind::Data),
        "comfyui" => Ok(Kind::Comfyui),
        _ => Err("unknown folder kind".into()),
    }
}

fn ensure_first_start() -> Result<(), String> {
    if crate::first_run_needed() {
        Ok(())
    } else {
        Err("The folders can only be chosen at the first start".into())
    }
}

/// The folders the first start would use now.
fn effective(state: &FirstRun) -> (PathBuf, Option<PathBuf>) {
    let data = state
        .data
        .lock_safe()
        .clone()
        .unwrap_or_else(crate::default_data_dir_now);
    (data, state.comfyui.lock_safe().clone())
}

fn info(state: &FirstRun) -> FirstRunInfo {
    let (data, comfyui) = effective(state);
    FirstRunInfo {
        needed: crate::first_run_needed(),
        data_is_default: state.data.lock_safe().is_none(),
        comfyui_is_default: comfyui.is_none(),
        comfyui_dir: comfyui
            .unwrap_or_else(|| data.join("comfyui"))
            .to_string_lossy()
            .into_owned(),
        data_dir: data.to_string_lossy().into_owned(),
    }
}

/// Whether this is the first start, and the folders it would use.
#[tauri::command]
pub fn first_run_info(state: State<'_, FirstRun>) -> Res<FirstRunInfo> {
    guard(|| Ok(info(&state)))
}

/// Asks for a folder (`kind` is `data` or `comfyui`) and keeps it when it passes the checks of the Settings screen;
/// `null` when the user cancels the dialog.
#[tauri::command]
pub async fn first_run_choose(
    webview: tauri::Webview,
    state: State<'_, FirstRun>,
    kind: String,
) -> Res<Option<FirstRunInfo>> {
    let kind = kind_of(&kind)?;
    ensure_first_start()?;
    let Some(folder) = crate::dialogs::pick_folder(&webview).await else {
        return Ok(None);
    };
    let (mut data, mut comfyui) = effective(&state);
    match kind {
        Kind::Data => data = folder.clone(),
        Kind::Comfyui => comfyui = Some(folder.clone()),
    }
    first_run::check(&Choice {
        data_dir: data,
        comfyui_dir: comfyui,
    })?;
    match kind {
        Kind::Data => *state.data.lock_safe() = Some(folder),
        Kind::Comfyui => *state.comfyui.lock_safe() = Some(folder),
    }
    Ok(Some(info(&state)))
}

/// Goes back to the default folder of `kind`.
#[tauri::command]
pub fn first_run_reset(state: State<'_, FirstRun>, kind: String) -> Res<FirstRunInfo> {
    guard(|| {
        let kind = kind_of(&kind)?;
        ensure_first_start()?;
        match kind {
            Kind::Data => *state.data.lock_safe() = None,
            Kind::Comfyui => *state.comfyui.lock_safe() = None,
        }
        Ok(info(&state))
    })
}

/// Writes the choice and restarts the app, which then opens the chosen data folder as a normal start.
#[tauri::command]
pub fn first_run_finish(app: tauri::AppHandle, state: State<'_, FirstRun>) -> Res<()> {
    guard(|| {
        ensure_first_start()?;
        let pointer = crate::location_pointer().ok_or("There is nowhere to save the choice")?;
        let (data_dir, comfyui_dir) = effective(&state);
        first_run::apply(
            &pointer,
            &Choice {
                data_dir,
                comfyui_dir,
            },
        )
    })?;
    app.restart()
}
