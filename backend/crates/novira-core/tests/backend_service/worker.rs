//! Worker: result destinations, early failures, and jobs interrupted by closing the app.
use super::common::*;
use novira_core::media::images;
use novira_core::types::*;
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;

#[tokio::test]
async fn enqueue_refuses_source_images_that_are_not_stored() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let mut req = request("m", "x", 1);
    req.init_image_url = Some("https://example.com/a.png".into());
    assert!(backend.enqueue(req).is_err());
}

#[tokio::test]
async fn results_for_the_canvas_or_drafts_are_hidden_and_gallery_results_keep_their_board() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let key = main_key(&backend);
    let board = backend.create_board("Board").unwrap();
    tokio::spawn(backend.clone().run_worker());

    let mut to_gallery = request(&key, "gallery", 1);
    to_gallery.board_id = Some(board.id.clone());
    to_gallery.workflow = Some(json!({ "nodes": [1] }));
    let mut to_canvas = to_gallery.clone();
    to_canvas.destination = QueueDestination::Canvas;
    let mut draft = to_gallery.clone();
    draft.params.draft_at = Some(0.5);
    let ids: Vec<u64> = [to_gallery, to_canvas, draft]
        .into_iter()
        .map(|r| backend.enqueue(r).unwrap()[0].id)
        .collect();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Completed; 3]).await;

    let snapshot = backend.queue_snapshot();
    let images = backend.bootstrap().images;
    let image_of = |id: u64| {
        let name = snapshot
            .items
            .iter()
            .find(|q| q.id == id)
            .unwrap()
            .image_name
            .clone()
            .unwrap();
        images.iter().find(|i| i.name == name).unwrap().clone()
    };
    let gallery = image_of(ids[0]);
    assert!(!gallery.is_intermediate);
    assert_eq!(gallery.board_id.as_deref(), Some(board.id.as_str()));
    assert_eq!(gallery.workflow, Some(json!({ "nodes": [1] })));
    let (bytes, _) = backend.read_image("full", &gallery.name).unwrap();
    assert_eq!(
        images::read_text(&bytes, images::WORKFLOW_KEY).as_deref(),
        Some(r#"{"nodes":[1]}"#),
        "the workflow is embedded in the PNG"
    );
    let canvas = image_of(ids[1]);
    assert!(canvas.is_intermediate);
    assert_eq!(
        canvas.board_id, None,
        "canvas results are not filed on a board"
    );
    let draft = image_of(ids[2]);
    assert!(draft.is_intermediate);
    assert_eq!(draft.board_id.as_deref(), Some(board.id.as_str()));
    backend.shutdown();
}

