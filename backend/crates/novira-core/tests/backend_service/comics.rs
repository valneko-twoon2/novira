//! Comic projects are kept in the database: they survive a restart, and bad ones are refused without touching the saved ones.
use super::common::*;
use novira_core::service::comics::MAX_COMIC_BYTES;
use serde_json::json;
use std::sync::Arc;

#[test]
fn the_comics_survive_a_restart_and_bad_ones_are_refused() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert!(backend.list_comics().unwrap().is_empty());
    backend
        .save_comic("comic-1", json!({"title": "First", "pages": []}))
        .unwrap();
    backend
        .save_comic("comic_2", json!({"title": "Second"}))
        .unwrap();
    assert!(backend.save_comic("", json!({})).is_err(), "an empty id");
    assert!(
        backend.save_comic("comic 3", json!({})).is_err(),
        "a space in the id"
    );
    assert!(
        backend.save_comic("a/b", json!({})).is_err(),
        "a slash in the id"
    );
    assert!(
        backend.save_comic(&"x".repeat(65), json!({})).is_err(),
        "an id over 64 characters"
    );
    assert!(
        backend
            .save_comic("comic-1", json!(["not", "an", "object"]))
            .is_err(),
        "only an object"
    );
    let huge = json!({ "x": "a".repeat(MAX_COMIC_BYTES) });
    assert!(
        backend.save_comic("comic-1", huge).is_err(),
        "over the size limit"
    );
    drop(backend);

    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let comics = backend.list_comics().unwrap();
    assert_eq!(comics.len(), 2);
    let first = comics.iter().find(|c| c.id == "comic-1").unwrap();
    assert_eq!(
        first.document,
        json!({"title": "First", "pages": []}),
        "refused saves leave the last good one"
    );
    backend.delete_comic("comic_2").unwrap();
    drop(backend);

    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let ids: Vec<String> = backend
        .list_comics()
        .unwrap()
        .into_iter()
        .map(|c| c.id)
        .collect();
    assert_eq!(ids, ["comic-1"], "a deleted comic stays deleted");
}
