//! Writing a backup archive when something is missing, and the saved screen state's size limit.
use novira_core::backup::archive::{write, Contents};
use novira_core::backup::{check_ui_state, BackupInfo, MAX_UI_STATE_BYTES};

fn info() -> BackupInfo {
    BackupInfo {
        app_version: "0.0.0".into(),
        created_at: 1,
        images: 1,
        boards: 0,
        workflows: 0,
    }
}

#[test]
fn a_gallery_file_that_vanished_is_left_out_and_a_missing_database_fails_without_a_partial_file() {
    let dir = tempfile::tempdir().unwrap();
    let database = dir.path().join("novira.sqlite");
    std::fs::write(&database, b"database").unwrap();
    let kept = dir.path().join("kept.png");
    std::fs::write(&kept, b"picture").unwrap();
    let contents = Contents {
        info: info(),
        database: &database,
        ui_state: "{}",
        originals: vec![
            ("kept.png".into(), kept),
            ("gone.png".into(), dir.path().join("gone.png")),
        ],
        thumbnails: vec![],
    };
    let target = dir.path().join("backup.zip");
    let mut last = (0, 0);
    write(&target, &contents, |done, total| last = (done, total)).unwrap();
    assert_eq!(last, (5, 5), "the left-out file still counts as done");
    let archive = zip::ZipArchive::new(std::fs::File::open(&target).unwrap()).unwrap();
    let names: Vec<&str> = archive.file_names().collect();
    assert!(names.contains(&"outputs/kept.png"));
    assert!(!names.contains(&"outputs/gone.png"));

    // Without the database nothing can be written; the half-written file does not stay.
    let missing = dir.path().join("missing.sqlite");
    let contents = Contents {
        database: &missing,
        originals: vec![],
        ..contents
    };
    let failed = dir.path().join("failed.zip");
    assert!(write(&failed, &contents, |_, _| {}).is_err());
    assert!(!failed.exists());
    assert!(!dir.path().join("failed.zip.partial").exists());
}

#[test]
fn a_saved_screen_state_over_the_limit_is_refused() {
    let big = "x".repeat(MAX_UI_STATE_BYTES + 1);
    assert_eq!(
        check_ui_state(&big),
        Err("the saved screen state is too large".into())
    );
}
