//! Backup archives that are written or read under odd conditions: a gallery entry that cannot be read and a screen state
//! that is not text. The usual round trip is in `backend_service`, the rarer
//! restore paths in `restore_edge_cases`.
use novira_core::backup::archive::{write, Contents};
use novira_core::backup::restore::{stage, STAGING};
use novira_core::backup::{BackupInfo, DATABASE, MANIFEST, UI_STATE};
use novira_core::db::Db;
use serde_json::json;
use std::io::Write;
use std::path::Path;

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
    let mut zip = zip::ZipWriter::new(std::fs::File::create(path).unwrap());
    for (name, bytes) in entries {
        zip.start_file(*name, zip::write::SimpleFileOptions::default())
            .unwrap();
        zip.write_all(bytes).unwrap();
    }
    zip.finish().unwrap();
}

#[test]
fn a_gallery_entry_that_cannot_be_read_fails_the_backup_and_leaves_no_partial_file() {
    let dir = tempfile::tempdir().unwrap();
    let database = dir.path().join("novira.sqlite");
    std::fs::write(&database, b"database").unwrap();
    // A folder where a picture should be: it exists, but it cannot be read as a file.
    let folder = dir.path().join("not-a-file.png");
    std::fs::create_dir(&folder).unwrap();
    let contents = Contents {
        info: BackupInfo {
            app_version: "0.0.0".into(),
            created_at: 1,
            images: 1,
            boards: 0,
            workflows: 0,
        },
        database: &database,
        ui_state: "{}",
        originals: vec![("not-a-file.png".into(), folder)],
        thumbnails: vec![],
    };
    let target = dir.path().join("backup.zip");
    assert!(write(&target, &contents, |_, _| {}).is_err());
    assert!(!target.exists());
    assert!(!dir.path().join("backup.zip.partial").exists());
}

#[test]
fn a_screen_state_that_is_not_text_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let zip = dir.path().join("binary-state.zip");
    make_zip(
        &zip,
        &[
            (MANIFEST, manifest()),
            (DATABASE, database_bytes()),
            (UI_STATE, vec![0xff, 0xfe, 0x00, 0x80]),
        ],
    );
    let data = tempfile::tempdir().unwrap();
    assert!(stage(&zip, data.path(), |_, _| {}).is_err());
    assert!(!data.path().join(STAGING).exists());
}

#[test]
fn a_target_that_cannot_be_replaced_fails_the_backup_and_leaves_no_partial_file() {
    let dir = tempfile::tempdir().unwrap();
    let database = dir.path().join("novira.sqlite");
    std::fs::write(&database, b"database").unwrap();
    let contents = Contents {
        info: BackupInfo {
            app_version: "0.0.0".into(),
            created_at: 1,
            images: 0,
            boards: 0,
            workflows: 0,
        },
        database: &database,
        ui_state: "{}",
        originals: vec![],
        thumbnails: vec![],
    };
    // A folder with something in it sits where the backup file should go.
    let target = dir.path().join("backup.zip");
    std::fs::create_dir(&target).unwrap();
    std::fs::write(target.join("keep.txt"), b"x").unwrap();
    assert!(write(&target, &contents, |_, _| {}).is_err());
    assert!(target.join("keep.txt").is_file());
    assert!(!dir.path().join("backup.zip.partial").exists());
}
