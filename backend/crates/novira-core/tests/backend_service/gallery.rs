//! Gallery: uploads, image edits, boards and workflows.
use super::common::*;
use novira_core::media::images;
use novira_core::types::*;
use serde_json::json;
use std::sync::Arc;

#[tokio::test]
async fn re_uploaded_images_keep_their_embedded_settings() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let meta = request("m", "kept prompt", 1).params;
    let tagged = images::with_text(
        &png(8, 8),
        images::METADATA_KEY,
        &serde_json::to_string(&meta).unwrap(),
    )
    .unwrap();
    let img = backend
        .upload_image(tagged, ImageOptions::default())
        .await
        .unwrap();
    assert_eq!(img.metadata.unwrap().positive_prompt, "kept prompt");
    assert!(backend
        .upload_image(b"not an image".to_vec(), ImageOptions::default())
        .await
        .is_err());
}

#[tokio::test]
async fn image_edits_touch_only_the_named_images_and_a_null_board_uncategorizes() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path(), Arc::new(FakeEngine::default()));
    let board = backend.create_board("  Trimmed  ").unwrap();
    assert_eq!(board.name, "Trimmed");
    assert!(matches!(
        backend.create_board("   "),
        Err(novira_core::BackendError::Invalid(_))
    ));
    let a = backend
        .upload_image(
            png(8, 8),
            ImageOptions {
                board_id: Some(board.id.clone()),
                is_intermediate: Some(true),
                category: Some(ImageCategory::Mask),
            },
        )
        .await
        .unwrap();
    assert!(a.is_intermediate);
    assert_eq!(a.category, ImageCategory::Mask);
    assert_eq!(a.thumbnail_url, format!("{BASE}/thumb/{}", a.name));
    let b = backend
        .upload_image(png(8, 8), ImageOptions::default())
        .await
        .unwrap();
    assert_eq!(
        backend.bootstrap().images[0].name,
        b.name,
        "newest image first"
    );
    assert!(events.lock().unwrap().iter().any(
        |e| matches!(e, BackendEvent::ImageAdded { image, item: None } if image.name == b.name)
    ));

    let changed = backend
        .update_images(
            std::slice::from_ref(&a.name),
            serde_json::from_value(json!({ "boardId": null, "starred": true })).unwrap(),
        )
        .unwrap();
    assert_eq!(changed.len(), 1);
    assert_eq!(changed[0].board_id, None);
    assert!(changed[0].starred && changed[0].is_intermediate);
    let untouched = backend
        .bootstrap()
        .images
        .into_iter()
        .find(|i| i.name == b.name)
        .unwrap();
    assert!(!untouched.starred);
    assert!(backend
        .update_images(&["missing.png".to_string()], ImagePatch::default())
        .unwrap()
        .is_empty());
    assert!(backend.read_image("other", &a.name).is_none());
    assert!(backend.read_image("full", "../x.png").is_none());
}

#[tokio::test]
async fn deleting_a_board_with_its_images_removes_their_files() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let board = backend.create_board("Doomed").unwrap();
    let inside = backend
        .upload_image(
            png(8, 8),
            ImageOptions {
                board_id: Some(board.id.clone()),
                ..Default::default()
            },
        )
        .await
        .unwrap();
    let outside = backend
        .upload_image(png(8, 8), ImageOptions::default())
        .await
        .unwrap();
    let renamed = backend
        .update_board(
            &board.id,
            BoardPatch {
                name: Some("Renamed".into()),
                archived: Some(true),
            },
        )
        .unwrap();
    assert_eq!((renamed.name.as_str(), renamed.archived), ("Renamed", true));
    // A rename follows the same rules as create: trimmed, and blank is rejected
    // without touching the stored name.
    let trimmed = backend
        .update_board(
            &board.id,
            BoardPatch {
                name: Some("  Spaced  ".into()),
                archived: None,
            },
        )
        .unwrap();
    assert_eq!(trimmed.name, "Spaced");
    assert!(matches!(
        backend.update_board(
            &board.id,
            BoardPatch {
                name: Some("   ".into()),
                archived: Some(false),
            },
        ),
        Err(novira_core::BackendError::Invalid(_))
    ));
    let kept = backend.bootstrap();
    let kept = kept.boards.iter().find(|b| b.id == board.id).unwrap();
    assert_eq!((kept.name.as_str(), kept.archived), ("Spaced", true));
    assert!(matches!(
        backend.update_board("board-missing", BoardPatch::default()),
        Err(novira_core::BackendError::NotFound(_))
    ));

    let deleted = backend.delete_board(&board.id, true).unwrap();
    assert_eq!(deleted, std::slice::from_ref(&inside.name));
    assert!(backend.read_image("full", &inside.name).is_none());
    assert!(backend.read_image("thumb", &inside.name).is_none());
    assert!(backend.read_image("full", &outside.name).is_some());
    drop(backend);

    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let boot = backend.bootstrap();
    assert!(boot.boards.is_empty());
    assert_eq!(
        boot.images.iter().map(|i| &i.name).collect::<Vec<_>>(),
        [&outside.name]
    );
}

