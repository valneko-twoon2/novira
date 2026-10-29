//! The trash of the gallery at its edges: pictures that waited too long, a trashed file that is gone, and a trash or
//! gallery table that can no longer be written.
use super::common::*;
use novira_core::db::{Table, DB_FILE};
use novira_core::types::*;
use std::path::Path;
use std::sync::Arc;

async fn upload(b: &novira_core::Backend) -> String {
    b.upload_image(png(8, 8), ImageOptions::default())
        .await
        .unwrap()
        .name
}

fn db_error(err: impl std::fmt::Display) -> bool {
    err.to_string().contains("database error")
}

/// Makes every trashed picture look as if it was deleted at `at` (milliseconds).
fn trashed_at(dir: &Path, at: i64) {
    let conn = rusqlite::Connection::open(dir.join(DB_FILE)).unwrap();
    let rows: Vec<(String, String)> = {
        let mut stmt = conn.prepare("SELECT id, data FROM trash").unwrap();
        stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap()
            .map(Result::unwrap)
            .collect()
    };
    assert!(!rows.is_empty());
    for (id, data) in rows {
        let mut v: serde_json::Value = serde_json::from_str(&data).unwrap();
        v["trashed_at"] = serde_json::json!(at);
        conn.execute(
            "UPDATE trash SET data = ?1 WHERE id = ?2",
            rusqlite::params![v.to_string(), id],
        )
        .unwrap();
    }
}

#[tokio::test]
async fn a_picture_that_waited_in_the_trash_too_long_is_deleted_for_good_by_the_next_delete() {
    let dir = tempfile::tempdir().unwrap();
    let old = {
        let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
        let old = upload(&backend).await;
        backend.delete_images(std::slice::from_ref(&old)).unwrap();
        backend.shutdown();
        old
    };
    trashed_at(dir.path(), 1);
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert!(dir.path().join("trash").join(&old).exists());
    let newer = upload(&backend).await;
    backend.delete_images(std::slice::from_ref(&newer)).unwrap();
    assert!(!dir.path().join("trash").join(&old).exists());
    assert!(dir.path().join("trash").join(&newer).exists());
    // The purged one cannot come back; the newer one can.
    assert!(backend
        .restore_images(std::slice::from_ref(&old))
        .unwrap()
        .is_empty());
    assert_eq!(
        backend
            .restore_images(std::slice::from_ref(&newer))
            .unwrap()
            .len(),
        1
    );
    backend.shutdown();
}

#[tokio::test]
async fn a_trashed_picture_whose_file_is_gone_is_left_out_of_a_restore() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let name = upload(&backend).await;
    backend.delete_images(std::slice::from_ref(&name)).unwrap();
    std::fs::remove_file(dir.path().join("trash").join(&name)).unwrap();
    assert!(backend
        .restore_images(std::slice::from_ref(&name))
        .unwrap()
        .is_empty());
    assert!(backend.bootstrap().images.is_empty());
    backend.shutdown();
}

/// Starts a backend again after the index of `table` was damaged; `seed` runs before, on a healthy one.
async fn reopened_damaged(
    dir: &Path,
    table: Table,
    seed_trashed: usize,
    seed_kept: usize,
) -> (novira_core::Backend, Vec<String>, Vec<String>) {
    let (backend, _) = open(dir, Arc::new(FakeEngine::default()));
    let mut trashed = Vec::new();
    let mut kept = Vec::new();
    for _ in 0..seed_trashed {
        let name = upload(&backend).await;
        backend.delete_images(std::slice::from_ref(&name)).unwrap();
        trashed.push(name);
    }
    for _ in 0..seed_kept {
        kept.push(upload(&backend).await);
    }
    backend.shutdown();
    drop(backend);
    super::damaged_database::damage_index(dir, table);
    (open(dir, Arc::new(FakeEngine::default())).0, trashed, kept)
}

#[tokio::test]
async fn a_trash_or_gallery_table_that_cannot_be_written_fails_delete_and_restore() {
    // The trash table: the delete fails before the picture leaves the gallery table.
    let dir = tempfile::tempdir().unwrap();
    let (backend, _, kept) = reopened_damaged(dir.path(), Table::Trash, 0, 1).await;
    assert!(db_error(backend.delete_images(&kept).unwrap_err()));
    backend.shutdown();

    // The gallery table: the picture reaches the trash table, then leaving the gallery table fails.
    let dir = tempfile::tempdir().unwrap();
    let (backend, _, kept) = reopened_damaged(dir.path(), Table::Images, 0, 1).await;
    assert!(db_error(backend.delete_images(&kept).unwrap_err()));
    backend.shutdown();

    // A restore cannot write the picture back into the damaged gallery table.
    let dir = tempfile::tempdir().unwrap();
    let (backend, trashed, _) = reopened_damaged(dir.path(), Table::Images, 1, 0).await;
    assert!(db_error(backend.restore_images(&trashed).unwrap_err()));
    backend.shutdown();
}
