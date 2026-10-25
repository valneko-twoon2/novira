//! Restoring a backup: checked and unpacked into `restore-staging/` while the app runs, applied at the next start
//! before the database is opened, rolled back when anything fails.
use super::{
    check_ui_state, classify, BackupInfo, Entry, Manifest, RestoreOutcome, DATABASE, FORMAT,
    MANIFEST, OUTPUTS, THUMBNAILS, UI_STATE, VERSION,
};
use crate::db::{Db, Table};
use std::collections::HashSet;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// Folder inside the data folder that holds an unpacked backup until it is applied.
pub const STAGING: &str = "restore-staging";
/// Marker inside the staging folder: the user confirmed, apply at the next start.
const READY: &str = "READY";
/// What the last start did with a confirmed restore, read once by the frontend.
const RESULT: &str = "restore-result.json";
/// Prefix of the folder the current data is moved into while a restore is applied.
pub const OLD_PREFIX: &str = "backup-before-restore-";

/// Most bytes one entry may unpack to (the zip's own sizes are not trusted).
const MAX_MANIFEST: u64 = 1024 * 1024;
const MAX_DATABASE: u64 = 16 * 1024 * 1024 * 1024;
const MAX_GALLERY_FILE: u64 = 8 * 1024 * 1024 * 1024;

/// What the start-up restore moves aside (the WAL files belong to the old database) and what it moves in.
const CURRENT: [&str; 5] = [
    DATABASE,
    "novira.sqlite-wal",
    "novira.sqlite-shm",
    OUTPUTS,
    THUMBNAILS,
];
const STAGED: [&str; 3] = [DATABASE, OUTPUTS, THUMBNAILS];

fn staging(data_dir: &Path) -> PathBuf {
    data_dir.join(STAGING)
}

/// Removes an unpacked backup that was not applied.
pub fn discard(data_dir: &Path) -> std::io::Result<()> {
    match std::fs::remove_dir_all(staging(data_dir)) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e),
        _ => Ok(()),
    }
}

/// Copies at most `limit` bytes of `from` into a new file; more is an error.
fn copy_limited(from: &mut impl Read, to: &Path, limit: u64) -> Result<(), String> {
    let mut out = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(to)
        .map_err(|e| format!("cannot unpack: {e}"))?;
    let written = std::io::copy(&mut from.take(limit + 1), &mut out)
        .map_err(|e| format!("the backup is damaged: {e}"))?;
    if written > limit {
        return Err("a file in the backup is too large".into());
    }
    Ok(())
}

fn read_manifest(archive: &mut zip::ZipArchive<File>) -> Result<Manifest, String> {
    let entry = archive
        .by_name(MANIFEST)
        .map_err(|_| "this is not a novira backup (no manifest)".to_string())?;
    let mut text = Vec::new();
    entry
        .take(MAX_MANIFEST)
        .read_to_end(&mut text)
        .map_err(|e| format!("the backup is damaged: {e}"))?;
    let manifest: Manifest =
        serde_json::from_slice(&text).map_err(|_| "this is not a novira backup".to_string())?;
    if manifest.format != FORMAT {
        return Err("this is not a novira backup".into());
    }
    if manifest.version > VERSION {
        return Err(format!(
            "this backup was made by a newer version of novira (format {})",
            manifest.version
        ));
    }
    if manifest.version != VERSION {
        return Err(format!(
            "this backup format ({}) is not supported",
            manifest.version
        ));
    }
    Ok(manifest)
}

