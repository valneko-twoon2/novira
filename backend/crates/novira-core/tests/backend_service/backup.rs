//! Backup and restore of the user's data, and export for sharing: what a backup holds, the round trip into another
//! data folder, hostile or foreign zips, and the roll-back of a restore that fails at start-up.
use super::common::*;
use novira_core::backup::{RestoreOutcome, OUTPUTS};
use novira_core::media::export::{ExportFormat, ExportOptions};
use novira_core::media::images;
use novira_core::types::*;
use serde_json::json;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;

const UI_STATE: &str =
    r#"{"novira.settings":"{\"state\":{\"language\":\"en\"}}","novira.characters":"[]"}"#;

async fn upload(backend: &novira_core::Backend, w: u32, board: Option<String>) -> ImageDTO {
    backend
        .upload_image(
            png(w, 8),
            ImageOptions {
                board_id: board,
                ..ImageOptions::default()
            },
        )
        .await
        .unwrap()
}

fn entry_names(zip: &Path) -> Vec<String> {
    let mut archive = zip::ZipArchive::new(std::fs::File::open(zip).unwrap()).unwrap();
    let mut names: Vec<String> = (0..archive.len())
        .map(|i| archive.by_index(i).unwrap().name().to_string())
        .collect();
    names.sort();
    names
}

/// A zip with the given entries (name, bytes), for hostile and foreign backups.
fn make_zip(path: &Path, entries: &[(&str, Vec<u8>)]) {
    let mut zip = zip::ZipWriter::new(std::fs::File::create(path).unwrap());
    for (name, bytes) in entries {
        zip.start_file(*name, zip::write::SimpleFileOptions::default())
            .unwrap();
        zip.write_all(bytes).unwrap();
    }
    zip.finish().unwrap();
}

fn manifest(version: u32, format: &str) -> Vec<u8> {
    serde_json::to_vec(&json!({
        "format": format, "version": version, "appVersion": "0.0.0", "createdAt": 1,
        "images": 0, "boards": 0, "workflows": 0
    }))
    .unwrap()
}

fn leftovers(dir: &Path) -> Vec<String> {
    std::fs::read_dir(dir)
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .filter(|n| n.starts_with("restore-staging") || n.starts_with("backup-before-restore-"))
        .collect()
}

/// A backup of a data folder with one board, two pictures and a saved workflow.
async fn source_backup(out: &Path) -> (PathBuf, Vec<ImageDTO>, Vec<u8>) {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path(), Arc::new(FakeEngine::default()));
    let board = backend.create_board("Trip").unwrap();
    let a = upload(&backend, 16, Some(board.id.clone())).await;
    let b = upload(&backend, 24, None).await;
    backend
        .save_workflow(WorkflowInput {
            id: None,
            name: "W".into(),
            description: String::new(),
            author: String::new(),
            tags: vec![],
            graph: json!({ "nodes": [] }),
        })
        .unwrap();
    std::fs::create_dir_all(dir.path().join("secrets")).unwrap();
    std::fs::write(dir.path().join("secrets").join("civitai.key"), b"encrypted").unwrap();
    let target = out.join("novira-backup.zip");
    let summary = backend
        .create_backup(UI_STATE.into(), target.clone())
        .await
        .unwrap();
    assert_eq!(summary.file_name, "novira-backup.zip");
    assert_eq!(
        (
            summary.info.images,
            summary.info.boards,
            summary.info.workflows
        ),
        (2, 1, 1)
    );
    assert!(summary.bytes > 0);
    assert!(events.lock().unwrap().iter().any(
        |e| matches!(e, BackendEvent::Backup { progress } if progress.done == progress.total)
    ));
    let original_a = backend.read_image("full", &a.name).unwrap().0;
    // The work folder of the database copy is gone.
    let cache: Vec<_> = std::fs::read_dir(dir.path().join("cache"))
        .map(|d| d.flatten().collect())
        .unwrap_or_default();
    assert!(cache.is_empty(), "work files left in the cache");
    (target, vec![a, b], original_a)
}

#[tokio::test]
async fn a_backup_holds_the_database_gallery_and_screen_state_and_nothing_secret() {
    let out = tempfile::tempdir().unwrap();
    let (zip, pictures, _) = source_backup(out.path()).await;
    let names = entry_names(&zip);
    for expected in ["manifest.json", "novira.sqlite", "ui-state.json"] {
        assert!(names.contains(&expected.to_string()), "{names:?}");
    }
    for p in &pictures {
        assert!(names.contains(&format!("outputs/{}", p.name)));
        let stem = p.name.trim_end_matches(".png");
        assert!(names.contains(&format!("thumbnails/{stem}.thumb")));
    }
    assert_eq!(names.len(), 3 + 2 * pictures.len(), "{names:?}");
    assert!(!names
        .iter()
        .any(|n| n.contains("secret") || n.contains("settings.json")));
}

