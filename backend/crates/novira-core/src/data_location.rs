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

/// Checks a folder chosen for the data. With `move_data`, nothing in the folder may have the name of something in the
/// current data (it may hold other things, such as an install of ComfyUI): the data is moved in beside them. Without, it
/// is opened as it is (an empty folder starts a new library; one that holds data is the library to open).
pub fn check_new(new: &Path, current: &Path, move_data: bool) -> Result<(), String> {
    check_folder(new)?;
    if same(new, current) {
        return Err("This is already the data folder".into());
    }
    if inside(new, current) || inside(current, new) {
        return Err("The new data folder and the current one cannot be inside each other".into());
    }
    if move_data {
        clash(current, new)?;
    }
    Ok(())
}

/// The name of an entry `from` has that `to` has too (compared without case, as Windows does); a move would put one over
/// the other, so it is refused.
fn clash(from: &Path, to: &Path) -> Result<(), String> {
    if !to.is_dir() {
        return Ok(());
    }
    let names = |dir: &Path| -> Result<Vec<String>, String> {
        Ok(std::fs::read_dir(dir)
            .map_err(|e| format!("cannot read {}: {e}", dir.display()))?
            .filter_map(Result::ok)
            .map(|e| e.file_name().to_string_lossy().to_lowercase())
            .collect())
    };
    let there = names(to)?;
    let Ok(ours) = names(from) else {
        return Ok(());
    };
    match ours.iter().find(|n| there.contains(n)) {
        Some(name) => Err(format!(
            "{} already holds {name}; choose a folder without it",
            to.display()
        )),
        None => Ok(()),
    }
}

/// Whether the pointer asks for the data to be moved at this start (so the app can show that it is working).
pub fn move_pending(pointer: &Path) -> bool {
    read(pointer).is_some_and(|l| l.move_from.is_some())
}

/// Carries out a move the pointer asks for, before anything is opened. A move that cannot be done leaves the old folder
/// in use and records why. Returns the folder to open.
pub fn apply_pending(pointer: &Path) -> Option<PathBuf> {
    apply_pending_with(pointer, &|_, _| {})
}

