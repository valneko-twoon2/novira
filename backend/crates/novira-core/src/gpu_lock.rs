//! The GPU lock for jobs that use the GPU: a directory created with `mkdir` and removed when done.
//! A lock that someone else made is respected: we wait and never remove it. A lock we made is recorded in a sibling
//! `<lock>.owner` file (process id and start time, so the lock folder stays empty and a plain `rmdir` still works), which
//! lets us tell when its owner is gone: a crash or a kill leaves no lock behind that blocks the next start for good.
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use tokio_util::sync::CancellationToken;

const POLL: Duration = Duration::from_millis(500);

/// Locks this process holds right now, so they can be released on exit even if their guards never drop.
static HELD: Mutex<Vec<PathBuf>> = Mutex::new(Vec::new());

#[derive(Debug)]
pub struct GpuLockGuard {
    path: PathBuf,
}

impl Drop for GpuLockGuard {
    fn drop(&mut self) {
        release(&self.path);
    }
}

fn owner_path(lock: &Path) -> PathBuf {
    let mut name = lock.as_os_str().to_owned();
    name.push(".owner");
    PathBuf::from(name)
}

fn release(lock: &Path) {
    let _ = std::fs::remove_dir(lock);
    let _ = std::fs::remove_file(owner_path(lock));
    if let Ok(mut held) = HELD.lock() {
        held.retain(|p| p != lock);
    }
}

/// Releases every lock this process holds. Called when the app exits, since tasks that hold a guard are not dropped then.
pub fn release_all() {
    release_where(|_| true);
}

fn release_where(pick: impl Fn(&Path) -> bool) {
    let taken: Vec<PathBuf> = match HELD.lock() {
        Ok(mut held) => {
            let (taken, kept) = std::mem::take(&mut *held)
                .into_iter()
                .partition(|p| pick(p));
            *held = kept;
            taken
        }
        Err(_) => return,
    };
    for path in taken {
        let _ = std::fs::remove_dir(&path);
        let _ = std::fs::remove_file(owner_path(&path));
    }
}

/// `<pid> <start time>` of this process.
fn owner_record() -> String {
    let pid = std::process::id();
    format!("{pid} {}", process_start(pid).unwrap_or(0))
}

/// Whether the process named in an owner record is gone. An unreadable record or an unknown state counts as alive.
fn owner_is_gone(record: &str) -> bool {
    let mut parts = record.split_whitespace();
    let (Some(pid), Some(start)) = (
        parts.next().and_then(|v| v.parse::<u32>().ok()),
        parts.next().and_then(|v| v.parse::<u64>().ok()),
    ) else {
        return false;
    };
    match process_state(pid) {
        ProcessState::Gone => true,
        // The id has been reused by another process.
        ProcessState::Running(started) => start != 0 && started != 0 && started != start,
        ProcessState::Unknown => false,
    }
}

enum ProcessState {
    Gone,
    /// Alive, with its start time (0 when it could not be read).
    Running(u64),
    Unknown,
}

#[cfg(windows)]
fn process_state(pid: u32) -> ProcessState {
    use windows_sys::Win32::Foundation::{
        CloseHandle, GetLastError, ERROR_INVALID_PARAMETER, STILL_ACTIVE,
    };
    use windows_sys::Win32::System::Threading::{
        GetExitCodeProcess, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    // SAFETY: plain Win32 calls on a handle we open and close here.
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            return if GetLastError() == ERROR_INVALID_PARAMETER {
                ProcessState::Gone
            } else {
                ProcessState::Unknown
            };
        }
        let mut code = 0u32;
        let ok = GetExitCodeProcess(handle, &mut code);
        let started = filetime_of(handle);
        CloseHandle(handle);
        if ok != 0 && code != STILL_ACTIVE as u32 {
            ProcessState::Gone
        } else {
            ProcessState::Running(started)
        }
    }
}

#[cfg(windows)]
unsafe fn filetime_of(handle: windows_sys::Win32::Foundation::HANDLE) -> u64 {
    use windows_sys::Win32::Foundation::FILETIME;
    use windows_sys::Win32::System::Threading::GetProcessTimes;
    let zero = FILETIME {
        dwLowDateTime: 0,
        dwHighDateTime: 0,
    };
    let (mut created, mut exited, mut kernel, mut user) = (zero, zero, zero, zero);
    // SAFETY: the caller passes a valid process handle; the out-pointers are live locals.
    if unsafe { GetProcessTimes(handle, &mut created, &mut exited, &mut kernel, &mut user) } == 0 {
        return 0;
    }
    ((created.dwHighDateTime as u64) << 32) | created.dwLowDateTime as u64
}

