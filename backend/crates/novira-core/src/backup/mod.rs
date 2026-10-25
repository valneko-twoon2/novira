//! Backups of the user's own data, and restoring one.
//!
//! A backup is a zip with a manifest, a consistent copy of the database (`VACUUM INTO`), the gallery files
//! (`outputs/`) with their thumbnails (`thumbnails/`), and `ui-state.json` (the frontend's saved state: characters,
//! presets, prompt book, drafts, settings, ...). Models, ComfyUI, caches, logs, `settings.json`, `agent.json` and
//! `secrets/` are left out: they are large, machine-specific, or (the keys) encrypted for this Windows user only.
//!
//! Restoring is done in two steps. While the app runs, the zip is checked entry by entry and unpacked into
//! `restore-staging/` inside the data folder. When the user confirms, a marker is written and the app restarts; the
//! next start moves the current data aside (`backup-before-restore-<date>/`), moves the staged data in, opens the
//! database to prove it works, and only then deletes the old data. Any failure moves the old data back.
pub mod archive;
pub mod restore;

use crate::media::images;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// The `format` of every novira backup manifest.
pub const FORMAT: &str = "novira-backup";
/// Layout version of the zip. A backup with another version is refused.
pub const VERSION: u32 = 1;
pub const MANIFEST: &str = "manifest.json";
pub const DATABASE: &str = "novira.sqlite";
pub const UI_STATE: &str = "ui-state.json";
pub const OUTPUTS: &str = "outputs";
pub const THUMBNAILS: &str = "thumbnails";
/// Keys of the frontend's saved state all start with this.
pub const UI_STATE_PREFIX: &str = "novira.";
/// Most bytes of `ui-state.json` (browser storage holds a few megabytes; this leaves room).
pub const MAX_UI_STATE_BYTES: usize = 64 * 1024 * 1024;

/// What a backup holds, as written in its manifest and shown before a restore.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    /// Version of the app that made it.
    pub app_version: String,
    /// Milliseconds since the Unix epoch.
    pub created_at: i64,
    pub images: u32,
    pub boards: u32,
    pub workflows: u32,
}

/// `manifest.json`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub format: String,
    pub version: u32,
    #[serde(flatten)]
    pub info: BackupInfo,
}

/// The reply of `create_backup`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupSummary {
    /// The zip's file name (no folder), for display.
    pub file_name: String,
    pub bytes: u64,
    pub info: BackupInfo,
}

/// Which long step a `backup` event reports.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BackupPhase {
    /// Writing a backup.
    Create,
    /// Checking and unpacking a backup before a restore.
    Restore,
}

/// Progress of a backup or of unpacking one, in files.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupProgress {
    pub phase: BackupPhase,
    pub done: u32,
    pub total: u32,
}

/// What the frontend learns once after a start: whether a restore was applied (with the saved UI state to put back)
/// or failed (and the old data was kept).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum RestoreOutcome {
    None,
    Restored {
        /// `ui-state.json` of the backup: a JSON object of browser storage keys to their values.
        #[serde(rename = "uiState")]
        ui_state: String,
    },
    Failed {
        message: String,
    },
}

/// Checks the frontend's saved state: a JSON object of strings whose keys all start with `novira.`.
pub fn check_ui_state(text: &str) -> Result<(), String> {
    if text.len() > MAX_UI_STATE_BYTES {
        return Err("the saved screen state is too large".into());
    }
    let map: BTreeMap<String, String> = serde_json::from_str(text)
        .map_err(|e| format!("the saved screen state is not readable: {e}"))?;
    if let Some(bad) = map.keys().find(|k| !k.starts_with(UI_STATE_PREFIX)) {
        return Err(format!("unexpected key in the saved screen state: {bad}"));
    }
    Ok(())
}

/// One file of a backup zip, from its entry name.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Entry {
    Manifest,
    Database,
    UiState,
    /// A gallery file (`outputs/<name>`).
    Original(String),
    /// A thumbnail (`thumbnails/<stem>.thumb`).
    Thumbnail(String),
    /// The `outputs/` or `thumbnails/` folder entry itself.
    Folder,
}

/// Reads an entry name. Only the exact names a backup is made of are accepted, so absolute paths, `..`, drive letters,
/// backslashes and any other file are refused before anything is written (zip-slip).
pub fn classify(name: &str) -> Option<Entry> {
    match name {
        MANIFEST => return Some(Entry::Manifest),
        DATABASE => return Some(Entry::Database),
        UI_STATE => return Some(Entry::UiState),
        "outputs/" | "thumbnails/" => return Some(Entry::Folder),
        _ => {}
    }
    let (folder, file) = name.split_once('/')?;
    match folder {
        OUTPUTS if images::is_valid_name(file) => Some(Entry::Original(file.to_string())),
        THUMBNAILS => {
            let stem = file.strip_suffix(".thumb")?;
            images::is_valid_name(&format!("{stem}.png"))
                .then(|| Entry::Thumbnail(file.to_string()))
        }
        _ => None,
    }
}

/// The local time as `YYYYMMDD-HHMM`, for file names.
pub fn stamp() -> String {
    chrono::Local::now().format("%Y%m%d-%H%M").to_string()
}

/// The default file name of a new backup.
pub fn default_file_name() -> String {
    format!("novira-backup-{}.zip", stamp())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_files_of_a_backup_are_accepted() {
        let name = images::new_name();
        let stem = name.trim_end_matches(".png");
        assert_eq!(classify("manifest.json"), Some(Entry::Manifest));
        assert_eq!(classify("novira.sqlite"), Some(Entry::Database));
        assert_eq!(classify("ui-state.json"), Some(Entry::UiState));
        assert_eq!(
            classify(&format!("outputs/{name}")),
            Some(Entry::Original(name.clone()))
        );
        assert_eq!(
            classify(&format!("thumbnails/{stem}.thumb")),
            Some(Entry::Thumbnail(format!("{stem}.thumb")))
        );
        for bad in [
            "../novira.sqlite",
            "/novira.sqlite",
            "C:/Windows/evil.png",
            "C:\\evil.png",
            "outputs/../../evil.png",
            "outputs\\..\\evil.png",
            "outputs/../novira.sqlite",
            "outputs/a/b.png",
            "outputs/evil.exe",
            "thumbnails/../x.thumb",
            "secrets/civitai.key",
            "models/x.safetensors",
            "settings.json",
            "",
        ] {
            assert_eq!(classify(bad), None, "{bad}");
        }
    }

    #[test]
    fn the_ui_state_must_be_novira_keys_with_text_values() {
        assert!(check_ui_state(r#"{"novira.settings":"{\"a\":1}"}"#).is_ok());
        assert!(check_ui_state("{}").is_ok());
        assert!(check_ui_state(r#"{"other":"x"}"#).is_err());
        assert!(check_ui_state(r#"{"novira.x":1}"#).is_err());
        assert!(check_ui_state("[]").is_err());
        assert!(check_ui_state("not json").is_err());
    }

    #[test]
    fn the_default_name_carries_the_date_and_time() {
        let name = default_file_name();
        assert!(name.starts_with("novira-backup-") && name.ends_with(".zip"));
        assert_eq!(name.len(), "novira-backup-YYYYMMDD-HHMM.zip".len());
    }
}
