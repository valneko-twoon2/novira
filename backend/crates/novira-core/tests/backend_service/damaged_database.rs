//! A database whose index pages were damaged after it was written: the backend reports the failed writes to its caller
//! (or logs them where nobody is waiting) instead of pretending they worked. Only the indexes are damaged, so the rows
//! can still be read when the backend starts.
use super::common::*;
use novira_core::db::Table;
use novira_core::types::*;
use std::io::{Seek, SeekFrom, Write};
use std::path::Path;
use std::sync::Arc;

const PAGE: u64 = 4096;

/// The page of the index SQLite keeps for the `id` column of a table (two pages per table, created in this order).
fn index_page(table: Table) -> u64 {
    match table {
        Table::Boards => 3,
        Table::Images => 5,
        Table::Workflows => 7,
        Table::Models => 9,
        Table::Queue => 11,
        Table::Comics => 13,
        Table::Watermarks => 15,
        Table::Trash => 17,
    }
}

pub(crate) fn damage_index(dir: &Path, table: Table) {
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .open(dir.join("novira.sqlite"))
        .unwrap();
    file.seek(SeekFrom::Start((index_page(table) - 1) * PAGE))
        .unwrap();
    file.write_all(&[0xff; PAGE as usize]).unwrap();
}

#[tokio::test]
async fn images_that_cannot_be_saved_to_the_database_fail_the_calls_that_change_them() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let board = backend.create_board("Cats").unwrap();
    let image = backend
        .upload_image(
            png(8, 8),
            ImageOptions {
                board_id: Some(board.id.clone()),
                ..ImageOptions::default()
            },
        )
        .await
        .unwrap();
    backend.shutdown();
    drop(backend);
    damage_index(dir.path(), Table::Images);

    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    // Changing a picture needs to write its row.
    let patch = ImagePatch {
        starred: Some(true),
        ..ImagePatch::default()
    };
    let err = backend
        .update_images(std::slice::from_ref(&image.name), patch)
        .unwrap_err();
    assert!(err.to_string().contains("database error"), "{err}");
    // Deleting a board moves its pictures out of it, which needs to write them; the board row itself could go.
    let err = backend.delete_board(&board.id, false).unwrap_err();
    assert!(err.to_string().contains("database error"), "{err}");
    backend.shutdown();
}

#[tokio::test]
async fn a_queue_that_cannot_be_saved_fails_new_jobs_and_a_status_change_is_only_logged() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let key = main_key(&backend);
    // One job waits in the queue (no worker runs yet) and is saved.
    backend.enqueue(request(&key, "waiting", 1)).unwrap();
    backend.shutdown();
    drop(backend);
    damage_index(dir.path(), Table::Queue);

    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    // A new job cannot be saved, so the call fails.
    let err = backend.enqueue(request(&key, "new", 1)).unwrap_err();
    assert!(err.to_string().contains("database error"), "{err}");
    // The refused job is not left in the queue (it would run although the caller was told it failed).
    assert_eq!(statuses(&backend).len(), 1);
    // Cancelling the saved job works although the new status cannot be saved (that is logged; nobody is waiting).
    backend.cancel_queue_item(1);
    assert_eq!(statuses(&backend)[0], QueueItemStatus::Canceled);
    backend.shutdown();
}

#[test]
fn models_that_cannot_be_saved_stop_the_backend_from_starting() {
    let dir = tempfile::tempdir().unwrap();
    {
        let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
        backend.shutdown();
    }
    damage_index(dir.path(), Table::Models);
    write_lora_and_checkpoint(&dir.path().join("models"));
    let result = novira_core::Backend::open_with_engine(
        novira_core::BackendConfig {
            data_dir: dir.path().to_path_buf(),
            image_url_base: BASE.into(),
            settings: settings(),
        },
        Arc::new(FakeEngine::default()),
    );
    let Err(err) = result else {
        panic!("the backend should not start");
    };
    assert!(err.to_string().contains("database error"), "{err}");
}

/// The page of the index of the `meta` table (created after the eight tables).
const META_INDEX_PAGE: u64 = 19;

