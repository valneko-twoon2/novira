//! The rarer paths of restoring a backup: older formats, oversized or repeated entries, a staged restore that cannot be
//! applied at start-up, a busy database file and an outcome that cannot be recorded. The usual round trip and the
//! hostile names are in `backend_service`.
use novira_core::backup::restore::{apply_pending, mark_ready, stage, take_outcome, STAGING};
use novira_core::backup::{RestoreOutcome, DATABASE, MANIFEST, MAX_UI_STATE_BYTES, UI_STATE};
use novira_core::db::Db;
use serde_json::json;
use std::io::Write;
use std::path::Path;

/// The bytes of a valid, empty novira database.
fn database_bytes() -> Vec<u8> {
    let dir = tempfile::tempdir().unwrap();
    drop(Db::open(dir.path()).unwrap());
    std::fs::read(dir.path().join(DATABASE)).unwrap()
}

fn manifest(version: u32) -> Vec<u8> {
    serde_json::to_vec(&json!({
        "format": "novira-backup", "version": version, "appVersion": "0.0.0", "createdAt": 1,
        "images": 0, "boards": 0, "workflows": 0
    }))
    .unwrap()
}

fn make_zip(path: &Path, entries: &[(&str, Vec<u8>)]) {
    let mut zip = zip::ZipWriter::new(std::fs::File::create(path).unwrap());
    for (name, bytes) in entries {
        zip.start_file(*name, zip::write::SimpleFileOptions::default())
            .unwrap();
        zip.write_all(bytes).unwrap();
    }
    zip.finish().unwrap();
}

fn good_zip(path: &Path) {
    make_zip(
        path,
        &[
            (MANIFEST, manifest(1)),
            (DATABASE, database_bytes()),
            (UI_STATE, br#"{"novira.settings":"{}"}"#.to_vec()),
            ("outputs/a.png", b"original".to_vec()),
            ("thumbnails/a.thumb", b"thumb".to_vec()),
        ],
    );
}

#[test]
fn a_backup_in_an_older_format_is_not_supported() {
    let dir = tempfile::tempdir().unwrap();
    let zip = dir.path().join("old.zip");
    make_zip(
        &zip,
        &[(MANIFEST, manifest(0)), (DATABASE, database_bytes())],
    );
    let data = tempfile::tempdir().unwrap();
    let err = stage(&zip, data.path(), |_, _| {}).unwrap_err();
    assert!(err.contains("not supported"), "{err}");
    assert!(!data.path().join(STAGING).exists());
}

#[test]
fn an_entry_that_unpacks_to_more_than_its_limit_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let zip = dir.path().join("big.zip");
    // Zeros pack to almost nothing, so the zip stays small while the screen state is one byte over its limit.
    let too_big = vec![0u8; MAX_UI_STATE_BYTES + 1];
    make_zip(
        &zip,
        &[
            (MANIFEST, manifest(1)),
            (DATABASE, database_bytes()),
            (UI_STATE, too_big),
        ],
    );
    let data = tempfile::tempdir().unwrap();
    let err = stage(&zip, data.path(), |_, _| {}).unwrap_err();
    assert!(err.contains("too large"), "{err}");
    assert!(
        !data.path().join(STAGING).exists(),
        "nothing is left staged"
    );
}

#[test]
fn a_screen_state_that_cannot_be_read_at_start_up_keeps_the_current_data() {
    let dir = tempfile::tempdir().unwrap();
    let zip = dir.path().join("good.zip");
    good_zip(&zip);
    let data = tempfile::tempdir().unwrap();
    std::fs::write(data.path().join(DATABASE), b"current data").unwrap();
    stage(&zip, data.path(), |_, _| {}).unwrap();
    mark_ready(data.path()).unwrap();
    // Something other than a file where the screen state should be.
    let state = data.path().join(STAGING).join(UI_STATE);
    std::fs::remove_file(&state).unwrap();
    std::fs::create_dir(&state).unwrap();
    apply_pending(data.path());
    assert!(matches!(
        take_outcome(data.path()),
        RestoreOutcome::Failed { message } if message.contains("screen state")
    ));
    assert_eq!(
        std::fs::read(data.path().join(DATABASE)).unwrap(),
        b"current data"
    );
    assert!(!data.path().join(STAGING).exists());
}