#[tokio::test]
async fn a_restore_replaces_the_data_at_the_next_start_and_hands_back_the_screen_state_once() {
    let out = tempfile::tempdir().unwrap();
    let (zip, pictures, original_a) = source_backup(out.path()).await;

    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path(), Arc::new(FakeEngine::default()));
    let mine = upload(&backend, 40, None).await;
    let info = backend.stage_restore(zip).await.unwrap();
    assert_eq!((info.images, info.boards, info.workflows), (2, 1, 1));
    assert!(events
        .lock()
        .unwrap()
        .iter()
        .any(|e| matches!(e, BackendEvent::Backup { .. })));
    // Nothing changes until the next start.
    assert_eq!(backend.bootstrap().images.len(), 1);
    backend.confirm_restore().unwrap();
    drop(backend);

    let (restored, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let boot = restored.bootstrap();
    let mut names: Vec<_> = boot.images.iter().map(|i| i.name.clone()).collect();
    let mut expected: Vec<_> = pictures.iter().map(|i| i.name.clone()).collect();
    names.sort();
    expected.sort();
    assert_eq!(names, expected);
    assert_eq!(boot.boards.len(), 1);
    assert_eq!(boot.boards[0].name, "Trip");
    assert_eq!(boot.workflows.len(), 1);
    assert_eq!(
        restored.read_image("full", &pictures[0].name).unwrap().0,
        original_a
    );
    assert!(restored.read_image("thumb", &pictures[1].name).is_some());
    assert!(
        restored.read_image("full", &mine.name).is_none(),
        "the old picture is gone"
    );
    assert_eq!(
        restored.take_restore_outcome(),
        RestoreOutcome::Restored {
            ui_state: UI_STATE.into()
        }
    );
    assert_eq!(restored.take_restore_outcome(), RestoreOutcome::None);
    assert!(
        leftovers(dir.path()).is_empty(),
        "{:?}",
        leftovers(dir.path())
    );
}