/// `apply_pending`, telling `progress` the bytes copied so far and the bytes to copy while the data is copied to another
/// drive (a rename on the same drive is at once and reports nothing).
pub fn apply_pending_with(pointer: &Path, progress: &dyn Fn(u64, u64)) -> Option<PathBuf> {
    let mut location = read(pointer)?;
    let Some(from) = location.move_from.take() else {
        // The marker of a move whose last step (removing the old folder) was cut off.
        let _ = std::fs::remove_file(location.data_dir.join(MOVE_MARKER));
        return Some(location.data_dir);
    };
    let to = location.data_dir.clone();
    match move_data(&from, &to, &mut Progress::new(&from, progress)) {
        Ok(()) => {
            location.move_error = None;
            // The pointer names the new folder before the old files go: a start cut off from here on opens the new
            // folder. When it cannot be written, the next start finds the move's marker and finishes the move again.
            if write(pointer, &location).is_ok() {
                finish_move(&from, &to);
            }
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

/// Written into the new folder before anything moves into it, and removed once the pointer names that folder. A start
/// that finds it continues the move it records instead of refusing the names the cut-off start had already moved.
pub const MOVE_MARKER: &str = ".novira-moving";

/// What a move records in its marker.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MoveRecord {
    /// The move made the new folder (it did not exist), so a failed move removes it again.
    made: bool,
    /// The names in the old folder when the move began: the names that are moved.
    entries: Vec<String>,
}

fn remove_any(path: &Path) -> std::io::Result<()> {
    if path.is_dir() {
        std::fs::remove_dir_all(path)
    } else {
        std::fs::remove_file(path)
    }
}

/// Moves everything in `from` into `to`: a rename of the whole folder when `to` does not exist and it can be, else each
/// entry in turn, renamed when it can be and copied when not. The old files stay until `finish_move`. The folder `from`
/// must not be in use (nothing holds its lock), and nothing in `to` may share a name with what `from` holds (`to` may
/// hold other things: they stay). A marker in `to` lets a start that was cut off continue; a failed move puts back what
/// it had moved, removes what it had copied, and removes `to` when it made it.
fn move_data(from: &Path, to: &Path, progress: &mut Progress) -> Result<(), String> {
    move_entries(from, to, progress, usize::MAX)
}

/// `move_data`, stopping after `limit` entries as a start cut off there would (tests).
fn move_entries(
    from: &Path,
    to: &Path,
    progress: &mut Progress,
    limit: usize,
) -> Result<(), String> {
    if !from.is_dir() {
        // The old folder goes only after the pointer names the new one, or in one rename into a new folder: a start
        // cut off before the pointer was written finds the data already there.
        if to.is_dir() {
            return Ok(());
        }
        return Err(format!("{} does not exist", from.display()));
    }
    // Held while the names are read, released before anything moves (the lock file is one of the entries).
    let lock = match crate::startup::try_claim(&from.join(LOCK_FILE)) {
        Ok(Some(lock)) => lock,
        Ok(None) => return Err("another novira is using the current data folder".into()),
        Err(e) => return Err(format!("cannot lock the current data folder: {e}")),
    };
    let marker = to.join(MOVE_MARKER);
    let record = match std::fs::read_to_string(&marker) {
        Ok(text) => {
            drop(lock);
            serde_json::from_str::<MoveRecord>(&text)
                .map_err(|e| format!("the record of the earlier move is damaged: {e}"))?
        }
        Err(_) => {
            clash(from, to)?;
            if let Some(parent) = to.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let made = !to.exists();
            let entries = std::fs::read_dir(from)
                .map_err(|e| e.to_string())?
                .filter_map(Result::ok)
                .map(|e| e.file_name().to_string_lossy().into_owned())
                .filter(|n| n != MOVE_MARKER)
                .collect();
            drop(lock);
            if made {
                if std::fs::rename(from, to).is_ok() {
                    return Ok(());
                }
                std::fs::create_dir(to).map_err(|e| e.to_string())?;
            }
            let record = MoveRecord { made, entries };
            let text = serde_json::to_string(&record).map_err(|e| e.to_string())?;
            if let Err(e) = std::fs::write(&marker, text) {
                if made {
                    let _ = std::fs::remove_dir(to);
                }
                return Err(format!("cannot write into {}: {e}", to.display()));
            }
            record
        }
    };
    for name in record.entries.iter().take(limit) {
        let (source, target) = (from.join(name), to.join(name));
        if !source.exists() {
            // Renamed by a start that was cut off.
            continue;
        }
        // Both folders hold the name only when a cut-off start was copying it: they shared no name when the move
        // began. The half copy goes.
        if target.exists() {
            if let Err(e) = remove_any(&target) {
                return Err(undo(from, to, &record, format!("copying failed: {e}")));
            }
        }
        if std::fs::rename(&source, &target).is_ok() {
            continue;
        }
        let done = match std::fs::symlink_metadata(&source) {
            Ok(meta) if meta.is_dir() => copy_tree(&source, &target, progress),
            Ok(meta) if meta.is_file() => copy_file(&source, &target, progress),
            Ok(_) => Ok(()),
            Err(e) => Err(e),
        };
        if let Err(e) = done {
            return Err(undo(from, to, &record, format!("copying failed: {e}")));
        }
    }
    Ok(())
}

/// Puts back what a move had renamed (in this start or a cut-off one), removes what it had copied, and removes the
/// marker, and `to` when the move made it. Returns `message`.
fn undo(from: &Path, to: &Path, record: &MoveRecord, message: String) -> String {
    for name in &record.entries {
        let (source, target) = (from.join(name), to.join(name));
        if !target.exists() {
            continue;
        }
        let _ = if source.exists() {
            remove_any(&target)
        } else {
            std::fs::rename(&target, &source)
        };
    }
    let _ = std::fs::remove_file(to.join(MOVE_MARKER));
    if record.made {
        let _ = std::fs::remove_dir(to);
    }
    message
}

/// After the pointer names the new folder: removes the old one (what the move left in it) and the marker. Leftovers (a
/// file in use) are not an error.
fn finish_move(from: &Path, to: &Path) {
    if from.exists() {
        if let Err(e) = std::fs::remove_dir_all(from) {
            crate::applog::warn(
                "data-location",
                format!("the old folder was not fully removed: {e}"),
            );
        }
    }
    let _ = std::fs::remove_file(to.join(MOVE_MARKER));
}

/// The bytes copied so far, against the size of the whole data (measured when the first copy starts).
struct Progress<'a> {
    from: PathBuf,
    done: u64,
    total: Option<u64>,
    report: &'a dyn Fn(u64, u64),
}

impl<'a> Progress<'a> {
    fn new(from: &Path, report: &'a dyn Fn(u64, u64)) -> Self {
        Self {
            from: from.to_path_buf(),
            done: 0,
            total: None,
            report,
        }
    }

    fn add(&mut self, bytes: u64) {
        let from = &self.from;
        let total = *self.total.get_or_insert_with(|| size_of(from));
        self.done += bytes;
        (self.report)(self.done.min(total), total);
    }
}

/// The bytes of the files under `dir` (links not followed).
fn size_of(dir: &Path) -> u64 {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return 0;
    };
    entries
        .filter_map(Result::ok)
        .map(|e| match e.file_type() {
            Ok(k) if k.is_dir() => size_of(&e.path()),
            Ok(k) if k.is_file() => e.metadata().map(|m| m.len()).unwrap_or(0),
            _ => 0,
        })
        .sum()
}

/// Copies one file in pieces, so a model of several gigabytes moves the progress as it goes.
fn copy_file(from: &Path, to: &Path, progress: &mut Progress) -> std::io::Result<()> {
    use std::io::{Read, Write};
    const PIECE: usize = 8 * 1024 * 1024;
    let mut source = std::fs::File::open(from)?;
    let mut target = std::fs::File::create(to)?;
    let mut buf = vec![0u8; PIECE];
    progress.add(0);
    loop {
        let n = source.read(&mut buf)?;
        if n == 0 {
            break;
        }
        target.write_all(&buf[..n])?;
        progress.add(n as u64);
    }
    target.sync_all()
}

fn copy_tree(from: &Path, to: &Path, progress: &mut Progress) -> std::io::Result<()> {
    std::fs::create_dir_all(to)?;
    for entry in std::fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        let kind = entry.file_type()?;
        if kind.is_dir() {
            copy_tree(&entry.path(), &target, progress)?;
        } else if kind.is_file() {
            copy_file(&entry.path(), &target, progress)?;
        }
        // A link is not followed or copied: ComfyUI's install and the models do not use them.
    }
    Ok(())
}

#[cfg(test)]
mod tests;

#[cfg(test)]
mod crash_tests;
