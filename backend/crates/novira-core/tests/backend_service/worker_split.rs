//! Models that load in parts (Anima): the job carries the text encoder and VAE found among the installed models.
use super::common::*;
use novira_core::comfy::split::Family;
use novira_core::types::*;
use std::path::Path;
use std::sync::Arc;

/// A safetensors file whose header lists the given tensor names (no weights).
fn safetensors(path: &Path, keys: &[&str]) {
    let header: serde_json::Map<String, serde_json::Value> = keys
        .iter()
        .map(|k| {
            (
                (*k).to_string(),
                serde_json::json!({"dtype": "BF16", "shape": [1], "data_offsets": [0, 2]}),
            )
        })
        .collect();
    let json = serde_json::to_vec(&header).unwrap();
    let mut bytes = (json.len() as u64).to_le_bytes().to_vec();
    bytes.extend(json);
    bytes.extend([0u8; 2]);
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, bytes).unwrap();
}

const ANIMA: &[&str] = &[
    "net.blocks.0.self_attn.q_proj.weight",
    "net.llm_adapter.embed.weight",
];
const QWEN: &[&str] = &[
    "model.embed_tokens.weight",
    "model.layers.0.self_attn.q_proj.weight",
];
const VAE: &[&str] = &[
    "encoder.downsamples.0.residual.0.gamma",
    "decoder.upsamples.0.residual.0.gamma",
];

fn anima_key(b: &novira_core::Backend) -> String {
    b.bootstrap()
        .models
        .into_iter()
        .find(|m| m.base == BaseModel::Anima)
        .expect("the Anima file is listed")
        .key
}

#[tokio::test]
async fn an_anima_job_gets_its_encoder_and_vae_from_the_installed_models() {
    let dir = tempfile::tempdir().unwrap();
    let models = dir.path().join("models");
    safetensors(&models.join("diffusion_models/anima.safetensors"), ANIMA);
    safetensors(
        &models.join("text_encoders/qwen_3_06b_base.safetensors"),
        QWEN,
    );
    safetensors(&models.join("text_encoders/qwen_3_4b.safetensors"), QWEN);
    safetensors(&models.join("vae/qwen_image_vae.safetensors"), VAE);
    let engine = Arc::new(FakeEngine::default());
    let (backend, _) = open(dir.path(), engine.clone());
    let key = anima_key(&backend);
    tokio::spawn(backend.clone().run_worker());
    backend.enqueue(request(&key, "a girl", 1)).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Completed]).await;

    let jobs = engine.jobs.lock().unwrap();
    let split = jobs[0].split.as_ref().expect("a split job");
    assert_eq!(split.family, Family::Anima);
    assert_eq!(split.text_encoders.len(), 1);
    assert_eq!(split.text_encoders[0].folder, "text_encoders");
    assert_eq!(split.text_encoders[0].name, "qwen_3_06b_base.safetensors");
    assert_eq!(
        jobs[0].vae.as_ref().unwrap().name,
        "qwen_image_vae.safetensors"
    );
    assert_eq!(jobs[0].checkpoint.folder, "diffusion_models");
}

#[tokio::test]
async fn a_missing_part_fails_the_job_and_says_which_file_to_install() {
    let dir = tempfile::tempdir().unwrap();
    let models = dir.path().join("models");
    safetensors(&models.join("diffusion_models/anima.safetensors"), ANIMA);
    safetensors(&models.join("vae/qwen_image_vae.safetensors"), VAE);
    let engine = Arc::new(FakeEngine::default());
    let (backend, _) = open(dir.path(), engine.clone());
    let key = anima_key(&backend);
    tokio::spawn(backend.clone().run_worker());
    backend.enqueue(request(&key, "a girl", 1)).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed]).await;

    let error = backend.queue_snapshot().items[0].error.clone().unwrap();
    assert!(error.contains("Qwen3 0.6B text encoder"), "{error}");
    assert!(engine.jobs.lock().unwrap().is_empty());
}

#[tokio::test]
async fn a_family_without_a_recipe_is_still_refused_by_name() {
    let dir = tempfile::tempdir().unwrap();
    let models = dir.path().join("models");
    safetensors(
        &models.join("diffusion_models/wan.safetensors"),
        &["blocks.0.self_attn.q.weight", "patch_embedding.weight"],
    );
    let (backend, _) = open(dir.path(), Arc::new(FakeEngine::default()));
    let key = backend
        .bootstrap()
        .models
        .into_iter()
        .find(|m| m.base == BaseModel::Wan)
        .unwrap()
        .key;
    tokio::spawn(backend.clone().run_worker());
    backend.enqueue(request(&key, "x", 1)).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed]).await;
    let error = backend.queue_snapshot().items[0].error.clone().unwrap();
    assert!(error.contains("wan models are not supported"), "{error}");
}

