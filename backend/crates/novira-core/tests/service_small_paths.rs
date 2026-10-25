//! Small paths of the backend service that the larger flows do not reach: marking pictures as intermediate, clearing the
//! queue while a job runs, and switching low-memory mode off again.
#![allow(dead_code)]
#[path = "backend_service/common.rs"]
mod common;

use common::*;
use novira_core::types::*;
use std::sync::Arc;

#[tokio::test]
async fn a_picture_can_be_marked_as_intermediate_after_the_fact() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let img = backend
        .upload_image(png(8, 8), ImageOptions::default())
        .await
        .unwrap();
    assert!(!img.is_intermediate);
    let patch: ImagePatch =
        serde_json::from_value(serde_json::json!({ "isIntermediate": true })).unwrap();
    let changed = backend
        .update_images(std::slice::from_ref(&img.name), patch)
        .unwrap();
    assert!(changed[0].is_intermediate);
}

#[tokio::test]
async fn clearing_the_queue_stops_the_job_that_is_running() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let engine = Arc::new(FakeEngine {
        block: true,
        ..Default::default()
    });
    let (backend, _) = open(dir.path(), engine);
    tokio::spawn(backend.clone().run_worker());
    let key = main_key(&backend);
    backend.enqueue(request(&key, "a cat", 1)).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::InProgress]).await;
    backend.clear_queue().unwrap();
    assert!(backend.queue_snapshot().items.is_empty());
}

#[tokio::test]
async fn low_memory_mode_can_be_turned_on_and_off_again() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert!(backend.set_low_memory_mode(true).await.unwrap().enabled);
    assert!(!backend.set_low_memory_mode(false).await.unwrap().enabled);
}
