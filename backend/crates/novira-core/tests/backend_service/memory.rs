//! Running out of GPU memory: the failure kind, a smaller retry and low-memory mode.
use super::common::*;
use novira_core::types::*;
use novira_core::{Backend, BackendConfig, BackendError, Settings};
use std::sync::Arc;

#[tokio::test]
async fn an_out_of_memory_failure_is_marked_and_keeps_the_engine_text() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let key = main_key(&backend);
    tokio::spawn(backend.clone().run_worker());
    backend.enqueue(request(&key, "[oom] big", 1)).unwrap();
    backend.enqueue(request(&key, "[fail] other", 1)).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed; 2]).await;
    let items = backend.queue_snapshot().items;
    assert_eq!(items[0].error_kind, Some(QueueErrorKind::OutOfMemory));
    assert!(items[0]
        .error
        .as_deref()
        .is_some_and(|e| e.contains("CUDA out of memory")));
    assert_eq!(items[1].error_kind, None, "other failures have no kind");
    backend.shutdown();
}

#[tokio::test]
async fn a_smaller_retry_keeps_the_request_and_checks_the_size() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let key = main_key(&backend);
    tokio::spawn(backend.clone().run_worker());
    let failed = backend.enqueue(request(&key, "[oom] big", 1)).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed]).await;

    for (width, height) in [(0, 448), (448, 450), (520, 448), (448, 32)] {
        assert!(
            matches!(
                backend.retry_queue_item(failed[0].id, Some(RetrySize { width, height })),
                Err(BackendError::Invalid(_))
            ),
            "{width}x{height}"
        );
    }
    let retried = backend
        .retry_queue_item(
            failed[0].id,
            Some(RetrySize {
                width: 448,
                height: 448,
            }),
        )
        .unwrap()
        .unwrap();
    assert_eq!((retried.params.width, retried.params.height), (448, 448));
    assert_eq!(retried.params.seed, failed[0].params.seed);
    assert_eq!(retried.params.positive_prompt, "[oom] big");
    assert_eq!(retried.error_kind, None);
    backend.shutdown();
}

#[tokio::test]
async fn a_smaller_retry_is_only_for_pictures_made_at_a_size() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let key = main_key(&backend);
    let mut req = request(&key, "x", 1);
    req.params.generation_mode = GenerationMode::Upscale;
    let item = backend.enqueue(req).unwrap();
    backend.cancel_queue_item(item[0].id);
    let size = Some(RetrySize {
        width: 256,
        height: 256,
    });
    assert!(matches!(
        backend.retry_queue_item(item[0].id, size),
        Err(BackendError::Invalid(_))
    ));
    // Without a size it is an ordinary retry.
    assert!(backend
        .retry_queue_item(item[0].id, None)
        .unwrap()
        .is_some());
}

#[tokio::test]
async fn low_memory_mode_is_saved_and_restarts_a_running_engine() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(
        dir.path().join("settings.json"),
        r#"{"gpuLock":"","comfyuiArgs":["--fast"]}"#,
    )
    .unwrap();
    let engine = Arc::new(FakeEngine {
        running_low_memory: Some(false).into(),
        ..Default::default()
    });
    let (backend, _) = open(dir.path(), engine.clone());
    assert_eq!(
        backend.low_memory_mode(),
        LowMemoryMode {
            enabled: false,
            owned_engine: true,
            pending_restart: false
        }
    );
    let mode = backend.set_low_memory_mode(true).await.unwrap();
    assert!(mode.enabled && !mode.pending_restart);
    assert_eq!(*engine.restarts.lock().unwrap(), 1);
    assert_eq!(*engine.running_low_memory.lock().unwrap(), Some(true));
    let saved = Settings::load(dir.path()).unwrap();
    assert!(saved.low_memory_mode);
    assert_eq!(saved.comfyui_args, ["--fast"], "other settings are kept");
    // The same value again needs no restart.
    backend.set_low_memory_mode(true).await.unwrap();
    assert_eq!(*engine.restarts.lock().unwrap(), 1);
}

#[tokio::test]
async fn low_memory_mode_waits_for_the_next_start_while_a_job_runs() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let engine = Arc::new(FakeEngine {
        block: true,
        running_low_memory: Some(false).into(),
        ..Default::default()
    });
    let (backend, _) = open(dir.path(), engine.clone());
    let key = main_key(&backend);
    tokio::spawn(backend.clone().run_worker());
    let running = backend.enqueue(request(&key, "long", 1)).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::InProgress]).await;
    let mode = backend.set_low_memory_mode(true).await.unwrap();
    assert!(mode.enabled && mode.pending_restart);
    assert_eq!(*engine.restarts.lock().unwrap(), 0);
    assert!(*engine.low_memory.lock().unwrap(), "the next start uses it");
    backend.cancel_queue_item(running[0].id);
    backend.shutdown();
}

#[tokio::test]
async fn low_memory_mode_is_read_at_start_and_reported_for_an_external_server() {
    let dir = tempfile::tempdir().unwrap();
    let engine = Arc::new(FakeEngine {
        external: true,
        ..Default::default()
    });
    let backend = Backend::open_with_engine(
        BackendConfig {
            data_dir: dir.path().to_path_buf(),
            image_url_base: BASE.into(),
            settings: Settings {
                low_memory_mode: true,
                ..settings()
            },
        },
        engine.clone(),
    )
    .unwrap();
    assert!(*engine.low_memory.lock().unwrap());
    assert_eq!(
        backend.low_memory_mode(),
        LowMemoryMode {
            enabled: true,
            owned_engine: false,
            pending_restart: false
        }
    );
}
