//! A restore that fails half way: the previous data is put back, or, when even that fails, the person is told where it
//! is. A file that stays open without delete sharing makes Windows refuse to remove or move the folder around it.
//! The pauses between retries are shortened (debug-only seam) so the "still failing" paths do not wait the
//! real ten seconds. Windows only.
#![cfg(windows)]
use novira_core::backup::restore::{apply_pending, mark_ready, stage, take_outcome, STAGING};
use novira_core::backup::{RestoreOutcome, DATABASE, MANIFEST, OUTPUTS, UI_STATE};
use novira_core::db::Db;
use serde_json::json;
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::os::windows::fs::OpenOptionsExt;
use std::path::Path;

/// Every test in this binary wants quick retries.
fn quick_retries() {
    // Short, but not so short that the whole retry window (about 40 pauses) is over before a busy machine has run the
    // thread that opens the file the restore is waiting on.
    std::env::set_var("NOVIRA_TEST_RETRY_PAUSE_MS", "25");
}

fn database_bytes() -> Vec<u8> {
    let dir = tempfile::tempdir().unwrap();
    drop(Db::open(dir.path()).unwrap());
    std::fs::read(dir.path().join(DATABASE)).unwrap()
}

fn manifest() -> Vec<u8> {
    serde_json::to_vec(&json!({
        "format": "novira-backup", "version": 1, "appVersion": "0.0.0", "createdAt": 1,
        "images": 0, "boards": 0, "workflows": 0
    }))
    .unwrap()
}

fn make_zip(path: &Path, entries: &[(&str, Vec<u8>)]) {
    let mut zip = zip::ZipWriter::new(File::create(path).unwrap());
    for (name, bytes) in entries {
        zip.start_file(*name, zip::write::SimpleFileOptions::default())
            .unwrap();
        zip.write_all(bytes).unwrap();
    }
    zip.finish().unwrap();
}

/// A data folder holding current data (a database and one picture) and a confirmed restore waiting to be applied.
fn data_with_ready_restore(dir: &Path) -> std::path::PathBuf {
    let zip = dir.join("good.zip");
    make_zip(
        &zip,
        &[
            ("manifest.json", manifest()),
            (DATABASE, database_bytes()),
            (UI_STATE, br#"{"novira.settings":"{}"}"#.to_vec()),
            ("outputs/new.png", b"restored".to_vec()),
        ],
    );
    assert_eq!(MANIFEST, "manifest.json");
    let data = dir.join("data");
    std::fs::create_dir_all(data.join(OUTPUTS)).unwrap();
    std::fs::write(data.join(DATABASE), b"current data").unwrap();
    std::fs::write(data.join(OUTPUTS).join("old.png"), b"current picture").unwrap();
    stage(&zip, &data, |_, _| {}).unwrap();
    mark_ready(&data).unwrap();
    data
}

/// Opens `path` so that nobody can delete or rename it while the handle lives.
fn hold(path: &Path) -> File {
    OpenOptions::new()
        .read(true)
        .share_mode(3) // read and write sharing, but not delete
        .open(path)
        .unwrap()
}

/// Watches from another thread until `find` names an existing file, then holds it open (without delete sharing).
/// The restore runs in the meantime: a file it has just put somewhere cannot be held from the test's own thread.
fn hold_when_it_appears(
    find: impl Fn() -> Option<std::path::PathBuf> + Send + 'static,
) -> std::thread::JoinHandle<Option<File>> {
    std::thread::spawn(move || {
        let until = std::time::Instant::now() + std::time::Duration::from_secs(10);
        while std::time::Instant::now() < until {
            if let Some(path) = find() {
                if let Ok(file) = OpenOptions::new().read(true).share_mode(3).open(path) {
                    return Some(file);
                }
            }
            std::thread::sleep(std::time::Duration::from_micros(100));
        }
        None
    })
}

/// The `backup-before-restore-*` folders of a data folder.
fn old_folders(data: &Path) -> Vec<std::path::PathBuf> {
    std::fs::read_dir(data)
        .unwrap()
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .is_some_and(|n| n.to_string_lossy().starts_with("backup-before-restore-"))
        })
        .collect()
}

#[test]
fn a_swap_that_fails_and_cannot_be_undone_says_where_the_previous_data_is() {
    quick_retries();
    let dir = tempfile::tempdir().unwrap();
    let data = data_with_ready_restore(dir.path());
    // A restored picture is in use, so the restored pictures cannot be moved in (after the restored database was).
    let _in_use = hold(&data.join(STAGING).join(OUTPUTS).join("new.png"));
    // The restored database is then opened by something else, so it cannot be removed to put the old one back.
    let restored_db = data.join(DATABASE);
    let holder = hold_when_it_appears(move || {
        (std::fs::metadata(&restored_db).ok()?.len() != b"current data".len() as u64)
            .then(|| restored_db.clone())
    });
    apply_pending(&data);
    let held = holder.join().unwrap();
    assert!(held.is_some(), "the restored database never appeared");
    let RestoreOutcome::Failed { message } = take_outcome(&data) else {
        panic!("the restore should have failed");
    };
    assert!(
        message.contains("cannot move the restored outputs in")
            && message.contains("putting the previous data back failed")
            && message.contains("backup-before-restore-"),
        "{message}"
    );
}

#[test]
fn a_swap_that_fails_before_anything_moves_in_puts_the_previous_data_back() {
    quick_retries();
    let dir = tempfile::tempdir().unwrap();
    let data = data_with_ready_restore(dir.path());
    // A current picture is in use: its folder cannot be moved aside.
    let _in_use = hold(&data.join(OUTPUTS).join("old.png"));
    apply_pending(&data);
    let RestoreOutcome::Failed { message } = take_outcome(&data) else {
        panic!("the restore should have failed");
    };
    assert!(message.contains("kept as it was"), "{message}");
    assert_eq!(std::fs::read(data.join(DATABASE)).unwrap(), b"current data");
    assert!(old_folders(&data).is_empty());
}

#[test]
fn a_previous_folder_that_cannot_be_deleted_after_a_restore_is_left_where_it_is() {
    quick_retries();
    let dir = tempfile::tempdir().unwrap();
    let data = data_with_ready_restore(dir.path());
    // Once the current database is moved aside, something opens it: the folder it is in cannot be deleted.
    let probe = data.clone();
    let holder = hold_when_it_appears(move || {
        old_folders(&probe)
            .into_iter()
            .map(|f| f.join(DATABASE))
            .find(|p| p.is_file())
    });
    apply_pending(&data);
    let held = holder.join().unwrap();
    assert!(held.is_some(), "the old database never appeared");
    let outcome = take_outcome(&data);
    assert!(
        matches!(outcome, RestoreOutcome::Restored { .. }),
        "{outcome:?}"
    );
    drop(held);
    assert_eq!(
        old_folders(&data).len(),
        1,
        "the previous data stays for the person to remove"
    );
}

#[test]
fn a_restore_whose_unpacked_folders_are_not_all_there_still_applies() {
    quick_retries();
    let dir = tempfile::tempdir().unwrap();
    let data = data_with_ready_restore(dir.path());
    // Nothing of the thumbnails was unpacked, so there is nothing of them to move in.
    std::fs::remove_dir_all(data.join(STAGING).join("thumbnails")).unwrap();
    apply_pending(&data);
    let outcome = take_outcome(&data);
    assert!(
        matches!(outcome, RestoreOutcome::Restored { .. }),
        "{outcome:?}"
    );
    assert!(data.join(OUTPUTS).join("new.png").is_file());
}
