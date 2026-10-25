//! Guidance of image jobs (inpaint mask, control layers, reference images): enqueue checks and the worker resolving
//! their models and pictures before the engine runs.
use super::common::*;
use novira_core::service::guidance::{MAX_CONTROL_LAYERS, MAX_REFERENCE_PICTURES, MAX_REF_IMAGES};
use novira_core::types::*;
use std::path::Path;
use std::sync::Arc;

/// An SDXL checkpoint, a LoRA, an SDXL and an SD 1.5 ControlNet, an SDXL IP-Adapter and a ViT-H image encoder.
fn write_guidance_models(models: &Path) {
    write_lora_and_checkpoint(models);
    for (dir, file) in [
        ("controlnet", "union-xl.safetensors"),
        ("controlnet", "canny-sd15.safetensors"),
        ("ipadapter", "ip-adapter_sdxl_vit-h.safetensors"),
        ("clip_vision", "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors"),
    ] {
        std::fs::create_dir_all(models.join(dir)).unwrap();
        std::fs::write(models.join(dir).join(file), b"x").unwrap();
    }
}

fn key_of(b: &novira_core::Backend, file_part: &str) -> String {
    b.bootstrap()
        .models
        .into_iter()
        .find(|m| m.path.contains(file_part))
        .unwrap_or_else(|| panic!("no model {file_part}"))
        .key
}

fn control(url: &str, model_key: &str) -> ControlLayerInput {
    ControlLayerInput {
        image_url: url.into(),
        model_key: model_key.into(),
        weight: 0.75,
        begin_end: [0.0, 0.75],
        control_mode: ControlMode::MoreControl,
        control_type: None,
    }
}

fn reference(url: &str, model_key: &str, encoder: ClipVisionModel) -> RefImageInput {
    RefImageInput {
        image_url: url.into(),
        model_key: model_key.into(),
        clip_vision_model: encoder,
        weight: 0.6,
        begin_end: [0.0, 1.0],
        method: RefImageMethod::StylePrecise,
        region_image_url: None,
    }
}

#[tokio::test]
async fn enqueue_refuses_guidance_that_is_not_stored_too_large_or_out_of_place() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let stored = backend
        .upload_image(png(8, 8), ImageOptions::default())
        .await
        .unwrap();

    // A picture that is not in the gallery.
    let mut req = request("m", "x", 1);
    req.params.control_layer_count = Some(1);
    req.guidance.control_layers = vec![control("https://example.com/a.png", "cn")];
    assert!(backend
        .enqueue(req)
        .unwrap_err()
        .to_string()
        .contains("stored in the gallery"));
    // Too many control layers / reference images.
    let mut req = request("m", "x", 1);
    req.params.control_layer_count = Some(MAX_CONTROL_LAYERS as u32 + 1);
    req.guidance.control_layers = vec![control(&stored.url, "cn"); MAX_CONTROL_LAYERS + 1];
    assert!(backend.enqueue(req).is_err());
    let mut req = request("m", "x", 1);
    req.params.ref_image_count = Some(MAX_REF_IMAGES as u32 + 1);
    req.guidance.ref_images =
        vec![reference(&stored.url, "ipa", ClipVisionModel::VitH); MAX_REF_IMAGES + 1];
    assert!(backend.enqueue(req).is_err());
    // A mask on text to image, and an inpaint without one.
    let mut req = request("m", "x", 1);
    req.guidance.mask_image_url = Some(stored.url.clone());
    assert!(backend.enqueue(req).is_err());
    let mut req = request("m", "x", 1);
    req.params.generation_mode = GenerationMode::Inpaint;
    req.init_image_url = Some(stored.url.clone());
    assert!(backend
        .enqueue(req)
        .unwrap_err()
        .to_string()
        .contains("need a mask"));
    assert!(backend.queue_snapshot().items.is_empty());
}