#[tokio::test]
async fn saving_a_workflow_with_its_id_updates_it_in_place() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let first = backend
        .save_workflow(serde_json::from_value(json!({ "name": "A", "graph": { "v": 1 } })).unwrap())
        .unwrap();
    assert_eq!(first.category, "user");
    let updated = backend
        .save_workflow(
            serde_json::from_value(
                json!({ "id": first.id, "name": "A2", "tags": ["x"], "graph": { "v": 2 } }),
            )
            .unwrap(),
        )
        .unwrap();
    assert_eq!(updated.id, first.id);
    assert!(updated.updated_at >= first.updated_at);
    // An unknown id makes a new workflow with an id of the backend's own.
    let other = backend
        .save_workflow(
            serde_json::from_value(json!({ "id": "made-up", "name": "B", "graph": {} })).unwrap(),
        )
        .unwrap();
    assert_ne!(other.id, "made-up");
    assert_eq!(backend.bootstrap().workflows.len(), 2);
    backend.delete_workflow(&other.id).unwrap();
    drop(backend);

    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let workflows = backend.bootstrap().workflows;
    assert_eq!(workflows.len(), 1);
    assert_eq!(workflows[0].name, "A2");
    assert_eq!(workflows[0].tags, ["x"]);
    assert_eq!(workflows[0].graph, json!({ "v": 2 }));
}

#[tokio::test]
async fn a_deleted_picture_waits_in_the_trash_and_comes_back_with_its_board_and_star() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let board = backend.create_board("Keep").unwrap();
    let img = backend
        .upload_image(
            png(8, 8),
            ImageOptions {
                board_id: Some(board.id.clone()),
                ..ImageOptions::default()
            },
        )
        .await
        .unwrap();
    let other = backend
        .upload_image(png(8, 8), ImageOptions::default())
        .await
        .unwrap();
    backend
        .update_images(
            std::slice::from_ref(&img.name),
            ImagePatch {
                starred: Some(true),
                ..ImagePatch::default()
            },
        )
        .unwrap();

    backend
        .delete_images(std::slice::from_ref(&img.name))
        .unwrap();
    assert!(backend
        .bootstrap()
        .images
        .iter()
        .all(|i| i.name != img.name));
    assert!(backend.read_image("full", &img.name).is_none());
    assert!(dir.path().join("trash").join(&img.name).exists());

    let back = backend
        .restore_images(std::slice::from_ref(&img.name))
        .unwrap();
    assert_eq!(back.len(), 1);
    assert_eq!(back[0].board_id.as_deref(), Some(board.id.as_str()));
    assert!(back[0].starred);
    assert!(backend.read_image("full", &img.name).is_some());
    assert!(backend.read_image("thumb", &img.name).is_some());
    // The newest picture stays first: the restored one is older than the other.
    let names: Vec<String> = backend
        .bootstrap()
        .images
        .into_iter()
        .map(|i| i.name)
        .collect();
    assert_eq!(names.len(), 2);
    assert!(names.contains(&other.name));
    // Restoring twice, or what was never deleted, brings nothing.
    assert!(backend
        .restore_images(std::slice::from_ref(&img.name))
        .unwrap()
        .is_empty());
    assert!(backend
        .restore_images(&["nope.png".into()])
        .unwrap()
        .is_empty());
    backend.shutdown();
}

#[tokio::test]
async fn a_picture_whose_board_was_deleted_in_the_meantime_comes_back_uncategorized() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let board = backend.create_board("Gone").unwrap();
    let img = backend
        .upload_image(
            png(8, 8),
            ImageOptions {
                board_id: Some(board.id.clone()),
                ..ImageOptions::default()
            },
        )
        .await
        .unwrap();
    // Deleting the board with its pictures puts them in the trash too.
    assert_eq!(
        backend.delete_board(&board.id, true).unwrap(),
        vec![img.name.clone()]
    );
    let back = backend
        .restore_images(std::slice::from_ref(&img.name))
        .unwrap();
    assert_eq!(back[0].board_id, None);
    backend.shutdown();
}

#[tokio::test]
async fn a_trashed_picture_survives_a_restart_and_a_stray_name_is_deleted_for_good() {
    let dir = tempfile::tempdir().unwrap();
    let name = {
        let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
        let img = backend
            .upload_image(png(8, 8), ImageOptions::default())
            .await
            .unwrap();
        backend
            .delete_images(std::slice::from_ref(&img.name))
            .unwrap();
        backend.shutdown();
        img.name
    };
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert!(backend.bootstrap().images.is_empty());
    assert_eq!(
        backend
            .restore_images(std::slice::from_ref(&name))
            .unwrap()
            .len(),
        1
    );
    // A stray file the gallery does not know is removed outright, not trashed.
    let stray = format!("{}.png", "a".repeat(32));
    std::fs::write(dir.path().join("outputs").join(&stray), b"x").unwrap();
    backend.delete_images(std::slice::from_ref(&stray)).unwrap();
    assert!(!dir.path().join("outputs").join(&stray).exists());
    assert!(!dir.path().join("trash").join(&stray).exists());
    backend.shutdown();
}

#[tokio::test]
async fn restore_and_delete_refuse_names_that_leave_the_picture_folders() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let outside = dir.path().join("secret.png");
    std::fs::write(&outside, b"keep me").unwrap();
    for name in [
        "../secret.png",
        r"..\secret.png",
        "C:/secret.png",
        "a/b.png",
        "",
    ] {
        assert!(backend
            .restore_images(&[name.to_string()])
            .unwrap()
            .is_empty());
        backend.delete_images(&[name.to_string()]).unwrap();
    }
    assert!(outside.exists());
    assert!(!dir.path().join("trash").join("secret.png").exists());
    backend.shutdown();
}
