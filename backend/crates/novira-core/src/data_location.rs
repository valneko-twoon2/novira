//! Where the data folder is, chosen in the Settings screen. The choice cannot live in the data folder it names, so it is a
//! small file in the user's own configuration folder (the pointer). The shell reads it at start, after `NOVIRA_DATA_DIR`
//! and before the default; a change applies at the next start, and a move of the existing data is done then, before the
//! folder is locked or opened.
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const POINTER_FILE: &str = "data-location.json";
/// A debug build keeps its own pointer, so trying a folder in `tauri dev` never moves the installed app's data.
const DEV_POINTER_FILE: &str = "data-location-dev.json";
const LOCK_FILE: &str = crate::startup::LOCK_FILE_NAME;

/// What the pointer holds.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Location {
    /// The data folder to open.
    pub data_dir: PathBuf,
    /// The folder whose contents are to be moved into `data_dir` at the next start.
    pub move_from: Option<PathBuf>,
    /// Why the last requested move did not happen (shown in the Settings screen until the next change).
    pub move_error: Option<String>,
}

/// The pointer file in the user's configuration folder (`%LOCALAPPDATA%\novira`, else `$XDG_CONFIG_HOME` or `~/.config`);
/// `dev` names the one a debug build uses.
pub fn pointer_path(dev: bool) -> Option<PathBuf> {
    let base = std::env::var_os("LOCALAPPDATA")
        .or_else(|| std::env::var_os("XDG_CONFIG_HOME"))
        .filter(|p| !p.is_empty())
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var_os("HOME")
                .filter(|p| !p.is_empty())
                .map(|h| PathBuf::from(h).join(".config"))
        })?;
    let file = if dev { DEV_POINTER_FILE } else { POINTER_FILE };
    Some(base.join("novira").join(file))
}

/// The pointer's content; `None` when there is no pointer, it is unreadable or it names no folder.
pub fn read(pointer: &Path) -> Option<Location> {
    let text = std::fs::read_to_string(pointer).ok()?;
    let location: Location = serde_json::from_str(&text).ok()?;
    (location.data_dir.is_absolute()).then_some(location)
}

/// Writes the pointer through a temporary name, so a crash never leaves half of it.
pub fn write(pointer: &Path, location: &Location) -> Result<(), String> {
    if let Some(parent) = pointer.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("cannot create {}: {e}", parent.display()))?;
    }
    let text = serde_json::to_string_pretty(location).map_err(|e| e.to_string())?;
    let temp = pointer.with_extension("json.tmp");
    std::fs::write(&temp, text).map_err(|e| format!("cannot write {}: {e}", temp.display()))?;
    std::fs::rename(&temp, pointer).map_err(|e| format!("cannot write {}: {e}", pointer.display()))
}

/// Removes the pointer, so the default location applies again.
pub fn clear(pointer: &Path) -> Result<(), String> {
    match std::fs::remove_file(pointer) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("cannot remove {}: {e}", pointer.display())),
    }
}

fn same(a: &Path, b: &Path) -> bool {
    let key = |p: &Path| {
        std::fs::canonicalize(p)
            .map(crate::plain_path)
            .unwrap_or_else(|_| p.to_path_buf())
            .to_string_lossy()
            .to_lowercase()
    };
    key(a) == key(b)
}

fn inside(child: &Path, parent: &Path) -> bool {
    let key = |p: &Path| {
        std::fs::canonicalize(p)
            .map(crate::plain_path)
            .unwrap_or_else(|_| p.to_path_buf())
    };
    let (child, parent) = (key(child), key(parent));
    child != parent && child.starts_with(&parent)
}

/// Checks a folder chosen for the data when there is no data folder yet (the first start): a plain full path to a new
/// folder, an empty one, or one that already holds data (opened as it is).
pub fn check_folder(new: &Path) -> Result<(), String> {
    let text = new.to_string_lossy();
    if text.is_empty() || text.chars().any(char::is_control) {
        return Err("Not a folder path".into());
    }
    if !new.is_absolute() {
        return Err("The data folder must be a full path".into());
    }
    let device = |c: std::path::Component| {
        matches!(
            c,
            std::path::Component::Prefix(p) if matches!(p.kind(), std::path::Prefix::DeviceNS(_))
        )
    };
    if new
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir) || device(c))
    {
        return Err("Not a plain folder path".into());
    }
    if new.parent().is_none() {
        return Err("A drive root cannot be the data folder; make a folder in it".into());
    }
    if new.exists() && !new.is_dir() {
        return Err("The chosen path is not a folder".into());
    }
    Ok(())
}