#[tokio::test]
async fn a_hires_fix_resolves_its_upscale_model_and_stores_the_first_pass_size() {
    let dir = tempfile::tempdir().unwrap();
    let models = dir.path().join("models");
    write_lora_and_checkpoint(&models);
    std::fs::create_dir_all(models.join("upscale_models")).unwrap();
    std::fs::write(models.join("upscale_models").join("4x-test.pth"), b"x").unwrap();
    let engine = Arc::new(FakeEngine::default());
    let (backend, _) = open(dir.path(), engine.clone());
    let key = main_key(&backend);
    let upscaler = backend
        .bootstrap()
        .models
        .into_iter()
        .find(|m| m.name.contains("4x-test"))
        .expect("the upscale model is listed")
        .key;
    tokio::spawn(backend.clone().run_worker());
    let hires = |model: Option<String>| HiresFix {
        scale: 1.5,
        strength: 0.45,
        upscale_model_key: model,
        steps: None,
    };
    let mut with_model = request(&key, "hires", 1);
    with_model.params.hires_fix = Some(hires(Some(upscaler.clone())));
    let mut unknown = request(&key, "hires unknown", 1);
    unknown.params.hires_fix = Some(hires(Some("no-such-upscaler".into())));
    backend.enqueue(with_model).unwrap();
    backend.enqueue(unknown).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Completed, QueueItemStatus::Failed])
        .await;
    let job = engine.jobs.lock().unwrap()[0].clone();
    assert_eq!(
        job.upscale_model.map(|r| r.name),
        Some("4x-test.pth".to_string())
    );
    let image = backend.bootstrap().images.remove(0);
    // The picture is the enlarged one; its settings keep the size the scale applies to.
    assert_eq!((image.width, image.height), (96, 96));
    let meta = image.metadata.unwrap();
    assert_eq!((meta.width, meta.height), (512, 512));
    assert_eq!(meta.hires_fix.map(|h| h.scale), Some(1.5));
    let error = backend.queue_snapshot().items[1].error.clone().unwrap();
    assert!(error.contains("Upscale model not found"), "{error}");
    // Image to image resolves the fix's model too.
    let mut over = request(&key, "hires over a picture", 1);
    over.params.generation_mode = GenerationMode::Img2img;
    over.params.strength = Some(0.6);
    over.params.hires_fix = Some(hires(Some(upscaler)));
    over.init_image_url = Some(image.url.clone());
    backend.enqueue(over).unwrap();
    wait_until(|| {
        statuses(&backend).len() == 3 && statuses(&backend)[2] == QueueItemStatus::Completed
    })
    .await;
    let job = engine.jobs.lock().unwrap()[1].clone();
    assert_eq!(
        job.upscale_model.map(|r| r.name),
        Some("4x-test.pth".to_string())
    );
    backend.shutdown();
}

#[tokio::test]
async fn jobs_the_engine_refuses_or_with_unknown_models_fail_before_generating() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let engine = Arc::new(FakeEngine {
        reject: true,
        ..Default::default()
    });
    let (backend, _) = open(dir.path(), engine.clone());
    let key = main_key(&backend);
    tokio::spawn(backend.clone().run_worker());
    backend.enqueue(request(&key, "refused", 1)).unwrap();
    let mut bad_vae = request(&key, "vae", 1);
    bad_vae.params.vae_key = Some("no-such-vae".into());
    backend.enqueue(bad_vae).unwrap();
    let mut gone_source = request(&key, "img2img", 1);
    gone_source.params.generation_mode = GenerationMode::Img2img;
    gone_source.init_image_url = Some(format!("{BASE}/full/{}", images::new_name()));
    backend.enqueue(gone_source).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed; 3]).await;
    let errors: Vec<String> = backend
        .queue_snapshot()
        .items
        .into_iter()
        .map(|q| q.error.unwrap())
        .collect();
    assert_eq!(errors[0], "unknown sampler");
    assert!(errors[1].contains("VAE model not found"), "{errors:?}");
    assert!(errors[2].contains("Source image was deleted"), "{errors:?}");
    assert!(engine.jobs.lock().unwrap().is_empty());
    backend.shutdown();
}

#[tokio::test]
async fn closing_the_app_marks_the_running_job_as_interrupted() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let engine = Arc::new(FakeEngine {
        block: true,
        ..Default::default()
    });
    let (backend, _) = open(dir.path(), engine);
    let key = main_key(&backend);
    let worker = tokio::spawn(backend.clone().run_worker());
    backend.enqueue(request(&key, "long", 1)).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::InProgress]).await;

    // A second start while the job still runs (as after a crash) does not resume it silently.
    let (crashed, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let item = crashed.queue_snapshot().items[0].clone();
    assert_eq!(item.status, QueueItemStatus::Failed);
    assert!(item.error.unwrap().contains("Interrupted"));
    assert!(item.completed_at.is_some());
    drop(crashed);

    backend.shutdown();
    tokio::time::timeout(Duration::from_secs(5), worker)
        .await
        .expect("the worker stops on shutdown")
        .unwrap();
    let item = backend.queue_snapshot().items[0].clone();
    assert_eq!(item.status, QueueItemStatus::Canceled);
    assert!(item.error.unwrap().contains("Interrupted"));
}