#[tokio::test]
async fn the_worker_resolves_guidance_models_and_reads_their_pictures() {
    let dir = tempfile::tempdir().unwrap();
    write_guidance_models(&dir.path().join("models"));
    let engine = Arc::new(FakeEngine::default());
    let (backend, _) = open(dir.path(), engine.clone());
    tokio::spawn(backend.clone().run_worker());
    let upload = |w: u32| {
        let b = backend.clone();
        async move {
            b.upload_image(png(w, 8), ImageOptions::default())
                .await
                .unwrap()
        }
    };
    let (source, mask, edges, face) = (
        upload(16).await,
        upload(24).await,
        upload(32).await,
        upload(40).await,
    );

    let mut req = request(&main_key(&backend), "a cat", 1);
    req.destination = QueueDestination::Canvas;
    req.params.generation_mode = GenerationMode::Inpaint;
    req.params.control_layer_count = Some(1);
    req.params.ref_image_count = Some(1);
    req.init_image_url = Some(source.url.clone());
    req.guidance = Guidance {
        mask_image_url: Some(mask.url.clone()),
        regional_layers: vec![],
        control_layers: vec![control(&edges.url, &key_of(&backend, "union-xl"))],
        ref_images: vec![reference(
            &face.url,
            &key_of(&backend, "ip-adapter_sdxl"),
            ClipVisionModel::VitH,
        )],
        reference_pictures: vec![],
    };
    let item = backend.enqueue(req).unwrap().remove(0);
    assert_eq!(
        item.guidance.control_layers.len(),
        1,
        "the queue item keeps the guidance"
    );
    assert_eq!(
        item.params.ref_images.as_ref().unwrap()[0].image_url,
        face.url
    );
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Completed]).await;

    // The finished picture remembers its reference images and control layers, so it can be derived again.
    let made = backend
        .bootstrap()
        .images
        .into_iter()
        .find(|i| i.metadata.is_some())
        .expect("the generated picture");
    let stored = made.metadata.unwrap();
    assert_eq!(stored.ref_images.unwrap()[0].image_url, face.url);
    assert_eq!(stored.control_layers.unwrap()[0].image_url, edges.url);

    let jobs = engine.jobs.lock().unwrap();
    let g = &jobs[0].guidance;
    let read = |img: &ImageDTO| backend.read_image("full", &img.name).unwrap().0;
    assert_eq!(g.mask.as_deref(), Some(read(&mask).as_slice()));
    assert_eq!(g.controls[0].model.folder, "controlnet");
    assert_eq!(g.controls[0].model.name, "union-xl.safetensors");
    assert_eq!(g.controls[0].image, read(&edges));
    assert_eq!(g.controls[0].mode, ControlMode::MoreControl);
    assert_eq!(g.refs[0].model.folder, "ipadapter");
    assert_eq!(
        g.refs[0].clip_vision.name,
        "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors"
    );
    assert_eq!(g.refs[0].image, read(&face));
    assert_eq!(g.refs[0].method, RefImageMethod::StylePrecise);
    backend.shutdown();
}

#[tokio::test]
async fn wrong_or_missing_guidance_models_fail_the_job_with_a_reason() {
    let dir = tempfile::tempdir().unwrap();
    write_guidance_models(&dir.path().join("models"));
    let engine = Arc::new(FakeEngine::default());
    let (backend, _) = open(dir.path(), engine.clone());
    tokio::spawn(backend.clone().run_worker());
    let picture = backend
        .upload_image(png(8, 8), ImageOptions::default())
        .await
        .unwrap();
    let main = main_key(&backend);
    let with_control = |model_key: String| {
        let mut req = request(&main, "x", 1);
        req.params.control_layer_count = Some(1);
        req.guidance.control_layers = vec![control(&picture.url, &model_key)];
        req
    };
    // An SD 1.5 ControlNet with an SDXL model, a LoRA as a ControlNet, an encoder that is not installed.
    backend
        .enqueue(with_control(key_of(&backend, "canny-sd15")))
        .unwrap();
    backend
        .enqueue(with_control(key_of(&backend, "detail-xl")))
        .unwrap();
    let mut req = request(&main, "x", 1);
    req.params.ref_image_count = Some(1);
    req.guidance.ref_images = vec![reference(
        &picture.url,
        &key_of(&backend, "ip-adapter_sdxl"),
        ClipVisionModel::VitG,
    )];
    backend.enqueue(req).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed; 3]).await;
    let errors: Vec<String> = backend
        .queue_snapshot()
        .items
        .into_iter()
        .map(|q| q.error.unwrap())
        .collect();
    assert!(errors[0].contains("is for sd-1 models"), "{errors:?}");
    assert!(
        errors[1].contains("is not a ControlNet model"),
        "{errors:?}"
    );
    assert!(
        errors[2].contains("no ViT-G CLIP vision model"),
        "{errors:?}"
    );
    assert!(engine.jobs.lock().unwrap().is_empty());
    backend.shutdown();
}