fn damage_meta(dir: &Path) {
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .open(dir.join("novira.sqlite"))
        .unwrap();
    file.seek(SeekFrom::Start((META_INDEX_PAGE - 1) * PAGE))
        .unwrap();
    file.write_all(&[0xff; PAGE as usize]).unwrap();
}

/// Runs `seed` on a healthy backend, closes it, damages the index of `table` and starts a backend again.
pub(crate) fn damaged_after(
    dir: &Path,
    table: Table,
    seed: impl FnOnce(&novira_core::Backend),
) -> novira_core::Backend {
    let (backend, _) = open(dir, Arc::new(FakeEngine::default()));
    seed(&backend);
    backend.shutdown();
    drop(backend);
    damage_index(dir, table);
    open(dir, Arc::new(FakeEngine::default())).0
}

fn db_error(err: impl std::fmt::Display) -> bool {
    err.to_string().contains("database error")
}

#[test]
fn boards_that_cannot_be_saved_fail_the_calls_that_change_them() {
    let dir = tempfile::tempdir().unwrap();
    let mut board_id = String::new();
    let backend = damaged_after(dir.path(), Table::Boards, |b| {
        board_id = b.create_board("Cats").unwrap().id;
    });
    assert!(db_error(backend.create_board("Dogs").unwrap_err()));
    let patch = BoardPatch {
        name: Some("Kittens".into()),
        archived: None,
    };
    assert!(db_error(
        backend.update_board(&board_id, patch).unwrap_err()
    ));
    assert!(db_error(
        backend.delete_board(&board_id, false).unwrap_err()
    ));
    backend.shutdown();
}

#[tokio::test]
async fn workflows_that_cannot_be_saved_fail_the_calls_that_change_them() {
    let dir = tempfile::tempdir().unwrap();
    let input = |name: &str| WorkflowInput {
        id: None,
        name: name.into(),
        description: String::new(),
        author: String::new(),
        tags: vec![],
        graph: serde_json::json!({}),
    };
    let mut saved_id = String::new();
    let backend = damaged_after(dir.path(), Table::Workflows, |b| {
        saved_id = b.save_workflow(input("First")).unwrap().id;
    });
    assert!(db_error(
        backend.save_workflow(input("Second")).unwrap_err()
    ));
    // The database is written first: a save that fails does not leave the workflow in the list in memory.
    assert!(backend
        .bootstrap()
        .workflows
        .iter()
        .all(|w| w.name != "Second"));
    assert!(db_error(backend.delete_workflow(&saved_id).unwrap_err()));
    // ... and a delete that fails does not drop it.
    assert!(backend
        .bootstrap()
        .workflows
        .iter()
        .any(|w| w.id == saved_id));
    backend.shutdown();
}

#[tokio::test]
async fn pictures_that_cannot_be_saved_fail_the_upload_and_the_delete() {
    let dir = tempfile::tempdir().unwrap();
    let mut name = String::new();
    let backend = damaged_after(dir.path(), Table::Images, |_| {});
    let err = backend
        .upload_image(png(8, 8), ImageOptions::default())
        .await
        .unwrap_err();
    assert!(db_error(err));
    name.push_str("none.png");
    assert!(db_error(backend.delete_images(&[name]).unwrap_err()));
    backend.shutdown();
}

#[tokio::test]
async fn a_queue_that_cannot_be_changed_fails_clearing_and_pruning() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let backend = damaged_after(dir.path(), Table::Queue, |b| {
        let id = b.enqueue(request(&main_key(b), "x", 1)).unwrap()[0].id;
        b.cancel_queue_item(id);
    });
    assert_eq!(statuses(&backend), vec![QueueItemStatus::Canceled]);
    assert!(db_error(backend.prune_queue().unwrap_err()));
    assert!(db_error(backend.clear_queue().unwrap_err()));
    backend.shutdown();
}

#[test]
fn a_model_record_that_cannot_be_saved_fails_editing_and_deleting() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let backend = damaged_after(dir.path(), Table::Models, |_| {});
    // Opening with damaged model indexes works when no model needs saving: the records are the same as before.
    let model = backend.bootstrap().models.remove(0);
    let err = backend
        .update_model(&model.key, serde_json::json!({"name": "Renamed"}))
        .unwrap_err();
    assert!(db_error(err));
    assert!(db_error(backend.delete_model(&model.key).unwrap_err()));
    backend.shutdown();
}

