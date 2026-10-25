//! Graph jobs, helper jobs and face rig previews.
use super::common::*;
use novira_core::media::images;
use novira_core::types::*;
use serde_json::json;
use std::sync::Arc;

#[tokio::test]
async fn graph_jobs_resolve_models_and_read_pictures_before_the_engine_runs() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let engine = Arc::new(FakeEngine::default());
    let (backend, _events) = open(dir.path(), engine.clone());
    tokio::spawn(backend.clone().run_worker());
    let main = backend
        .bootstrap()
        .models
        .into_iter()
        .find(|m| m.kind == ModelType::Main)
        .unwrap();
    let photo = backend
        .upload_image(png(30, 20), ImageOptions::default())
        .await
        .unwrap();

    let mut req = request("", "a cat", 2);
    req.origin = QueueOrigin::Workflows;
    req.params.generation_mode = GenerationMode::Graph;
    req.workflow = Some(json!({ "nodes": [] }));
    req.comfy_graph = Some(
        serde_json::from_value(json!({
            "prompt": {
                "ckpt": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": { "$model": main.key } } },
                "src": { "class_type": "LoadImage", "inputs": { "image": { "$image": photo.name } } },
                "ks": { "class_type": "KSampler", "inputs": { "model": ["ckpt", 0], "seed": { "$seed": true } } },
                "out": { "class_type": "SaveImage", "inputs": { "images": ["src", 0] } }
            },
            "outputs": ["out"]
        }))
        .unwrap(),
    );
    backend.enqueue(req).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Completed; 2]).await;

    let jobs = engine.jobs.lock().unwrap();
    let seeds: Vec<u64> = jobs
        .iter()
        .map(|j| {
            j.graph.as_ref().unwrap().prompt["ks"]["inputs"]["seed"]
                .as_u64()
                .unwrap()
        })
        .collect();
    assert_eq!(
        seeds,
        vec![10, 11],
        "each run steps the seed like the other screens"
    );
    let g = jobs[0].graph.as_ref().unwrap();
    assert_eq!(
        g.prompt["ckpt"]["inputs"]["ckpt_name"],
        json!(main.comfy.as_ref().unwrap().name)
    );
    assert_eq!(g.models, vec![main.comfy.clone().unwrap()]);
    assert_eq!(g.images.len(), 1);
    assert_eq!(g.images[0].0, photo.name);
    assert!(image::load_from_memory(&g.images[0].1).is_ok());
    let saved = backend.bootstrap().images;
    assert!(saved.iter().any(|i| i.workflow.is_some()
        && i.metadata
            .as_ref()
            .is_some_and(|m| m.generation_mode == GenerationMode::Graph)));
}

#[tokio::test]
async fn a_graph_that_saves_sound_or_video_lands_in_the_gallery_as_that() {
    let dir = tempfile::tempdir().unwrap();
    let engine = Arc::new(FakeEngine::default());
    let (backend, _events) = open(dir.path(), engine.clone());
    tokio::spawn(backend.clone().run_worker());
    let graph_of = |class: &str, input: &str| {
        let mut req = request("", "a song", 1);
        req.origin = QueueOrigin::Workflows;
        req.params.generation_mode = GenerationMode::Graph;
        req.workflow = Some(json!({ "nodes": [] }));
        req.comfy_graph = Some(
            serde_json::from_value(json!({
                "prompt": {
                    "out": { "class_type": class, "inputs": { input: ["src", 0] } },
                    "src": { "class_type": "EmptyLatentImage", "inputs": {} },
                    "first": { "class_type": "PreviewImage", "inputs": {} }
                },
                "outputs": ["out"],
                "thumbnail": if class == "SaveVideo" { json!("first") } else { json!(null) }
            }))
            .unwrap(),
        );
        req
    };
    backend
        .enqueue(graph_of("SaveAudioAdvanced", "audio"))
        .unwrap();
    backend.enqueue(graph_of("SaveVideo", "video")).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Completed; 2]).await;
    let saved = backend.bootstrap().images;
    let of = |kind: MediaType| saved.iter().find(|i| i.media_type == kind);
    let sound = of(MediaType::Audio).expect("the sound is in the gallery");
    assert!(sound.name.ends_with(".flac"), "{}", sound.name);
    assert!(
        sound.workflow.is_some(),
        "a sound keeps the graph it came from"
    );
    let video = of(MediaType::Video).expect("the video is in the gallery");
    assert!(video.name.ends_with(".mp4"), "{}", video.name);
    assert_eq!(
        (video.width, video.height),
        (48, 32),
        "its first frame sets the size"
    );
    assert!(
        video.workflow.is_some(),
        "a video keeps the graph it came from"
    );
}