#[test]
fn a_restore_without_a_screen_state_still_applies() {
    let dir = tempfile::tempdir().unwrap();
    let zip = dir.path().join("plain.zip");
    make_zip(
        &zip,
        &[(MANIFEST, manifest(1)), (DATABASE, database_bytes())],
    );
    let data = tempfile::tempdir().unwrap();
    stage(&zip, data.path(), |_, _| {}).unwrap();
    mark_ready(data.path()).unwrap();
    apply_pending(data.path());
    assert_eq!(
        take_outcome(data.path()),
        RestoreOutcome::Restored {
            ui_state: "{}".into()
        }
    );
    // The outcome is handed out once.
    assert_eq!(take_outcome(data.path()), RestoreOutcome::None);
}

#[test]
fn the_folder_for_the_old_data_gets_a_new_name_when_one_is_taken() {
    let dir = tempfile::tempdir().unwrap();
    let zip = dir.path().join("good.zip");
    good_zip(&zip);
    let data = tempfile::tempdir().unwrap();
    std::fs::write(data.path().join(DATABASE), b"current data").unwrap();
    stage(&zip, data.path(), |_, _| {}).unwrap();
    mark_ready(data.path()).unwrap();
    // The names a restore started in the next seconds would pick are already taken.
    let now = chrono::Local::now();
    for s in 0..3 {
        let stamp = (now + chrono::Duration::seconds(s)).format("%Y%m%d-%H%M%S");
        std::fs::create_dir(data.path().join(format!("backup-before-restore-{stamp}"))).unwrap();
    }
    apply_pending(data.path());
    assert!(matches!(
        take_outcome(data.path()),
        RestoreOutcome::Restored { ui_state } if ui_state.contains("novira.settings")
    ));
    assert!(data.path().join("outputs").join("a.png").is_file());
    assert!(data.path().join("thumbnails").join("a.thumb").is_file());
}

#[test]
fn an_outcome_that_cannot_be_recorded_does_not_stop_the_start() {
    let dir = tempfile::tempdir().unwrap();
    let zip = dir.path().join("good.zip");
    good_zip(&zip);
    let data = tempfile::tempdir().unwrap();
    stage(&zip, data.path(), |_, _| {}).unwrap();
    mark_ready(data.path()).unwrap();
    std::fs::create_dir(data.path().join("restore-result.json")).unwrap();
    apply_pending(data.path());
    // The data was restored even though nothing could be recorded.
    assert!(data.path().join(DATABASE).is_file());
    assert!(!data.path().join(STAGING).exists());
    assert!(data.path().join("restore-result.json").is_dir());
    assert_eq!(take_outcome(data.path()), RestoreOutcome::None);
}

#[cfg(windows)]
#[test]
fn a_database_that_is_still_open_is_moved_aside_once_it_is_released() {
    use std::os::windows::fs::OpenOptionsExt;
    let dir = tempfile::tempdir().unwrap();
    let zip = dir.path().join("good.zip");
    good_zip(&zip);
    let data = tempfile::tempdir().unwrap();
    std::fs::write(data.path().join(DATABASE), b"current data").unwrap();
    stage(&zip, data.path(), |_, _| {}).unwrap();
    mark_ready(data.path()).unwrap();
    // The app that asked for the restart still holds the old database: a sharing violation for the first tries.
    let held = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(0)
        .open(data.path().join(DATABASE))
        .unwrap();
    let releaser = std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(400));
        drop(held);
    });
    apply_pending(data.path());
    releaser.join().unwrap();
    assert!(matches!(
        take_outcome(data.path()),
        RestoreOutcome::Restored { .. }
    ));
    assert_ne!(
        std::fs::read(data.path().join(DATABASE)).unwrap(),
        b"current data"
    );
}

#[cfg(windows)]
#[test]
fn a_staging_folder_that_cannot_be_removed_afterwards_does_not_undo_the_restore() {
    use std::os::windows::fs::OpenOptionsExt;
    let dir = tempfile::tempdir().unwrap();
    let zip = dir.path().join("good.zip");
    good_zip(&zip);
    let data = tempfile::tempdir().unwrap();
    stage(&zip, data.path(), |_, _| {}).unwrap();
    mark_ready(data.path()).unwrap();
    // Something still holds a file in the staging folder, so the folder cannot be deleted.
    let held = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(0)
        .open(data.path().join(STAGING).join("READY"))
        .unwrap();
    apply_pending(data.path());
    assert!(matches!(
        take_outcome(data.path()),
        RestoreOutcome::Restored { .. }
    ));
    assert!(data.path().join("outputs").join("a.png").is_file());
    drop(held);
}