#[tokio::test]
async fn regional_layers_are_kept_with_the_item_read_by_the_worker_and_remembered_by_the_picture() {
    let dir = tempfile::tempdir().unwrap();
    write_guidance_models(&dir.path().join("models"));
    let engine = Arc::new(FakeEngine::default());
    let (backend, _) = open(dir.path(), engine.clone());
    tokio::spawn(backend.clone().run_worker());
    let left = backend
        .upload_image(png(24, 8), ImageOptions::default())
        .await
        .unwrap();
    let layer = |prompt: &str| RegionalLayerInput {
        image_url: left.url.clone(),
        positive_prompt: Some(prompt.into()),
        negative_prompt: Some("  ".into()),
        auto_negative: true,
    };
    // The count must match the layers; a layer must be a stored picture.
    let mut req = request(&main_key(&backend), "a cat", 1);
    req.guidance.regional_layers = vec![layer("a red hat")];
    assert!(backend
        .enqueue(req)
        .unwrap_err()
        .to_string()
        .contains("count"));
    let mut req = request(&main_key(&backend), "a cat", 1);
    req.params.regional_guidance_count = Some(1);
    req.guidance.regional_layers = vec![RegionalLayerInput {
        image_url: "https://example.com/r.png".into(),
        ..layer("a red hat")
    }];
    assert!(backend
        .enqueue(req)
        .unwrap_err()
        .to_string()
        .contains("stored in the gallery"));
    let mut req = request(&main_key(&backend), "a cat", 1);
    req.params.regional_guidance_count = Some(1);
    req.guidance.regional_layers = vec![layer("a red hat")];
    let item = backend.enqueue(req).unwrap().remove(0);
    assert_eq!(item.params.regional_layers.as_ref().unwrap().len(), 1);
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Completed]).await;
    let jobs = engine.jobs.lock().unwrap();
    let regions = &jobs[0].guidance.regions;
    assert_eq!(regions.len(), 1);
    assert_eq!(
        regions[0].mask,
        backend.read_image("full", &left.name).unwrap().0
    );
    assert_eq!(regions[0].positive.as_deref(), Some("a red hat"));
    // A blank prompt is no prompt.
    assert_eq!(regions[0].negative, None);
    assert!(regions[0].auto_negative);
    let made = backend
        .bootstrap()
        .images
        .into_iter()
        .find(|i| i.metadata.is_some())
        .expect("the generated picture");
    assert_eq!(
        made.metadata.unwrap().regional_layers.unwrap()[0].image_url,
        left.url
    );
    backend.shutdown();
}
#[tokio::test]
async fn reference_pictures_are_kept_with_the_item_and_refused_by_a_model_that_cannot_take_them() {
    let dir = tempfile::tempdir().unwrap();
    write_guidance_models(&dir.path().join("models"));
    let engine = Arc::new(FakeEngine::default());
    let (backend, _) = open(dir.path(), engine.clone());
    let picture = backend
        .upload_image(png(8, 8), ImageOptions::default())
        .await
        .unwrap();
    let main = main_key(&backend);
    // Too many, or a picture the gallery does not hold, are refused when queued.
    let mut req = request(&main, "x", 1);
    req.guidance.reference_pictures = vec![picture.url.clone(); MAX_REFERENCE_PICTURES + 1];
    assert!(backend
        .enqueue(req)
        .unwrap_err()
        .to_string()
        .contains("At most"));
    let mut req = request(&main, "x", 1);
    req.guidance.reference_pictures = vec!["https://example.com/a.png".into()];
    assert!(backend.enqueue(req).is_err());
    assert!(backend.queue_snapshot().items.is_empty());
    // The item keeps them, so a picture made with them can be derived again; an SDXL model cannot take them.
    tokio::spawn(backend.clone().run_worker());
    let mut req = request(&main, "x", 1);
    req.guidance.reference_pictures = vec![picture.url.clone()];
    let item = backend.enqueue(req).unwrap().remove(0);
    assert_eq!(
        item.params.reference_pictures,
        Some(vec![picture.url.clone()])
    );
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed]).await;
    let error = backend.queue_snapshot().items[0].error.clone().unwrap();
    assert!(error.contains("FLUX.2 models only"), "{error}");
    assert!(engine.jobs.lock().unwrap().is_empty());
    backend.shutdown();
}

#[tokio::test]
async fn a_union_controlnet_is_told_what_its_picture_shows_and_the_picture_remembers_it() {
    let dir = tempfile::tempdir().unwrap();
    let models = dir.path().join("models");
    write_guidance_models(&models);
    std::fs::write(
        models.join("controlnet").join("openpose-xl.safetensors"),
        b"x",
    )
    .unwrap();
    let engine = Arc::new(FakeEngine::default());
    let (backend, _) = open(dir.path(), engine.clone());
    tokio::spawn(backend.clone().run_worker());
    let pose = backend
        .upload_image(png(16, 8), ImageOptions::default())
        .await
        .unwrap();
    let (union, openpose) = (
        key_of(&backend, "union-xl"),
        key_of(&backend, "openpose-xl"),
    );
    let layer = |key: &str, kind: Option<ControlType>| ControlLayerInput {
        control_type: kind,
        ..control(&pose.url, key)
    };
    let mut req = request(&main_key(&backend), "a cat", 1);
    req.params.control_layer_count = Some(3);
    req.guidance.control_layers = vec![
        layer(&union, Some(ControlType::Openpose)),
        // A picture of unknown kind, and a model that reads one kind only, are left as they were.
        layer(&union, None),
        layer(&openpose, Some(ControlType::Openpose)),
    ];
    backend.enqueue(req).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Completed]).await;
    let kinds: Vec<_> = engine.jobs.lock().unwrap()[0]
        .guidance
        .controls
        .iter()
        .map(|c| c.union_type)
        .collect();
    assert_eq!(kinds, vec![Some("openpose"), None, None]);
    // The picture keeps the kind, so a picture derived from it tells the model again.
    let made = backend
        .bootstrap()
        .images
        .into_iter()
        .find(|i| i.metadata.is_some())
        .expect("the generated picture");
    let layers = made.metadata.unwrap().control_layers.unwrap();
    assert_eq!(layers[0].control_type, Some(ControlType::Openpose));
    assert_eq!(layers[1].control_type, None);
    backend.shutdown();
}
