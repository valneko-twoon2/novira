//! Guidance at its edges: a region picture that is missing or stored, a union ControlNet under a main model of a newer
//! family, and the pictures a FLUX.2 model takes in as references.
use super::common::*;
use novira_core::db::DB_FILE;
use novira_core::types::*;
use serde_json::json;
use std::path::Path;
use std::sync::Arc;

fn key_of(b: &novira_core::Backend, file_part: &str) -> String {
    b.bootstrap()
        .models
        .into_iter()
        .find(|m| m.path.contains(file_part))
        .unwrap_or_else(|| panic!("no model {file_part}"))
        .key
}

fn write_models(models: &Path, files: &[(&str, &str)]) {
    for (dir, file) in files {
        std::fs::create_dir_all(models.join(dir)).unwrap();
        std::fs::write(models.join(dir).join(file), b"x").unwrap();
    }
}

fn reference(url: &str, model_key: &str, region: Option<String>) -> RefImageInput {
    RefImageInput {
        image_url: url.into(),
        model_key: model_key.into(),
        clip_vision_model: ClipVisionModel::VitH,
        weight: 0.6,
        begin_end: [0.0, 1.0],
        method: RefImageMethod::StylePrecise,
        region_image_url: region,
    }
}

async fn run_one(b: &novira_core::Backend) -> QueueItem {
    wait_until(|| {
        matches!(
            statuses(b).last(),
            Some(QueueItemStatus::Completed | QueueItemStatus::Failed)
        )
    })
    .await;
    b.queue_snapshot().items.last().unwrap().clone()
}

#[tokio::test]
async fn a_reference_image_with_an_empty_region_is_refused_and_a_stored_region_is_read() {
    let dir = tempfile::tempdir().unwrap();
    write_models(
        &dir.path().join("models"),
        &[
            ("checkpoints", "sdxl_base.safetensors"),
            ("ipadapter", "ip-adapter_sdxl_vit-h.safetensors"),
            ("clip_vision", "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors"),
        ],
    );
    let engine = Arc::new(FakeEngine::default());
    let (backend, _) = open(dir.path(), engine.clone());
    tokio::spawn(backend.clone().run_worker());
    let face = backend
        .upload_image(png(32, 8), ImageOptions::default())
        .await
        .unwrap();
    let region = backend
        .upload_image(png(24, 8), ImageOptions::default())
        .await
        .unwrap();
    let ipa = key_of(&backend, "ip-adapter_sdxl");
    let mut req = request(&main_key(&backend), "a cat", 1);
    req.params.ref_image_count = Some(1);
    req.guidance.ref_images = vec![reference(&face.url, &ipa, Some(String::new()))];
    let err = backend.enqueue(req).unwrap_err().to_string();
    assert!(err.contains("the region is missing"), "{err}");

    let mut req = request(&main_key(&backend), "a cat", 1);
    req.params.ref_image_count = Some(1);
    req.guidance.ref_images = vec![reference(&face.url, &ipa, Some(region.url.clone()))];
    backend.enqueue(req).unwrap();
    assert_eq!(run_one(&backend).await.status, QueueItemStatus::Completed);
    let jobs = engine.jobs.lock().unwrap();
    assert!(jobs[0].guidance.refs[0].region.is_some());
    drop(jobs);
    backend.shutdown();
}

#[tokio::test]
async fn a_union_controlnet_kind_is_ignored_under_a_main_model_that_is_not_an_sd_family() {
    let dir = tempfile::tempdir().unwrap();
    write_models(
        &dir.path().join("models"),
        &[
            ("vae", "plain.safetensors"),
            ("controlnet", "union-xl.safetensors"),
        ],
    );
    let engine = Arc::new(FakeEngine::default());
    let (backend, _) = open(dir.path(), engine.clone());
    tokio::spawn(backend.clone().run_worker());
    let edges = backend
        .upload_image(png(32, 8), ImageOptions::default())
        .await
        .unwrap();
    // A model that is not a checkpoint has no SD family, so no union type is chosen for the layer.
    let mut req = request(&key_of(&backend, "plain"), "a cat", 1);
    req.params.control_layer_count = Some(1);
    req.guidance.control_layers = vec![ControlLayerInput {
        image_url: edges.url.clone(),
        model_key: key_of(&backend, "union-xl"),
        weight: 0.5,
        begin_end: [0.0, 1.0],
        control_mode: ControlMode::Balanced,
        control_type: Some(ControlType::Lineart),
    }];
    backend.enqueue(req).unwrap();
    assert_eq!(run_one(&backend).await.status, QueueItemStatus::Completed);
    assert_eq!(
        engine.jobs.lock().unwrap()[0].guidance.controls[0].union_type,
        None
    );
    backend.shutdown();
}

#[tokio::test]
async fn a_flux2_model_reads_the_reference_pictures_it_takes_in_itself() {
    let dir = tempfile::tempdir().unwrap();
    let models = dir.path().join("models");
    write_models(
        &models,
        &[
            ("checkpoints", "sdxl_base.safetensors"),
            ("text_encoders", "mistral_3_small_flux2_bf16.safetensors"),
            ("vae", "flux2-vae.safetensors"),
        ],
    );
    {
        let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
        backend.shutdown();
    }
    // The checkpoint is recorded as a FLUX.2 model, the way a user could set its family.
    let conn = rusqlite::Connection::open(dir.path().join(DB_FILE)).unwrap();
    let rows: Vec<(String, String)> = {
        let mut stmt = conn.prepare("SELECT id, data FROM models").unwrap();
        stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap()
            .map(Result::unwrap)
            .collect()
    };
    for (id, data) in rows {
        let mut v: serde_json::Value = serde_json::from_str(&data).unwrap();
        if v["path"].as_str().unwrap().contains("sdxl_base") {
            v["base"] = json!("flux2");
            conn.execute(
                "UPDATE models SET data = ?1 WHERE id = ?2",
                rusqlite::params![v.to_string(), id],
            )
            .unwrap();
        }
    }
    drop(conn);
    let engine = Arc::new(FakeEngine::default());
    let (backend, _) = open(dir.path(), engine.clone());
    tokio::spawn(backend.clone().run_worker());
    let one = backend
        .upload_image(png(32, 8), ImageOptions::default())
        .await
        .unwrap();
    let two = backend
        .upload_image(png(40, 8), ImageOptions::default())
        .await
        .unwrap();
    let mut req = request(&main_key(&backend), "a cat", 1);
    req.guidance.reference_pictures = vec![one.url.clone(), two.url.clone()];
    backend.enqueue(req).unwrap();
    let item = run_one(&backend).await;
    assert_eq!(item.status, QueueItemStatus::Completed, "{:?}", item.error);
    assert_eq!(engine.jobs.lock().unwrap()[0].guidance.references.len(), 2);
    backend.shutdown();
}