#[cfg(windows)]
fn process_start(pid: u32) -> Option<u64> {
    match process_state(pid) {
        ProcessState::Running(started) if started != 0 => Some(started),
        _ => None,
    }
}

#[cfg(not(windows))]
fn process_state(_pid: u32) -> ProcessState {
    ProcessState::Unknown
}

#[cfg(not(windows))]
fn process_start(_pid: u32) -> Option<u64> {
    None
}

/// Removes a lock whose owner (recorded by us) no longer exists. A lock without a record is not ours: left alone.
fn clear_if_orphaned(lock: &Path) {
    let owner = owner_path(lock);
    let Ok(record) = std::fs::read_to_string(&owner) else {
        return;
    };
    if owner_is_gone(&record) {
        let _ = std::fs::remove_dir(lock);
        let _ = std::fs::remove_file(&owner);
    }
}

/// Tries once: `Ok(Some)` when we took the lock, `Ok(None)` when it is held by someone else.
pub fn try_acquire(path: &Path) -> std::io::Result<Option<GpuLockGuard>> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    clear_if_orphaned(path);
    match std::fs::create_dir(path) {
        Ok(()) => {
            let _ = std::fs::write(owner_path(path), owner_record());
            if let Ok(mut held) = HELD.lock() {
                held.push(path.to_path_buf());
            }
            Ok(Some(GpuLockGuard {
                path: path.to_path_buf(),
            }))
        }
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => Ok(None),
        Err(e) => Err(e),
    }
}

/// Waits for the lock. `on_wait` is called once when the lock turns out to be busy. `None` means cancelled.
pub async fn acquire(
    path: &Path,
    cancel: &CancellationToken,
    on_wait: impl FnOnce(),
) -> std::io::Result<Option<GpuLockGuard>> {
    let mut on_wait = Some(on_wait);
    loop {
        if let Some(guard) = try_acquire(path)? {
            return Ok(Some(guard));
        }
        if let Some(f) = on_wait.take() {
            f();
        }
        tokio::select! {
            _ = cancel.cancelled() => return Ok(None),
            _ = tokio::time::sleep(POLL) => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn waits_for_a_held_lock_and_releases_on_drop() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("out").join("gpu.lock");
        let first = try_acquire(&path).unwrap().expect("free lock");
        assert!(try_acquire(&path).unwrap().is_none());

        let cancel = CancellationToken::new();
        let mut waited = false;
        let release = async {
            tokio::time::sleep(Duration::from_millis(100)).await;
            drop(first);
        };
        let (got, ()) = tokio::join!(acquire(&path, &cancel, || waited = true), release);
        let guard = got.unwrap().expect("acquired after release");
        assert!(waited);
        drop(guard);
        assert!(!path.exists());
    }

    #[tokio::test]
    async fn cancel_stops_waiting_and_leaves_the_other_lock_alone() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("gpu.lock");
        std::fs::create_dir(&path).unwrap();
        let cancel = CancellationToken::new();
        cancel.cancel();
        assert!(acquire(&path, &cancel, || {}).await.unwrap().is_none());
        assert!(path.exists());
    }

    #[test]
    fn a_lock_whose_owner_is_gone_is_taken_over() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("gpu.lock");
        std::fs::create_dir(&path).unwrap();
        // A process id that cannot exist (above the Windows limit), as left behind by a killed app.
        std::fs::write(owner_path(&path), "4294967294 1").unwrap();
        assert!(
            try_acquire(&path).unwrap().is_some(),
            "an orphaned lock is taken over"
        );
    }

    #[test]
    fn a_lock_held_by_a_live_process_or_by_someone_else_stays() {
        let dir = tempfile::tempdir().unwrap();
        let ours = dir.path().join("ours.lock");
        let guard = try_acquire(&ours).unwrap().expect("free");
        assert!(
            try_acquire(&ours).unwrap().is_none(),
            "our own live lock is respected"
        );
        drop(guard);

        let foreign = dir.path().join("foreign.lock");
        std::fs::create_dir(&foreign).unwrap();
        assert!(
            try_acquire(&foreign).unwrap().is_none(),
            "a lock without an owner record is left alone"
        );
        assert!(foreign.exists());
    }

    #[test]
    fn release_all_frees_what_this_process_holds() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("gpu.lock");
        let guard = try_acquire(&path).unwrap().expect("free");
        std::mem::forget(guard);
        release_where(|p| p == path);
        assert!(!path.exists());
        assert!(!owner_path(&path).exists());
    }
}