#[test]
fn a_database_whose_settings_table_is_damaged_does_not_start() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    backend.shutdown();
    drop(backend);
    damage_meta(dir.path());
    let result = novira_core::Backend::open_with_engine(
        novira_core::BackendConfig {
            data_dir: dir.path().to_path_buf(),
            image_url_base: BASE.into(),
            settings: settings(),
        },
        Arc::new(FakeEngine::default()),
    );
    let Err(err) = result else {
        panic!("the backend should not start");
    };
    assert!(db_error(err));
}

#[test]
fn a_job_that_was_running_when_the_app_stopped_and_cannot_be_marked_interrupted_stops_the_start() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    backend
        .enqueue(request(&main_key(&backend), "x", 1))
        .unwrap();
    backend.shutdown();
    drop(backend);
    // The saved job says it was running (the app was killed) ...
    let mut db = novira_core::db::Db::open(dir.path()).unwrap();
    let mut items: Vec<QueueItem> = db.load(Table::Queue).unwrap();
    items[0].status = QueueItemStatus::InProgress;
    db.put_many(
        Table::Queue,
        items
            .iter()
            .map(|q| (q.id.to_string(), q.id as i64, q))
            .collect::<Vec<_>>()
            .iter()
            .map(|(id, n, q)| (id.as_str(), *n, *q)),
    )
    .unwrap();
    drop(db);
    // ... and cannot be rewritten as interrupted.
    damage_index(dir.path(), Table::Queue);
    let result = novira_core::Backend::open_with_engine(
        novira_core::BackendConfig {
            data_dir: dir.path().to_path_buf(),
            image_url_base: BASE.into(),
            settings: settings(),
        },
        Arc::new(FakeEngine::default()),
    );
    let Err(err) = result else {
        panic!("the backend should not start");
    };
    assert!(db_error(err));
}

#[tokio::test]
async fn a_result_that_cannot_be_recorded_in_the_gallery_fails_the_job() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let backend = damaged_after(dir.path(), Table::Images, |_| {});
    tokio::spawn(backend.clone().run_worker());
    backend
        .enqueue(request(&main_key(&backend), "x", 1))
        .unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed]).await;
    let error = backend.queue_snapshot().items.remove(0).error.unwrap();
    assert!(error.contains("database error"), "{error}");
    backend.shutdown();
}

fn damage_page(dir: &Path, page: u64) {
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .open(dir.join("novira.sqlite"))
        .unwrap();
    file.seek(SeekFrom::Start((page - 1) * PAGE)).unwrap();
    file.write_all(&[0xff; PAGE as usize]).unwrap();
}

fn start(dir: &Path) -> novira_core::service::Result<novira_core::Backend> {
    novira_core::Backend::open_with_engine(
        novira_core::BackendConfig {
            data_dir: dir.to_path_buf(),
            image_url_base: BASE.into(),
            settings: settings(),
        },
        Arc::new(FakeEngine::default()),
    )
}

#[test]
fn a_backend_does_not_start_on_a_table_that_cannot_be_read() {
    // The first page of each table: boards, images, workflows, models, queue.
    for page in [2, 4, 6, 8, 10] {
        let dir = tempfile::tempdir().unwrap();
        let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
        backend.shutdown();
        drop(backend);
        damage_page(dir.path(), page);
        let Err(err) = start(dir.path()) else {
            panic!("page {page}: the backend should not start");
        };
        assert!(db_error(err), "page {page}");
    }
}

#[test]
fn a_backend_does_not_start_when_its_folders_are_taken_by_files() {
    // The data folder itself is a file.
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("data");
    std::fs::write(&file, b"a file").unwrap();
    assert!(start(&file).is_err());
    // The gallery folder is a file (the database opens, the pictures cannot be stored).
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("outputs"), b"a file").unwrap();
    assert!(start(dir.path()).is_err());
}