#[tokio::test]
async fn a_graph_asks_for_the_installed_image_encoder_of_a_size() {
    let dir = tempfile::tempdir().unwrap();
    let models = dir.path().join("models");
    std::fs::create_dir_all(models.join("clip_vision")).unwrap();
    std::fs::write(
        models
            .join("clip_vision")
            .join("CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors"),
        b"x",
    )
    .unwrap();
    let engine = Arc::new(FakeEngine::default());
    let (backend, _events) = open(dir.path(), engine.clone());
    tokio::spawn(backend.clone().run_worker());
    let graph_of = |size: &str| {
        let mut req = request("", "a cat", 1);
        req.origin = QueueOrigin::Workflows;
        req.params.generation_mode = GenerationMode::Graph;
        req.comfy_graph = Some(
            serde_json::from_value(json!({
                "prompt": {
                    "vision": { "class_type": "CLIPVisionLoader", "inputs": { "clip_name": { "$clip_vision": size } } },
                    "out": { "class_type": "SaveImage", "inputs": {} }
                },
                "outputs": ["out"]
            }))
            .unwrap(),
        );
        req
    };
    backend.enqueue(graph_of("ViT-H")).unwrap();
    backend.enqueue(graph_of("ViT-G")).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Completed, QueueItemStatus::Failed])
        .await;
    let errors: Vec<String> = backend
        .queue_snapshot()
        .items
        .into_iter()
        .filter_map(|q| q.error)
        .collect();
    assert!(
        errors
            .iter()
            .any(|e| e.contains("no ViT-G CLIP vision model")),
        "{errors:?}"
    );
    let jobs = engine.jobs.lock().unwrap();
    assert_eq!(
        jobs.len(),
        1,
        "only the graph with an installed encoder runs"
    );
    let g = jobs[0].graph.as_ref().unwrap();
    assert_eq!(
        g.prompt["vision"]["inputs"]["clip_name"],
        json!(g.models[0].name)
    );
    assert_eq!(g.models[0].folder, "clip_vision");
}

#[tokio::test]
async fn a_helper_job_keeps_its_picture_hidden_from_the_gallery() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _events) = open(dir.path(), Arc::new(FakeEngine::default()));
    tokio::spawn(backend.clone().run_worker());
    let mut req = request("", "a mask", 1);
    req.params.generation_mode = GenerationMode::Graph;
    req.destination = QueueDestination::Intermediate;
    req.comfy_graph = Some(
        serde_json::from_value(json!({
            "prompt": { "out": { "class_type": "SaveImage", "inputs": {} } },
            "outputs": ["out"]
        }))
        .unwrap(),
    );
    backend.enqueue(req).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Completed]).await;
    let images = backend.bootstrap().images;
    assert_eq!(images.len(), 1);
    assert!(images[0].is_intermediate, "a helper result is not shown");
}

#[tokio::test]
async fn graph_jobs_without_their_prompt_or_with_unknown_models_fail_with_the_reason() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _events) = open(dir.path(), Arc::new(FakeEngine::default()));
    tokio::spawn(backend.clone().run_worker());
    let mut no_graph = request("", "a cat", 1);
    no_graph.params.generation_mode = GenerationMode::Graph;
    let mut unknown = no_graph.clone();
    unknown.comfy_graph = Some(
        serde_json::from_value(json!({
            "prompt": { "c": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": { "$model": "gone" } } } },
            "outputs": ["c"]
        }))
        .unwrap(),
    );
    backend.enqueue(no_graph).unwrap();
    backend.enqueue(unknown).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed; 2]).await;
    let errors: Vec<String> = backend
        .queue_snapshot()
        .items
        .into_iter()
        .filter_map(|q| q.error)
        .collect();
    assert!(
        errors.iter().any(|e| e.contains("graph to run is missing")),
        "{errors:?}"
    );
    assert!(
        errors.iter().any(|e| e.contains("not found: gone")),
        "{errors:?}"
    );
}

#[tokio::test]
async fn face_rig_previews_are_clamped_and_carry_the_picture_only_when_named() {
    let dir = tempfile::tempdir().unwrap();
    let engine = Arc::new(FakeEngine::default());
    let (backend, _) = open(dir.path(), engine.clone());
    let photo = backend
        .upload_image(png(8, 8), ImageOptions::default())
        .await
        .unwrap();
    let preview = |image: Option<&str>, quality: &str| -> FaceRigPreview {
        serde_json::from_value(json!({
            "nodeKey": "n1", "image": image, "rig": "{}", "quality": quality,
            "cropFactor": 9.0, "srcRatio": -1.0, "faceIndex": 500
        }))
        .unwrap()
    };
    backend
        .face_rig_preview(preview(Some(&photo.name), "weird"))
        .await
        .unwrap();
    backend
        .face_rig_preview(preview(None, "drag"))
        .await
        .unwrap();
    backend.face_rig_library().await.unwrap();
    assert!(matches!(
        backend
            .face_rig_preview(preview(Some(&images::new_name()), "final"))
            .await,
        Err(novira_core::BackendError::NotFound(_))
    ));

    let calls = engine.pack_calls.lock().unwrap().clone();
    assert_eq!(calls.len(), 3, "a missing picture never reaches the engine");
    let (route, body) = &calls[0];
    assert_eq!(route, "nkd/facerig/preview");
    let body = body.as_ref().unwrap();
    assert_eq!(body["node"], "n1");
    assert_eq!(body["quality"], "final", "anything but drag is final");
    assert_eq!(body["crop_factor"], 3.0);
    assert_eq!(body["src_ratio"], 0.0);
    assert_eq!(body["face_index"], 64);
    assert!(body["frame"]
        .as_str()
        .unwrap()
        .starts_with("data:image/png;base64,"));
    let body = calls[1].1.as_ref().unwrap();
    assert_eq!(body["quality"], "drag");
    assert!(body.get("frame").is_none());
    assert_eq!(calls[2], ("nkd/facerig/library".to_string(), None));
}