/// Checks a backup zip and unpacks it into the staging folder (replacing an earlier one). Every entry name is checked
/// before anything is written; nothing outside the staging folder is touched. `progress` gets (done, total).
pub fn stage(
    zip_path: &Path,
    data_dir: &Path,
    mut progress: impl FnMut(u32, u32),
) -> Result<BackupInfo, String> {
    discard(data_dir).map_err(|e| format!("cannot clear the earlier restore: {e}"))?;
    let result = (|| {
        let file = File::open(zip_path).map_err(|e| format!("cannot open the backup: {e}"))?;
        let mut archive =
            zip::ZipArchive::new(file).map_err(|_| "this is not a novira backup".to_string())?;
        // First pass: names only.
        let mut entries = Vec::with_capacity(archive.len());
        let mut seen = HashSet::new();
        for i in 0..archive.len() {
            let entry = archive
                .by_index_raw(i)
                .map_err(|e| format!("the backup is damaged: {e}"))?;
            let name = entry.name().to_string();
            let kind = classify(&name)
                .filter(|_| entry.enclosed_name().is_some() && !entry.is_symlink())
                .ok_or_else(|| format!("unexpected file in the backup: {name}"))?;
            if !seen.insert(name.clone()) {
                return Err(format!("the backup lists {name} twice"));
            }
            entries.push((i, kind));
        }
        if !seen.contains(DATABASE) {
            return Err("the backup has no database".into());
        }
        let manifest = read_manifest(&mut archive)?;

        let root = staging(data_dir);
        std::fs::create_dir_all(root.join(OUTPUTS)).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(root.join(THUMBNAILS)).map_err(|e| e.to_string())?;
        let total = entries.len() as u32;
        for (done, (i, kind)) in entries.into_iter().enumerate() {
            let (target, limit) = match &kind {
                Entry::Manifest | Entry::Folder => {
                    progress(done as u32 + 1, total);
                    continue;
                }
                Entry::Database => (root.join(DATABASE), MAX_DATABASE),
                Entry::UiState => (root.join(UI_STATE), super::MAX_UI_STATE_BYTES as u64),
                Entry::Original(name) => (root.join(OUTPUTS).join(name), MAX_GALLERY_FILE),
                Entry::Thumbnail(name) => (root.join(THUMBNAILS).join(name), MAX_GALLERY_FILE),
            };
            let mut entry = archive
                .by_index(i)
                .map_err(|e| format!("the backup is damaged: {e}"))?;
            copy_limited(&mut entry, &target, limit)?;
            progress(done as u32 + 1, total);
        }
        match std::fs::read_to_string(root.join(UI_STATE)) {
            Ok(text) => check_ui_state(&text)?,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.to_string()),
        }
        check_database(&root)?;
        Ok(manifest.info)
    })();
    if result.is_err() {
        let _ = discard(data_dir);
    }
    result
}

/// Opens the database in `dir` and reads its tables: proof that it is a novira database, not just any file.
fn check_database(dir: &Path) -> Result<(), String> {
    let db = Db::open(dir).map_err(|e| format!("the backup's database cannot be read: {e}"))?;
    for table in [
        Table::Boards,
        Table::Images,
        Table::Workflows,
        Table::Comics,
    ] {
        db.load::<serde_json::Value>(table)
            .map_err(|e| format!("the backup's database cannot be read: {e}"))?;
    }
    Ok(())
}

/// Marks the unpacked backup to be applied at the next start.
pub fn mark_ready(data_dir: &Path) -> Result<(), String> {
    let root = staging(data_dir);
    if !root.join(DATABASE).is_file() {
        return Err("no backup is ready to restore".into());
    }
    std::fs::write(root.join(READY), b"").map_err(|e| e.to_string())
}

/// Renames, retrying for a while: the app that asked for the restart may still hold the old database open.
fn rename_when_free(from: &Path, to: &Path) -> std::io::Result<()> {
    let mut tries = 0;
    loop {
        match std::fs::rename(from, to) {
            Ok(()) => return Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound || tries >= 40 => return Err(e),
            Err(_) => {
                tries += 1;
                std::thread::sleep(crate::test_timing::retry_pause(Duration::from_millis(250)));
            }
        }
    }
}

fn remove_any(path: &Path) -> std::io::Result<()> {
    let result = if path.is_dir() {
        std::fs::remove_dir_all(path)
    } else {
        std::fs::remove_file(path)
    };
    match result {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e),
        _ => Ok(()),
    }
}

/// A free `backup-before-restore-<date>` folder name.
fn old_dir(data_dir: &Path) -> PathBuf {
    let base = format!(
        "{OLD_PREFIX}{}",
        chrono::Local::now().format("%Y%m%d-%H%M%S")
    );
    let mut dir = data_dir.join(&base);
    let mut n = 2;
    while dir.exists() {
        dir = data_dir.join(format!("{base}-{n}"));
        n += 1;
    }
    dir
}

