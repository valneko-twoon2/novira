//! Models whose stored record has no ComfyUI address (a record written by an older version): each place that needs one
//! refuses the job with the model's name instead of sending ComfyUI an empty file name. Also the error texts that name
//! an image encoder or a kind of guidance model.
use super::common::*;
use novira_core::db::{Db, Table};
use novira_core::service::guidance::clip_vision_size;
use novira_core::types::*;
use std::path::Path;
use std::sync::Arc;

/// Starts a backend once so the models in `<dir>/models` are recorded, then removes the ComfyUI address of every
/// recorded model for which `strip` says so. The next backend on this folder reads the records as they are.
fn strip_comfy(dir: &Path, strip: impl Fn(&ModelConfig) -> bool) {
    let (backend, _) = open(dir, Arc::new(FakeEngine::default()));
    backend.shutdown();
    drop(backend);
    let mut db = Db::open(dir).unwrap();
    let mut models: Vec<ModelConfig> = db.load(Table::Models).unwrap();
    assert!(!models.is_empty());
    for m in models.iter_mut().filter(|m| strip(m)) {
        m.comfy = None;
    }
    db.put_many(Table::Models, models.iter().map(|m| (m.key.as_str(), 0, m)))
        .unwrap();
}

fn write_models(models: &Path, files: &[(&str, &str)]) {
    for (dir, file) in files {
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

async fn failure_of(backend: &novira_core::Backend, req: EnqueueRequest) -> String {
    backend.enqueue(req).unwrap();
    wait_until(|| statuses(backend) == vec![QueueItemStatus::Failed]).await;
    backend.queue_snapshot().items.remove(0).error.unwrap()
}

#[tokio::test]
async fn a_main_model_without_a_comfyui_address_fails_the_job_by_name() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    strip_comfy(dir.path(), |m| m.kind == ModelType::Main);
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    tokio::spawn(backend.clone().run_worker());
    let error = failure_of(&backend, request(&main_key(&backend), "x", 1)).await;
    assert!(error.contains("cannot be used with ComfyUI"), "{error}");
    backend.shutdown();
}

#[tokio::test]
async fn guidance_models_without_an_address_or_of_the_wrong_kind_fail_the_job_with_a_reason() {
    let dir = tempfile::tempdir().unwrap();
    let models = dir.path().join("models");
    write_lora_and_checkpoint(&models);
    write_models(
        &models,
        &[
            ("controlnet", "union-xl.safetensors"),
            ("ipadapter", "ip-adapter_sdxl_vit-h.safetensors"),
            ("clip_vision", "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors"),
            ("clip_vision", "CLIP-ViT-L-14.safetensors"),
        ],
    );
    strip_comfy(dir.path(), |m| {
        m.path.contains("union-xl") || m.path.contains("ViT-H")
    });
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    tokio::spawn(backend.clone().run_worker());
    let picture = backend
        .upload_image(png(8, 8), ImageOptions::default())
        .await
        .unwrap();
    let main = main_key(&backend);

    // A ControlNet with no address.
    let mut req = request(&main, "x", 1);
    req.params.control_layer_count = Some(1);
    req.guidance.control_layers = vec![ControlLayerInput {
        image_url: picture.url.clone(),
        model_key: key_of(&backend, "union-xl"),
        weight: 0.5,
        begin_end: [0.0, 1.0],
        control_mode: ControlMode::Balanced,
        control_type: None,
    }];
    let error = failure_of(&backend, req).await;
    assert!(error.contains("cannot be used with ComfyUI"), "{error}");
    backend.clear_queue().unwrap();

    // A LoRA given as the IP-Adapter, and encoders that are missing: ViT-H has no address, ViT-G is not installed.
    let reference = |model_key: String, encoder: ClipVisionModel| {
        let mut req = request(&main, "x", 1);
        req.params.ref_image_count = Some(1);
        req.guidance.ref_images = vec![RefImageInput {
            image_url: picture.url.clone(),
            model_key,
            clip_vision_model: encoder,
            weight: 0.5,
            begin_end: [0.0, 1.0],
            method: RefImageMethod::Composition,
            region_image_url: None,
        }];
        req
    };
    let adapter = key_of(&backend, "ip-adapter_sdxl");
    for (req, expected) in [
        (
            reference(key_of(&backend, "detail-xl"), ClipVisionModel::VitH),
            "is not a IP-Adapter model",
        ),
        (
            reference(adapter.clone(), ClipVisionModel::VitH),
            "no ViT-H CLIP vision model",
        ),
        (
            reference(adapter, ClipVisionModel::VitG),
            "no ViT-G CLIP vision model",
        ),
    ] {
        let error = failure_of(&backend, req).await;
        assert!(error.contains(expected), "{error}");
        backend.clear_queue().unwrap();
    }
    backend.shutdown();
}

#[tokio::test]
async fn a_reference_image_names_the_vit_l_encoder_when_it_is_missing() {
    let dir = tempfile::tempdir().unwrap();
    let models = dir.path().join("models");
    write_lora_and_checkpoint(&models);
    write_models(
        &models,
        &[("ipadapter", "ip-adapter_sdxl_vit-h.safetensors")],
    );
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    tokio::spawn(backend.clone().run_worker());
    let picture = backend
        .upload_image(png(8, 8), ImageOptions::default())
        .await
        .unwrap();
    let mut req = request(&main_key(&backend), "x", 1);
    req.params.ref_image_count = Some(1);
    req.guidance.ref_images = vec![RefImageInput {
        image_url: picture.url,
        model_key: key_of(&backend, "ip-adapter_sdxl"),
        clip_vision_model: ClipVisionModel::VitL,
        weight: 0.5,
        begin_end: [0.0, 1.0],
        method: RefImageMethod::Composition,
        region_image_url: None,
    }];
    let error = failure_of(&backend, req).await;
    assert!(error.contains("no ViT-L CLIP vision model"), "{error}");
    backend.shutdown();
}

#[test]
fn an_encoder_with_a_plain_name_is_sized_by_the_layers_in_its_header() {
    let header = |layers: u32| novira_core::models::classify::Header {
        keys: (0..layers)
            .map(|i| format!("vision_model.encoder.layers.{i}.mlp.fc1.weight"))
            .collect(),
        ..Default::default()
    };
    assert_eq!(
        clip_vision_size("image_encoder.safetensors", Some(&header(24))),
        Some(ClipVisionModel::VitL)
    );
    assert_eq!(
        clip_vision_size("image_encoder.safetensors", Some(&header(32))),
        Some(ClipVisionModel::VitH)
    );
    assert_eq!(
        clip_vision_size("image_encoder.safetensors", Some(&header(48))),
        Some(ClipVisionModel::VitG)
    );
    assert_eq!(
        clip_vision_size("image_encoder.safetensors", Some(&header(12))),
        None
    );
}
