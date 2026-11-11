//! What the backend tells every page when the gallery, the models or the workflow library change, so a phone and the
//! PC that open the same data folder show the same boards, pictures, models and workflows.
use super::common::*;
use novira_core::types::*;
use serde_json::json;
use std::sync::{Arc, Mutex};

/// The events since the last call, and forgets them.
fn take(events: &Arc<Mutex<Vec<BackendEvent>>>) -> Vec<BackendEvent> {
    std::mem::take(&mut *events.lock().unwrap())
}

/// The board names of the last `boards_changed` among `events`.
fn last_boards(events: &[BackendEvent]) -> Option<Vec<String>> {
    events.iter().rev().find_map(|e| match e {
        BackendEvent::BoardsChanged { boards } => {
            Some(boards.iter().map(|b| b.name.clone()).collect())
        }
        _ => None,
    })
}

/// The pictures and the removed names of every `images_changed` among `events`, in order.
fn image_changes(events: &[BackendEvent]) -> Vec<(Vec<ImageDTO>, Vec<String>)> {
    events
        .iter()
        .filter_map(|e| match e {
            BackendEvent::ImagesChanged { images, removed } => {
                Some((images.clone(), removed.clone()))
            }
            _ => None,
        })
        .collect()
}

// tags: scenario
#[test]
fn every_board_change_tells_the_pages_the_whole_list() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path(), Arc::new(FakeEngine::default()));
    let a = backend.create_board("A").unwrap();
    assert_eq!(last_boards(&take(&events)), Some(vec!["A".to_string()]));
    backend.create_board("B").unwrap();
    assert_eq!(
        last_boards(&take(&events)),
        Some(vec!["A".to_string(), "B".to_string()])
    );
    backend
        .update_board(
            &a.id,
            serde_json::from_value(json!({ "name": "A2" })).unwrap(),
        )
        .unwrap();
    assert_eq!(
        last_boards(&take(&events)),
        Some(vec!["A2".to_string(), "B".to_string()])
    );
    backend.delete_board(&a.id, false).unwrap();
    assert_eq!(last_boards(&take(&events)), Some(vec!["B".to_string()]));
}

// tags: error-guessing
#[test]
fn a_refused_board_change_tells_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert!(backend.create_board("  ").is_err());
    assert!(backend
        .update_board(
            "board-none",
            serde_json::from_value(json!({ "name": "X" })).unwrap()
        )
        .is_err());
    assert_eq!(last_boards(&take(&events)), None);
}

// tags: state-transition
#[tokio::test]
async fn picture_edits_deletes_and_restores_tell_the_pages() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path(), Arc::new(FakeEngine::default()));
    let board = backend.create_board("Board").unwrap();
    let a = backend
        .upload_image(png(8, 8), ImageOptions::default())
        .await
        .unwrap();
    take(&events);

    backend
        .update_images(
            std::slice::from_ref(&a.name),
            serde_json::from_value(json!({ "boardId": board.id, "starred": true })).unwrap(),
        )
        .unwrap();
    let changes = image_changes(&take(&events));
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].0.len(), 1);
    assert_eq!(changes[0].0[0].board_id.as_deref(), Some(board.id.as_str()));
    assert!(changes[0].0[0].starred);
    assert!(changes[0].1.is_empty());

    backend
        .delete_images(&[a.name.clone(), "stray.png".into()])
        .unwrap();
    // Only what was in the gallery is said to leave it.
    assert_eq!(
        image_changes(&take(&events)),
        vec![(vec![], vec![a.name.clone()])]
    );

    let back = backend
        .restore_images(std::slice::from_ref(&a.name))
        .unwrap();
    assert_eq!(image_changes(&take(&events)), vec![(back, vec![])]);
}