/// Moves the current data into `old` and the staged data in, then opens the result. Records what moved so a failure
/// can be undone.
fn swap(
    data_dir: &Path,
    staged: &Path,
    old: &Path,
    moved_out: &mut Vec<&'static str>,
    moved_in: &mut Vec<&'static str>,
) -> Result<(), String> {
    std::fs::create_dir_all(old).map_err(|e| e.to_string())?;
    for item in CURRENT {
        let from = data_dir.join(item);
        if from.exists() {
            rename_when_free(&from, &old.join(item))
                .map_err(|e| format!("cannot move the current {item} aside: {e}"))?;
            moved_out.push(item);
        }
    }
    for item in STAGED {
        let from = staged.join(item);
        if from.exists() {
            rename_when_free(&from, &data_dir.join(item))
                .map_err(|e| format!("cannot move the restored {item} in: {e}"))?;
            moved_in.push(item);
        }
    }
    check_database(data_dir)
}

/// Puts the old data back after a failed swap.
fn roll_back(
    data_dir: &Path,
    old: &Path,
    moved_out: &[&'static str],
    moved_in: &[&'static str],
) -> std::io::Result<()> {
    for item in moved_in {
        remove_any(&data_dir.join(item))?;
    }
    // WAL files now in the data folder belong to the restored database (the old ones were moved aside).
    for item in ["novira.sqlite-wal", "novira.sqlite-shm"] {
        if !moved_in.contains(&item) {
            remove_any(&data_dir.join(item))?;
        }
    }
    for item in moved_out {
        rename_when_free(&old.join(item), &data_dir.join(item))?;
    }
    std::fs::remove_dir(old)
}

fn apply(data_dir: &Path) -> Result<String, String> {
    let staged = staging(data_dir);
    let ui_state = match std::fs::read_to_string(staged.join(UI_STATE)) {
        Ok(text) => text,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => "{}".into(),
        Err(e) => return Err(format!("cannot read the restored screen state: {e}")),
    };
    let old = old_dir(data_dir);
    let (mut moved_out, mut moved_in) = (Vec::new(), Vec::new());
    match swap(data_dir, &staged, &old, &mut moved_out, &mut moved_in) {
        Ok(()) => {
            if let Err(e) = std::fs::remove_dir_all(&old) {
                crate::applog::warn(
                    "restore",
                    format!("the previous data is still in {}: {e}", old.display()),
                );
            }
            Ok(ui_state)
        }
        Err(message) => match roll_back(data_dir, &old, &moved_out, &moved_in) {
            Ok(()) => Err(format!(
                "the backup could not be restored; your data was kept as it was ({message})"
            )),
            Err(e) => Err(format!(
                "the backup could not be restored ({message}) and putting the previous data back failed ({e}); it is in {}",
                old.display()
            )),
        },
    }
}

/// Applies a confirmed restore. Called at start-up before the database is opened. Does nothing without a confirmed
/// restore; an unpacked backup that was never confirmed is removed.
pub fn apply_pending(data_dir: &Path) {
    let staged = staging(data_dir);
    if !staged.join(READY).is_file() {
        if staged.exists() {
            let _ = discard(data_dir);
        }
        return;
    }
    let outcome = match apply(data_dir) {
        Ok(ui_state) => {
            crate::applog::info("restore", "the backup was restored");
            RestoreOutcome::Restored { ui_state }
        }
        Err(message) => {
            crate::applog::error("restore", message.clone());
            RestoreOutcome::Failed { message }
        }
    };
    if let Err(e) = discard(data_dir) {
        crate::applog::warn("restore", format!("cannot remove {STAGING}: {e}"));
    }
    let text = serde_json::to_string(&outcome).expect("the outcome serializes");
    if let Err(e) = std::fs::write(data_dir.join(RESULT), text) {
        crate::applog::warn("restore", format!("cannot record the outcome: {e}"));
    }
}

/// What the last start did with a restore, once: the record is removed when read.
pub fn take_outcome(data_dir: &Path) -> RestoreOutcome {
    let path = data_dir.join(RESULT);
    let Ok(text) = std::fs::read_to_string(&path) else {
        return RestoreOutcome::None;
    };
    let _ = std::fs::remove_file(&path);
    serde_json::from_str(&text).unwrap_or(RestoreOutcome::None)
}
