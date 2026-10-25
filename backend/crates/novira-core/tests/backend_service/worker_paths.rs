//! Paths of the queue worker that the usual runs do not take: a job that takes a free GPU lock and gives it back.
use super::common::*;
use novira_core::types::*;
use novira_core::{Backend, BackendConfig, Settings};
use std::path::Path;
use std::sync::Arc;

fn open_with_lock(dir: &Path, lock: &Path) -> Backend {
    Backend::open_with_engine(
        BackendConfig {
            data_dir: dir.to_path_buf(),
            image_url_base: BASE.into(),
            settings: Settings {
                gpu_lock: lock.to_string_lossy().into_owned(),
                ..settings()
            },
        },
        Arc::new(FakeEngine::default()),
    )
    .unwrap()
}

#[tokio::test]
async fn a_job_takes_a_free_gpu_lock_and_gives_it_back_when_it_is_done() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let lock = dir.path().join("gpu.lock");
    let backend = open_with_lock(dir.path(), &lock);
    tokio::spawn(backend.clone().run_worker());
    backend
        .enqueue(request(&main_key(&backend), "a cat", 1))
        .unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Completed]).await;
    wait_until(|| !lock.exists()).await;
    backend.shutdown();
}