/// Checks a folder chosen for the data. With `move_data`, the folder must be empty (or new): the data is moved into it.
/// Without, it is opened as it is (an empty folder starts a new library; one that holds data is the library to open).
pub fn check_new(new: &Path, current: &Path, move_data: bool) -> Result<(), String> {
    check_folder(new)?;
    if same(new, current) {
        return Err("This is already the data folder".into());
    }
    if inside(new, current) || inside(current, new) {
        return Err("The new data folder and the current one cannot be inside each other".into());
    }
    if move_data && new.is_dir() {
        let empty = std::fs::read_dir(new)
            .map_err(|e| format!("cannot read {}: {e}", new.display()))?
            .next()
            .is_none();
        if !empty {
            return Err("To move the data, choose an empty folder".into());
        }
    }
    Ok(())
}

/// Carries out a move the pointer asks for, before anything is opened. A move that cannot be done leaves the old folder
/// in use and records why. Returns the folder to open.
pub fn apply_pending(pointer: &Path) -> Option<PathBuf> {
    let mut location = read(pointer)?;
    let Some(from) = location.move_from.take() else {
        return Some(location.data_dir);
    };
    let to = location.data_dir.clone();
    match move_data(&from, &to) {
        Ok(()) => {
            location.move_error = None;
            let _ = write(pointer, &location);
            Some(to)
        }
        Err(e) => {
            crate::applog::warn("data-location", format!("the data was not moved: {e}"));
            let back = Location {
                data_dir: from.clone(),
                move_from: None,
                move_error: Some(e),
            };
            let _ = write(pointer, &back);
            Some(from)
        }
    }
}

/// Moves everything in `from` into `to`: a rename when it can be, else a copy followed by removing the old files. The
/// folder `from` must not be in use (nothing holds its lock), and `to` must be empty or missing.
fn move_data(from: &Path, to: &Path) -> Result<(), String> {
    if !from.is_dir() {
        return Err(format!("{} does not exist", from.display()));
    }
    let _lock = match crate::startup::try_claim(&from.join(LOCK_FILE)) {
        Ok(Some(lock)) => lock,
        Ok(None) => return Err("another novira is using the current data folder".into()),
        Err(e) => return Err(format!("cannot lock the current data folder: {e}")),
    };
    if to.is_dir() {
        let empty = std::fs::read_dir(to)
            .map_err(|e| e.to_string())?
            .next()
            .is_none();
        if !empty {
            return Err(format!("{} is not empty", to.display()));
        }
    }
    if let Some(parent) = to.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    // Folders cannot be renamed over a folder that exists, even an empty one, on every system.
    let existed = to.is_dir();
    if existed {
        std::fs::remove_dir(to).map_err(|e| e.to_string())?;
    }
    drop(_lock);
    if std::fs::rename(from, to).is_ok() {
        return Ok(());
    }
    if let Err(e) = copy_tree(from, to) {
        let _ = std::fs::remove_dir_all(to);
        if existed {
            let _ = std::fs::create_dir_all(to);
        }
        return Err(format!("copying failed: {e}"));
    }
    // The copy is whole: the old files are not needed. Leftovers (a file in use) are not an error.
    if let Err(e) = std::fs::remove_dir_all(from) {
        crate::applog::warn(
            "data-location",
            format!("the old folder was not fully removed: {e}"),
        );
    }
    Ok(())
}

fn copy_tree(from: &Path, to: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(to)?;
    for entry in std::fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        let kind = entry.file_type()?;
        if kind.is_dir() {
            copy_tree(&entry.path(), &target)?;
        } else if kind.is_file() {
            std::fs::copy(entry.path(), &target)?;
        }
        // A link is not followed or copied: ComfyUI's install and the models do not use them.
    }
    Ok(())
}

#[cfg(test)]
mod tests;
