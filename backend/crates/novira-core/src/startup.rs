//! Opening the data folder for a process that owns it (the desktop shell, the browser server): one process per folder,
//! enforced by a lock file, then the log file, the settings and the backend. Shared so both shells refuse a second copy the
//! same way: two copies would open one database and start a ComfyUI each.
use crate::{Backend, BackendConfig, Settings};
use std::fs::{File, OpenOptions, TryLockError};
use std::path::Path;
use std::sync::OnceLock;

/// The lock file in the data folder. The OS releases it when the process ends, even after a crash.
pub const LOCK_FILE_NAME: &str = "novira.lock";

/// The lock stays open for the whole run, so no other copy can take it.
static HELD: OnceLock<File> = OnceLock::new();

/// Why the data folder cannot be opened.
#[derive(Debug)]
pub enum Refusal {
    /// Another process holds the data folder.
    AlreadyRunning,
    /// Anything else (the folder cannot be created, the settings or the database are broken).
    Error(String),
}

/// Takes the lock on `path`. `Ok(None)` means another process holds it.
pub fn try_claim(path: &Path) -> std::io::Result<Option<File>> {
    let file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(path)?;
    match file.try_lock() {
        Ok(()) => Ok(Some(file)),
        Err(TryLockError::WouldBlock) => Ok(None),
        Err(TryLockError::Error(e)) => Err(e),
    }
}

/// Keeps the data folder's lock until the process ends.
pub fn hold(lock: File) {
    let _ = HELD.set(lock);
}

/// Locks `data_dir` (created when missing), points the log at it and opens the backend there. The lock is taken before
/// anything else touches the folder, so a second process never opens the database or starts ComfyUI.
pub fn open_backend(data_dir: &Path, image_url_base: String) -> Result<Backend, Refusal> {
    std::fs::create_dir_all(data_dir)
        .map_err(|e| Refusal::Error(format!("cannot create {}: {e}", data_dir.display())))?;
    match try_claim(&data_dir.join(LOCK_FILE_NAME)) {
        Ok(Some(lock)) => hold(lock),
        Ok(None) => return Err(Refusal::AlreadyRunning),
        Err(e) => return Err(Refusal::Error(format!("cannot lock the data folder: {e}"))),
    }
    crate::applog::set_file(data_dir.join("logs").join("novira.log"));
    let settings = Settings::load(data_dir).map_err(Refusal::Error)?;
    Backend::open(BackendConfig {
        data_dir: data_dir.to_path_buf(),
        image_url_base,
        settings,
    })
    .map_err(|e| Refusal::Error(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::{open_backend, try_claim, Refusal, LOCK_FILE_NAME};

    #[test]
    fn a_second_claim_on_the_same_folder_waits_for_the_first_to_end() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(LOCK_FILE_NAME);
        let first = try_claim(&path).unwrap().expect("the first claim succeeds");
        assert!(try_claim(&path).unwrap().is_none());
        drop(first);
        assert!(try_claim(&path).unwrap().is_some());
    }

    #[test]
    fn a_folder_held_by_another_claim_is_refused_before_anything_is_opened() {
        let dir = tempfile::tempdir().unwrap();
        let _held = try_claim(&dir.path().join(LOCK_FILE_NAME))
            .unwrap()
            .unwrap();
        match open_backend(dir.path(), "/novira-image".into()) {
            Err(Refusal::AlreadyRunning) => {}
            other => panic!("expected AlreadyRunning, got {:?}", other.map(|_| ())),
        }
        // The refusal came first: no database was created.
        assert!(!dir.path().join("novira.sqlite").exists());
    }
}
