//! Queue lifecycle: run order, failures, cancel and retry, restarts, prepending, pruning.
use super::common::*;
use novira_core::media::images;
use novira_core::types::*;
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;

#[tokio::test]
async fn queued_jobs_run_in_order_and_store_images_with_metadata() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let engine = Arc::new(FakeEngine::default());
    let (backend, events) = open(dir.path(), engine.clone());
    let boot = backend.bootstrap();
    let main = boot
        .models
        .iter()
        .find(|m| m.kind == ModelType::Main)
        .unwrap()
        .clone();
    let lora = boot
        .models
        .iter()
        .find(|m| m.kind == ModelType::Lora)
        .unwrap()
        .clone();
    assert_eq!(main.base, BaseModel::Sdxl);

    let mut req = request(&main.key, "a red fox", 2);
    req.params.loras = vec![
        LoraParam {
            key: lora.key.clone(),
            weight: 0.6,
            is_enabled: true,
        },
        LoraParam {
            key: "lora-disabled".into(),
            weight: 1.0,
            is_enabled: false,
        },
    ];
    let items = backend.enqueue(req).unwrap();
    assert_eq!(
        items.iter().map(|i| i.params.seed).collect::<Vec<_>>(),
        vec![10, 11]
    );
    tokio::spawn(backend.clone().run_worker());
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Completed; 2]).await;

    let jobs = engine.jobs.lock().unwrap().clone();
    assert_eq!(jobs.len(), 2);
    assert_eq!(jobs[0].checkpoint.name, "sdxl_base.safetensors");
    assert_eq!(jobs[0].loras.len(), 1, "disabled LoRAs are not sent");
    assert_eq!(jobs[0].loras[0].1, 0.6);

    let snapshot = backend.queue_snapshot();
    let first = &snapshot.items[0];
    let image = backend
        .bootstrap()
        .images
        .into_iter()
        .find(|i| Some(&i.name) == first.image_name.as_ref())
        .unwrap();
    assert_eq!((image.width, image.height), (64, 64));
    assert_eq!(image.url, format!("{BASE}/full/{}", image.name));
    let meta = image.metadata.unwrap();
    assert_eq!((meta.width, meta.height, meta.seed), (64, 64, 10));
    let (bytes, ct) = backend.read_image("full", &image.name).unwrap();
    assert_eq!(ct, "image/png");
    let embedded: GenerationMetadata =
        serde_json::from_str(&images::read_text(&bytes, images::METADATA_KEY).unwrap()).unwrap();
    assert_eq!(embedded.positive_prompt, "a red fox");
    assert!(backend.read_image("thumb", &image.name).is_some());

    let ev = events.lock().unwrap();
    assert!(ev
        .iter()
        .any(|e| matches!(e, BackendEvent::InvocationProgress { progress } if progress.step == 3)));
    let added = ev
        .iter()
        .filter(|e| matches!(e, BackendEvent::ImageAdded { item: Some(_), .. }))
        .count();
    assert_eq!(added, 2);
    // The completed status is sent before the image so the frontend can match them.
    let completed_at = ev.iter().position(|e| matches!(e, BackendEvent::QueueItemStatusChanged { item } if item.status == QueueItemStatus::Completed)).unwrap();
    let added_at = ev
        .iter()
        .position(|e| matches!(e, BackendEvent::ImageAdded { .. }))
        .unwrap();
    assert!(completed_at < added_at);
    backend.shutdown();
}

#[tokio::test]
async fn failures_cancels_pause_and_retry() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let engine = Arc::new(FakeEngine {
        block: true,
        ..Default::default()
    });
    let (backend, _events) = open(dir.path(), engine.clone());
    let key = backend
        .bootstrap()
        .models
        .iter()
        .find(|m| m.kind == ModelType::Main)
        .unwrap()
        .key
        .clone();
    tokio::spawn(backend.clone().run_worker());

    // An unknown model fails with a reason, before the engine is called.
    let bad = backend.enqueue(request("missing", "x", 1)).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed]).await;
    assert!(backend.queue_snapshot().items[0]
        .error
        .as_deref()
        .unwrap()
        .contains("not found"));
    assert!(engine.jobs.lock().unwrap().is_empty());

    // Cancel the running job.
    let running = backend.enqueue(request(&key, "x", 1)).unwrap();
    wait_until(|| statuses(&backend).last() == Some(&QueueItemStatus::InProgress)).await;
    backend.cancel_queue_item(running[0].id);
    wait_until(|| statuses(&backend).last() == Some(&QueueItemStatus::Canceled)).await;

    // Paused: nothing starts until resumed.
    backend.pause_processor();
    let waiting = backend.enqueue(request(&key, "[fail] y", 1)).unwrap();
    tokio::time::sleep(Duration::from_millis(100)).await;
    assert_eq!(statuses(&backend).last(), Some(&QueueItemStatus::Pending));
    assert!(backend.queue_snapshot().status.is_paused);
    backend.resume_processor();
    wait_until(|| statuses(&backend).last() == Some(&QueueItemStatus::Failed)).await;
    assert_eq!(
        backend
            .queue_snapshot()
            .items
            .last()
            .unwrap()
            .error
            .as_deref(),
        Some("engine failed")
    );

    // Retry creates a new item with the same parameters; pending items can't be retried.
    let retried = backend.retry_queue_item(bad[0].id, None).unwrap().unwrap();
    assert_eq!(retried.params.model_key, "missing");
    assert_ne!(retried.id, bad[0].id);
    assert!(backend
        .retry_queue_item(waiting[0].id + 100, None)
        .unwrap()
        .is_none());

    // Prune keeps only active items; clear removes everything.
    wait_until(|| statuses(&backend).last() == Some(&QueueItemStatus::Failed)).await;
    backend.prune_queue().unwrap();
    assert!(backend.queue_snapshot().items.is_empty());
    backend.clear_queue().unwrap();
    assert_eq!(backend.queue_snapshot().status.total, 0);
    backend.shutdown();
}

