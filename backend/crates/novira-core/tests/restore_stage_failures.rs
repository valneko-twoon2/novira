//! Unpacking a backup that cannot be unpacked: a file that is not there, an earlier unpacked backup that is in use, an
//! entry whose bytes were damaged, a screen state that is not a state, a database with a damaged table, and a restore
//! that cannot be marked ready.
use novira_core::backup::restore::{mark_ready, stage, STAGING};
use novira_core::backup::{DATABASE, MANIFEST, UI_STATE};
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
        zip.start_file(
            *name,
            zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Stored),
        )
        .unwrap();
        zip.write_all(bytes).unwrap();
    }
    zip.finish().unwrap();
}

#[test]
fn a_backup_file_that_is_not_there_is_reported() {
    let dir = tempfile::tempdir().unwrap();
    let err = stage(&dir.path().join("missing.zip"), dir.path(), |_, _| {}).unwrap_err();
    assert!(err.contains("cannot open the backup"), "{err}");
}

#[test]
fn an_entry_whose_bytes_were_damaged_is_reported() {
    let dir = tempfile::tempdir().unwrap();
    let zip = dir.path().join("damaged.zip");
    make_zip(
        &zip,
        &[
            (MANIFEST, manifest()),
            (DATABASE, database_bytes()),
            ("outputs/a.png", b"original-picture-bytes".to_vec()),
        ],
    );
    // Change one byte of the stored picture: its checksum no longer fits.
    let mut bytes = std::fs::read(&zip).unwrap();
    let at = bytes
        .windows(8)
        .position(|w| w == b"original")
        .expect("the picture is stored as it is");
    bytes[at] = b'X';
    std::fs::write(&zip, bytes).unwrap();
    let data = tempfile::tempdir().unwrap();
    let err = stage(&zip, data.path(), |_, _| {}).unwrap_err();
    assert!(err.contains("damaged"), "{err}");
    assert!(!data.path().join(STAGING).exists());
}

#[test]
fn a_screen_state_that_is_not_a_state_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let zip = dir.path().join("state.zip");
    make_zip(
        &zip,
        &[
            (MANIFEST, manifest()),
            (DATABASE, database_bytes()),
            (UI_STATE, b"[1, 2, 3]".to_vec()),
        ],
    );
    let data = tempfile::tempdir().unwrap();
    assert!(stage(&zip, data.path(), |_, _| {}).is_err());
    assert!(!data.path().join(STAGING).exists());
}

#[test]
fn a_database_with_a_damaged_table_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let mut db = database_bytes();
    // The first table's own page (the second page of the file) is overwritten.
    db[4096..8192].fill(0xff);
    let zip = dir.path().join("db.zip");
    make_zip(&zip, &[(MANIFEST, manifest()), (DATABASE, db)]);
    let data = tempfile::tempdir().unwrap();
    let err = stage(&zip, data.path(), |_, _| {}).unwrap_err();
    assert!(err.contains("database cannot be read"), "{err}");
}

#[test]
fn a_restore_that_cannot_be_marked_ready_says_so() {
    let dir = tempfile::tempdir().unwrap();
    let zip = dir.path().join("good.zip");
    make_zip(
        &zip,
        &[(MANIFEST, manifest()), (DATABASE, database_bytes())],
    );
    let data = tempfile::tempdir().unwrap();
    stage(&zip, data.path(), |_, _| {}).unwrap();
    // A folder where the marker file goes.
    std::fs::create_dir(data.path().join(STAGING).join("READY")).unwrap();
    assert!(mark_ready(data.path()).is_err());
}

#[cfg(windows)]
#[test]
fn an_earlier_unpacked_backup_that_is_in_use_stops_the_next_one() {
    use std::os::windows::fs::OpenOptionsExt;
    let dir = tempfile::tempdir().unwrap();
    let zip = dir.path().join("good.zip");
    make_zip(
        &zip,
        &[(MANIFEST, manifest()), (DATABASE, database_bytes())],
    );
    let data = tempfile::tempdir().unwrap();
    stage(&zip, data.path(), |_, _| {}).unwrap();
    let held = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(3)
        .open(data.path().join(STAGING).join(DATABASE))
        .unwrap();
    let err = stage(&zip, data.path(), |_, _| {}).unwrap_err();
    drop(held);
    assert!(err.contains("cannot clear the earlier restore"), "{err}");
}