#[tokio::test]
async fn a_checkpoint_of_a_newer_family_loads_only_the_parts_it_lacks() {
    let dir = tempfile::tempdir().unwrap();
    let models = dir.path().join("models");
    // An SD3.5 checkpoint with its VAE but without its text encoders, and the three encoders beside it.
    safetensors(
        &models.join("checkpoints/sd3.5_medium.safetensors"),
        &[
            "model.diffusion_model.joint_blocks.0.x_block.attn.qkv.weight",
            "first_stage_model.decoder.up.0.block.0.conv1.weight",
        ],
    );
    for name in [
        "clip_l.safetensors",
        "clip_g.safetensors",
        "t5xxl_fp8_e4m3fn.safetensors",
    ] {
        safetensors(
            &models.join("text_encoders").join(name),
            &["text_model.encoder.layers.0.self_attn.q_proj.weight"],
        );
    }
    let engine = Arc::new(FakeEngine::default());
    let (backend, _) = open(dir.path(), engine.clone());
    let key = backend
        .bootstrap()
        .models
        .into_iter()
        .find(|m| m.base == BaseModel::Sd3)
        .expect("the SD3.5 checkpoint is listed")
        .key;
    tokio::spawn(backend.clone().run_worker());
    backend.enqueue(request(&key, "a girl", 1)).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Completed]).await;

    let jobs = engine.jobs.lock().unwrap();
    let split = jobs[0].split.as_ref().expect("a split job");
    assert_eq!(split.family, Family::Sd3);
    assert_eq!(
        split.loader,
        novira_core::comfy::split::Loader::Checkpoint {
            clip: false,
            vae: true
        }
    );
    let names: Vec<&str> = split
        .text_encoders
        .iter()
        .map(|e| e.name.as_str())
        .collect();
    assert_eq!(
        names,
        [
            "clip_l.safetensors",
            "clip_g.safetensors",
            "t5xxl_fp8_e4m3fn.safetensors"
        ]
    );
    // The checkpoint's own VAE is used.
    assert!(jobs[0].vae.is_none());
}

#[tokio::test]
async fn an_anima_picture_records_the_sampling_that_ran_not_the_scheduler_setting() {
    let dir = tempfile::tempdir().unwrap();
    let models = dir.path().join("models");
    safetensors(&models.join("diffusion_models/anima.safetensors"), ANIMA);
    safetensors(
        &models.join("text_encoders/qwen_3_06b_base.safetensors"),
        QWEN,
    );
    safetensors(&models.join("vae/qwen_image_vae.safetensors"), VAE);
    let engine = Arc::new(FakeEngine::default());
    let (backend, _) = open(dir.path(), engine.clone());
    let key = anima_key(&backend);
    tokio::spawn(backend.clone().run_worker());
    let mut req = request(&key, "a girl", 1);
    req.params.scheduler = "euler_a".into();
    backend.enqueue(req).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Completed]).await;

    let meta = backend.bootstrap().images.remove(0).metadata.unwrap();
    assert_eq!(
        meta.sampling,
        Some(Sampling {
            sampler: "euler".into(),
            scheduler: "simple".into(),
        })
    );
    // The setting itself is kept as it was sent.
    assert_eq!(meta.scheduler, "euler_a");
    backend.shutdown();
}

#[tokio::test]
async fn an_sd_picture_records_no_fixed_sampling_even_when_one_was_sent() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let engine = Arc::new(FakeEngine::default());
    let (backend, _) = open(dir.path(), engine.clone());
    let key = main_key(&backend);
    tokio::spawn(backend.clone().run_worker());
    let mut req = request(&key, "a cat", 1);
    req.params.scheduler = "euler_a".into();
    req.params.sampling = Some(Sampling {
        sampler: "euler".into(),
        scheduler: "simple".into(),
    });
    backend.enqueue(req).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Completed]).await;

    let meta = backend.bootstrap().images.remove(0).metadata.unwrap();
    assert_eq!(meta.sampling, None);
    assert_eq!(meta.scheduler, "euler_a");
    backend.shutdown();
}