#[tokio::test]
async fn state_survives_a_restart_and_unfinished_jobs_are_not_resumed_silently() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let board = backend.create_board("Cats").unwrap();
    let uploaded = backend
        .upload_image(
            png(30, 20),
            ImageOptions {
                board_id: Some(board.id.clone()),
                is_intermediate: None,
                category: Some(ImageCategory::User),
            },
        )
        .await
        .unwrap();
    assert_eq!(
        (uploaded.width, uploaded.height, uploaded.category),
        (30, 20, ImageCategory::User)
    );
    backend
        .update_images(
            std::slice::from_ref(&uploaded.name),
            serde_json::from_value(json!({ "starred": true })).unwrap(),
        )
        .unwrap();
    let wf = backend
        .save_workflow(
            serde_json::from_value(json!({ "name": "W", "graph": { "nodes": [] } })).unwrap(),
        )
        .unwrap();
    let model = backend
        .bootstrap()
        .models
        .into_iter()
        .find(|m| m.kind == ModelType::Lora)
        .unwrap();
    backend
        .update_model(
            &model.key,
            json!({ "name": "Detail", "triggerPhrases": ["detailed"], "path": "C:/evil" }),
        )
        .unwrap();
    let key = backend
        .bootstrap()
        .models
        .iter()
        .find(|m| m.kind == ModelType::Main)
        .unwrap()
        .key
        .clone();
    backend.enqueue(request(&key, "later", 1)).unwrap();
    drop(backend);

    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let boot = backend.bootstrap();
    assert_eq!(boot.boards, vec![board.clone()]);
    let img = &boot.images[0];
    assert!(img.starred && img.board_id.as_deref() == Some(board.id.as_str()));
    assert_eq!(boot.workflows[0].id, wf.id);
    let m = boot.models.iter().find(|m| m.key == model.key).unwrap();
    assert_eq!(m.name, "Detail");
    assert_eq!(
        m.trigger_phrases.as_deref(),
        Some(&["detailed".to_string()][..])
    );
    assert_ne!(m.path, "C:/evil", "file facts cannot be patched");
    // The pending job is kept but the processor starts paused.
    assert_eq!(boot.queue.status.pending, 1);
    assert!(boot.queue.status.is_paused);

    // Deleting the board can keep or delete its images.
    assert!(backend.delete_board(&board.id, false).unwrap().is_empty());
    assert_eq!(backend.bootstrap().images[0].board_id, None);
    backend
        .delete_images(std::slice::from_ref(&img.name))
        .unwrap();
    assert!(backend.read_image("full", &img.name).is_none());
}

