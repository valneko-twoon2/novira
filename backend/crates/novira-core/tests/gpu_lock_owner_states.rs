//! How the GPU lock judges the owner recorded beside a lock folder: a process Windows will not describe to us counts as
//! alive (the lock stays), and a process that has exited counts as gone even while something still holds a handle to it
//! (so its process id has not been handed out again). Windows only.
#![cfg(windows)]
use novira_core::gpu_lock::try_acquire;
use std::path::Path;

fn lock_owned_by(dir: &Path, record: &str) -> std::path::PathBuf {
    let lock = dir.join("gpu.lock");
    std::fs::create_dir(&lock).unwrap();
    std::fs::write(dir.join("gpu.lock.owner"), record).unwrap();
    lock
}

#[test]
fn a_lock_owned_by_a_process_that_cannot_be_inspected_stays() {
    let dir = tempfile::tempdir().unwrap();
    // Process id 4 is the Windows kernel's "System" process: opening it for a query is refused to a normal program.
    let lock = lock_owned_by(dir.path(), "4 1");
    assert!(try_acquire(&lock).unwrap().is_none());
    assert!(lock.is_dir(), "the lock is not taken over");
}

#[test]
fn a_lock_owned_by_a_process_that_has_exited_is_taken_over_even_while_its_handle_is_open() {
    let dir = tempfile::tempdir().unwrap();
    // This test program itself, asked only to list its tests: it ends at once.
    let mut child = std::process::Command::new(std::env::current_exe().unwrap())
        .arg("--list")
        .stdout(std::process::Stdio::null())
        .spawn()
        .unwrap();
    child.wait().unwrap();
    // `child` still holds the process handle, so the id exists but the process is finished.
    let lock = lock_owned_by(dir.path(), &format!("{} 1", child.id()));
    assert!(try_acquire(&lock).unwrap().is_some());
}