// tags: scenario
#[tokio::test]
async fn deleting_a_board_tells_the_pages_where_its_pictures_went() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path(), Arc::new(FakeEngine::default()));
    let kept = backend.create_board("Kept").unwrap();
    let gone = backend.create_board("Gone").unwrap();
    let on = |id: &str| ImageOptions {
        board_id: Some(id.to_string()),
        ..ImageOptions::default()
    };
    let moved = backend.upload_image(png(8, 8), on(&kept.id)).await.unwrap();
    let trashed = backend.upload_image(png(8, 8), on(&gone.id)).await.unwrap();
    take(&events);

    // Without its pictures: they move to Uncategorized.
    backend.delete_board(&kept.id, false).unwrap();
    let changes = image_changes(&take(&events));
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].0.len(), 1);
    assert_eq!(changes[0].0[0].name, moved.name);
    assert_eq!(changes[0].0[0].board_id, None);
    assert!(changes[0].1.is_empty());

    // With its pictures: they leave the gallery.
    backend.delete_board(&gone.id, true).unwrap();
    let after = take(&events);
    assert_eq!(last_boards(&after), Some(vec![]));
    assert_eq!(image_changes(&after), vec![(vec![], vec![trashed.name])]);
}

// tags: boundary
#[test]
fn deleting_an_empty_board_tells_no_picture_change() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path(), Arc::new(FakeEngine::default()));
    let board = backend.create_board("Empty").unwrap();
    take(&events);
    backend.delete_board(&board.id, true).unwrap();
    assert!(image_changes(&take(&events)).is_empty());
}

// tags: scenario
#[test]
fn model_edits_and_removals_tell_the_pages_the_whole_list() {
    let dir = tempfile::tempdir().unwrap();
    let loras = dir.path().join("models").join("loras");
    std::fs::create_dir_all(&loras).unwrap();
    // The smallest safetensors file: the length of its header, then the header.
    let header = br#"{"__metadata__":{}}"#;
    let mut bytes = (header.len() as u64).to_le_bytes().to_vec();
    bytes.extend_from_slice(header);
    std::fs::write(loras.join("a.safetensors"), &bytes).unwrap();
    std::fs::write(loras.join("b.safetensors"), &bytes).unwrap();
    let (backend, events) = open(dir.path(), Arc::new(FakeEngine::default()));
    let models = backend.bootstrap().models;
    assert_eq!(models.len(), 2);
    take(&events);
    let models_of = |events: &[BackendEvent]| -> Vec<Vec<ModelConfig>> {
        events
            .iter()
            .filter_map(|e| match e {
                BackendEvent::ModelsChanged { models } => Some(models.clone()),
                _ => None,
            })
            .collect()
    };

    let edited = backend
        .update_model(&models[0].key, json!({ "name": "Renamed" }))
        .unwrap();
    let told = models_of(&take(&events));
    assert_eq!(told.len(), 1);
    assert!(told[0].contains(&edited));

    backend.delete_model(&models[1].key).unwrap();
    let told = models_of(&take(&events));
    assert_eq!(told.len(), 1);
    assert_eq!(
        told[0].iter().map(|m| m.key.clone()).collect::<Vec<_>>(),
        vec![models[0].key.clone()]
    );

    // A model that is not there changes nothing.
    backend.delete_model("missing").unwrap();
    assert!(models_of(&take(&events)).is_empty());
}

// tags: scenario
#[test]
fn saving_and_deleting_a_workflow_tells_the_pages_the_library() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path(), Arc::new(FakeEngine::default()));
    let ids_of = |events: &[BackendEvent]| -> Vec<Vec<String>> {
        events
            .iter()
            .filter_map(|e| match e {
                BackendEvent::WorkflowsChanged { workflows } => {
                    Some(workflows.iter().map(|w| w.id.clone()).collect())
                }
                _ => None,
            })
            .collect()
    };
    let saved = backend
        .save_workflow(serde_json::from_value(json!({ "name": "A", "graph": {} })).unwrap())
        .unwrap();
    let told = ids_of(&take(&events));
    assert_eq!(told.len(), 1);
    assert!(told[0].contains(&saved.id));

    // A refused save tells nothing.
    assert!(backend
        .save_workflow(serde_json::from_value(json!({ "name": "", "graph": {} })).unwrap())
        .is_err());
    assert!(ids_of(&take(&events)).is_empty());

    backend.delete_workflow(&saved.id).unwrap();
    let told = ids_of(&take(&events));
    assert_eq!(told.len(), 1);
    assert!(!told[0].contains(&saved.id));
}