#[tokio::test]
async fn prepended_batches_go_before_the_first_pending_item_and_seeds_wrap() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path(), Arc::new(FakeEngine::default()));
    // No worker runs: everything stays pending.
    let first = backend.enqueue(request("m", "first", 2)).unwrap();
    let mut front = request("m", "front", 1);
    front.prepend = true;
    let front = backend.enqueue(front).unwrap();
    let prompts: Vec<String> = backend
        .queue_snapshot()
        .items
        .iter()
        .map(|q| q.params.positive_prompt.clone())
        .collect();
    assert_eq!(prompts, ["front", "first", "first"]);
    assert!(front[0].id > first[1].id, "ids keep increasing");
    assert_ne!(front[0].batch_id, first[0].batch_id);
    assert_eq!(first[0].batch_id, first[1].batch_id);
    let announced = events
        .lock()
        .unwrap()
        .iter()
        .filter(|e| matches!(e, BackendEvent::QueueItemStatusChanged { item } if item.status == QueueItemStatus::Pending))
        .count();
    assert_eq!(announced, 3, "each new item is announced");

    // Zero iterations still make one item. MAX_SEED itself is a valid seed (the UI
    // allows it), so the seed steps through it and only then wraps to 0.
    let mut wrap = request("m", "wrap", 0);
    wrap.params.seed = novira_core::service::MAX_SEED;
    let single = backend.enqueue(wrap.clone()).unwrap();
    assert_eq!(single.len(), 1);
    assert_eq!(single[0].params.seed, novira_core::service::MAX_SEED);
    wrap.params.seed = novira_core::service::MAX_SEED - 1;
    wrap.iterations = 3;
    let seeds: Vec<u64> = backend
        .enqueue(wrap)
        .unwrap()
        .iter()
        .map(|q| q.params.seed)
        .collect();
    assert_eq!(
        seeds,
        [
            novira_core::service::MAX_SEED - 1,
            novira_core::service::MAX_SEED,
            0
        ]
    );

    let mut random = request("m", "random", 5);
    random.randomize_seed = true;
    let seeds: Vec<u64> = backend
        .enqueue(random)
        .unwrap()
        .iter()
        .map(|q| q.params.seed)
        .collect();
    assert!(seeds.iter().all(|s| *s <= novira_core::service::MAX_SEED));
    assert!(
        seeds.iter().any(|s| *s != seeds[0]),
        "random seeds differ: {seeds:?}"
    );
}

#[tokio::test]
async fn a_request_for_more_iterations_than_the_queue_takes_is_refused_at_the_limit_not_past_it() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    // An unbounded count would make one item per number before anything else is checked.
    let err = backend
        .enqueue(request("m", "huge", u32::MAX))
        .unwrap_err()
        .to_string();
    assert!(err.contains("At most 1000 iterations"), "{err}");
    assert!(backend.queue_snapshot().items.is_empty());
    let items = backend.enqueue(request("m", "limit", 1000)).unwrap();
    assert_eq!(items.len(), 1000);
}

#[tokio::test]
async fn cancel_touches_only_active_items_and_a_batch_cancels_together() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let batch = backend.enqueue(request("m", "a", 2)).unwrap();
    let other = backend.enqueue(request("m", "b", 1)).unwrap();
    backend.cancel_batch(&batch[0].batch_id);
    assert_eq!(
        statuses(&backend),
        [
            QueueItemStatus::Canceled,
            QueueItemStatus::Canceled,
            QueueItemStatus::Pending
        ]
    );
    let canceled = &backend.queue_snapshot().items[0];
    assert!(canceled.completed_at.is_some());
    // A finished item cannot be canceled again, and unknown ids are ignored.
    let before = canceled.completed_at;
    backend.cancel_queue_item(batch[0].id);
    backend.cancel_queue_item(9999);
    assert_eq!(backend.queue_snapshot().items[0].completed_at, before);
    // Retrying a canceled item queues a copy with the same seed at the end.
    let retried = backend
        .retry_queue_item(batch[1].id, None)
        .unwrap()
        .unwrap();
    assert_eq!(retried.params.seed, batch[1].params.seed);
    assert_eq!(retried.status, QueueItemStatus::Pending);
    assert!(backend
        .retry_queue_item(other[0].id, None)
        .unwrap()
        .is_none());

    let status = backend.queue_snapshot().status;
    assert_eq!((status.pending, status.canceled, status.total), (2, 2, 4));
}

#[tokio::test]
async fn pruned_and_cleared_items_stay_gone_after_a_restart() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, events) = open(dir.path(), Arc::new(FakeEngine::default()));
    let done = backend.enqueue(request("m", "done", 1)).unwrap();
    let waiting = backend.enqueue(request("m", "waiting", 1)).unwrap();
    backend.cancel_queue_item(done[0].id);
    backend.prune_queue().unwrap();
    let left = events.lock().unwrap().iter().rev().find_map(|e| match e {
        BackendEvent::QueueCleared { items } => Some(items.clone()),
        _ => None,
    });
    assert_eq!(
        left.unwrap().iter().map(|q| q.id).collect::<Vec<_>>(),
        [waiting[0].id],
        "the event carries what is left"
    );
    drop(backend);

    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let ids: Vec<u64> = backend
        .queue_snapshot()
        .items
        .iter()
        .map(|q| q.id)
        .collect();
    assert_eq!(ids, [waiting[0].id]);
    let next = backend.enqueue(request("m", "next", 1)).unwrap();
    assert!(next[0].id > waiting[0].id, "ids are not reused");
    backend.clear_queue().unwrap();
    drop(backend);

    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    assert!(backend.queue_snapshot().items.is_empty());
    assert!(
        !backend.queue_snapshot().status.is_paused,
        "nothing waits, so the processor is not paused"
    );
}
