//! The very first start: nothing says where the data goes yet, so the shell asks before it opens anything. The answer is
//! the data folder (a pointer file, `data_location`) and, optionally, the folder novira's own ComfyUI is installed in
//! (a setting of the data folder). A start with `NOVIRA_DATA_DIR`, or one that finds data already (beside the app, or in
//! the user's folder where earlier versions kept it), is not a first start.
use crate::data_location::{self, Location};
use crate::settings::{self, Settings};
use std::path::{Path, PathBuf};

/// The answer of the first-start screen.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Choice {
    pub data_dir: PathBuf,
    /// `None`: `comfyui` inside the data folder.
    pub comfyui_dir: Option<PathBuf>,
}

/// Whether this is a first start: no pointer, and none of the folders data could already be in exists.
pub fn needed(pointer: &Path, existing: &[&Path]) -> bool {
    !pointer.exists() && existing.iter().all(|p| !p.exists())
}

/// Checks the choice the way the Settings screen checks the same folders.
pub fn check(choice: &Choice) -> Result<(), String> {
    data_location::check_folder(&choice.data_dir)?;
    if let Some(comfyui) = &choice.comfyui_dir {
        settings::check_install_dir(comfyui, &choice.data_dir)?;
    }
    Ok(())
}

/// Makes the choice real: the data folder, its ComfyUI setting, and last the pointer, so a failure leaves the next start
/// a first start again.
pub fn apply(pointer: &Path, choice: &Choice) -> Result<(), String> {
    check(choice)?;
    std::fs::create_dir_all(&choice.data_dir)
        .map_err(|e| format!("cannot create {}: {e}", choice.data_dir.display()))?;
    if let Some(comfyui) = &choice.comfyui_dir {
        Settings::save_key(
            &choice.data_dir,
            "comfyuiInstallDir",
            serde_json::Value::String(comfyui.to_string_lossy().into_owned()),
        )?;
    }
    data_location::write(
        pointer,
        &Location {
            data_dir: choice.data_dir.clone(),
            ..Default::default()
        },
    )
}

#[cfg(test)]
mod tests;