#[tokio::test]
async fn a_restore_that_fails_at_start_up_puts_the_old_data_back() {
    let out = tempfile::tempdir().unwrap();
    let (zip, _, _) = source_backup(out.path()).await;
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let mine = upload(&backend, 40, None).await;
    backend.stage_restore(zip).await.unwrap();
    backend.confirm_restore().unwrap();
    drop(backend);
    // The staged database is damaged after it was checked: applying it must fail and roll back.
    std::fs::write(
        dir.path().join("restore-staging").join("novira.sqlite"),
        b"this is not a database at all, but it is long enough to look like a file",
    )
    .unwrap();

    let (reopened, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let boot = reopened.bootstrap();
    assert_eq!(boot.images.len(), 1);
    assert_eq!(boot.images[0].name, mine.name);
    assert!(reopened.read_image("full", &mine.name).is_some());
    assert!(matches!(
        reopened.take_restore_outcome(),
        RestoreOutcome::Failed { message } if message.contains("kept")
    ));
    assert!(
        leftovers(dir.path()).is_empty(),
        "{:?}",
        leftovers(dir.path())
    );
}

#[tokio::test]
async fn an_unconfirmed_restore_is_dropped_and_changes_nothing() {
    let out = tempfile::tempdir().unwrap();
    let (zip, _, _) = source_backup(out.path()).await;
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let mine = upload(&backend, 40, None).await;
    backend.stage_restore(zip.clone()).await.unwrap();
    backend.discard_restore().unwrap();
    assert!(leftovers(dir.path()).is_empty());
    backend.stage_restore(zip).await.unwrap();
    drop(backend);
    let (reopened, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert_eq!(reopened.bootstrap().images[0].name, mine.name);
    assert_eq!(reopened.take_restore_outcome(), RestoreOutcome::None);
    assert!(leftovers(dir.path()).is_empty());
    assert!(
        reopened.confirm_restore().is_err(),
        "nothing is staged any more"
    );
}

#[tokio::test]
async fn entries_that_leave_the_folder_are_refused_before_anything_is_written() {
    let out = tempfile::tempdir().unwrap();
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    for evil in [
        "../evil.png",
        "outputs/../../evil.png",
        "/abs/evil.png",
        "C:/evil.png",
        "C:\\evil.png",
        "outputs\\..\\..\\evil.png",
        "secrets/civitai.key",
    ] {
        let zip = out.path().join("evil.zip");
        make_zip(
            &zip,
            &[
                ("manifest.json", manifest(1, "novira-backup")),
                ("novira.sqlite", b"x".to_vec()),
                (evil, b"payload".to_vec()),
            ],
        );
        let err = backend.stage_restore(zip).await.unwrap_err().to_string();
        assert!(err.contains("unexpected file"), "{evil}: {err}");
        assert!(leftovers(dir.path()).is_empty(), "{evil}");
        assert!(!out.path().join("evil.png").exists() && !dir.path().join("evil.png").exists());
    }
}

#[tokio::test]
async fn foreign_and_newer_backups_are_refused() {
    let out = tempfile::tempdir().unwrap();
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let zip = out.path().join("b.zip");
    let cases: [(Vec<u8>, &str); 3] = [
        (manifest(2, "novira-backup"), "newer version"),
        (manifest(1, "something-else"), "not a novira backup"),
        (b"{".to_vec(), "not a novira backup"),
    ];
    for (m, expected) in cases {
        make_zip(
            &zip,
            &[("manifest.json", m), ("novira.sqlite", b"x".to_vec())],
        );
        let err = backend
            .stage_restore(zip.clone())
            .await
            .unwrap_err()
            .to_string();
        assert!(err.contains(expected), "{err}");
    }
    // No manifest, a missing database, a file that is not a zip, a database that is not one.
    make_zip(&zip, &[("novira.sqlite", b"x".to_vec())]);
    assert!(backend.stage_restore(zip.clone()).await.is_err());
    make_zip(&zip, &[("manifest.json", manifest(1, "novira-backup"))]);
    assert!(backend.stage_restore(zip.clone()).await.is_err());
    std::fs::write(&zip, b"plain text").unwrap();
    assert!(backend.stage_restore(zip.clone()).await.is_err());
    make_zip(
        &zip,
        &[
            ("manifest.json", manifest(1, "novira-backup")),
            (
                "novira.sqlite",
                b"this is not a database, only a long enough text file".to_vec(),
            ),
        ],
    );
    let err = backend.stage_restore(zip).await.unwrap_err().to_string();
    assert!(err.contains("database"), "{err}");
    assert!(leftovers(dir.path()).is_empty());
}

#[tokio::test]
async fn a_bad_screen_state_is_refused_before_writing() {
    let out = tempfile::tempdir().unwrap();
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let target = out.path().join("x.zip");
    assert!(backend
        .create_backup(r#"{"other.key":"x"}"#.into(), target.clone())
        .await
        .is_err());
    assert!(!target.exists());
}

#[tokio::test]
async fn exported_pictures_are_clean_copies_and_other_media_are_skipped() {
    let dir = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let tagged = images::with_text(
        &png(64, 32),
        images::METADATA_KEY,
        r#"{"positivePrompt":"private words"}"#,
    )
    .unwrap();
    let pic = backend
        .upload_image(tagged, ImageOptions::default())
        .await
        .unwrap();
    let options = ExportOptions {
        format: ExportFormat::Png,
        quality: 90,
        max_side: Some(32),
        remove_info: true,
        watermark: false,
    };
    let names = vec![
        pic.name.clone(),
        pic.name.clone(),
        "0123abcd.mp4".to_string(),
    ];
    let result = backend
        .export_images(names, options.clone(), out.path().to_path_buf())
        .await
        .unwrap();
    assert_eq!((result.count, result.skipped), (2, 1));
    let stem = pic.name.trim_end_matches(".png");
    let first = std::fs::read(out.path().join(format!("{stem}.png"))).unwrap();
    assert!(out.path().join(format!("{stem}-2.png")).is_file());
    assert_eq!(images::read_text(&first, images::METADATA_KEY), None);
    assert!(!first.windows(7).any(|w| w == b"private"));
    assert_eq!(image::load_from_memory(&first).unwrap().width(), 32);
    // The original keeps its settings.
    assert!(backend.read_image("full", &pic.name).is_some());
    assert!(dir
        .path()
        .join(OUTPUTS)
        .join(novira_core::media::arrangement::UNCATEGORIZED)
        .join(novira_core::media::arrangement::file_name(
            &pic.name,
            pic.created_at
        ))
        .is_file());

    for bad in [vec!["../x.png".to_string()], vec![]] {
        assert!(backend.check_export(&bad, &options).is_err());
    }
    let missing = out.path().join("missing");
    assert!(backend
        .export_images(vec![pic.name.clone()], options, missing)
        .await
        .is_err());
}
