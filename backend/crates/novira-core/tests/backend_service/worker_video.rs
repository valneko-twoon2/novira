//! Video models the user installed (Wan, HunyuanVideo, LTX-Video): the job carries the family, what the file is made
//! for, and the text encoders and VAE found among the installed models. Their headers are written with the real shapes.
use super::common::*;
use novira_core::comfy::split::{Family, Loader, WanKind};
use novira_core::types::*;
use std::path::Path;
use std::sync::Arc;

/// A safetensors file with the given tensors; a name may carry a shape as `name=16` (the second dimension).
fn safetensors(path: &Path, tensors: &[&str]) {
    let header: serde_json::Map<String, serde_json::Value> = tensors
        .iter()
        .map(|t| {
            let (name, channels) = t.split_once('=').unzip();
            let shape = match channels {
                Some(c) => serde_json::json!([1536, c.parse::<u64>().unwrap(), 1, 2, 2]),
                None => serde_json::json!([1]),
            };
            (
                name.unwrap_or(t).to_string(),
                serde_json::json!({"dtype": "BF16", "shape": shape, "data_offsets": [0, 2]}),
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

const UMT5: &[&str] = &[
    "encoder.block.0.layer.0.SelfAttention.q.weight",
    "shared.weight",
];
const WAN_VAE: &[&str] = &[
    "encoder.downsamples.0.residual.0.gamma",
    "decoder.upsamples.0.residual.0.gamma",
];

fn wan_file(path: &Path, channels: u64) {
    let patch = format!("patch_embedding.weight={channels}");
    safetensors(path, &["blocks.0.self_attn.q.weight", &patch]);
}

fn video_request(key: &str) -> EnqueueRequest {
    let mut req = request(key, "a wave", 1);
    req.params.generation_mode = GenerationMode::Video;
    req.params.video_frames = Some(17);
    req.params.video_fps = Some(16);
    req
}

fn key_of(b: &novira_core::Backend, name_part: &str) -> String {
    b.bootstrap()
        .models
        .into_iter()
        .find(|m| m.path.contains(name_part))
        .unwrap_or_else(|| panic!("{name_part} is listed"))
        .key
}

async fn run(
    dir: &Path,
    name_part: &str,
) -> (Arc<FakeEngine>, novira_core::Backend, QueueItemStatus) {
    let engine = Arc::new(FakeEngine::default());
    let (backend, _) = open(dir, engine.clone());
    let key = key_of(&backend, name_part);
    tokio::spawn(backend.clone().run_worker());
    backend.enqueue(video_request(&key)).unwrap();
    wait_until(|| {
        matches!(
            statuses(&backend).last(),
            Some(QueueItemStatus::Completed | QueueItemStatus::Failed)
        )
    })
    .await;
    let status = *statuses(&backend).last().unwrap();
    (engine, backend, status)
}

fn error_of(b: &novira_core::Backend) -> String {
    b.queue_snapshot()
        .items
        .last()
        .unwrap()
        .error
        .clone()
        .unwrap()
}

#[tokio::test]
async fn a_wan_21_text_to_video_model_runs_without_the_pack() {
    let dir = tempfile::tempdir().unwrap();
    let m = dir.path().join("models");
    wan_file(&m.join("diffusion_models/wan2.1_t2v_1.3B.safetensors"), 16);
    safetensors(&m.join("text_encoders/umt5_xxl_fp8.safetensors"), UMT5);
    safetensors(&m.join("vae/wan_2.1_vae.safetensors"), WAN_VAE);
    let (engine, _, status) = run(dir.path(), "wan2.1_t2v").await;
    assert_eq!(status, QueueItemStatus::Completed);
    let jobs = engine.jobs.lock().unwrap();
    let split = jobs[0].split.as_ref().expect("a video family job");
    assert_eq!((split.family, split.wan), (Family::Wan, Some(WanKind::T2v)));
    assert_eq!(split.loader, Loader::Unet);
    assert_eq!(split.text_encoders[0].name, "umt5_xxl_fp8.safetensors");
    assert!(split.low_noise.is_none());
    assert_eq!(
        jobs[0].vae.as_ref().unwrap().name,
        "wan_2.1_vae.safetensors"
    );
    assert_eq!(jobs[0].checkpoint.folder, "diffusion_models");
    assert!(jobs[0].text_encoder.is_none());
}

#[tokio::test]
async fn the_5b_model_takes_wan_22s_vae_and_an_i2v_model_is_told_apart() {
    let dir = tempfile::tempdir().unwrap();
    let m = dir.path().join("models");
    wan_file(&m.join("diffusion_models/wan2.2_ti2v_5B.safetensors"), 48);
    wan_file(&m.join("diffusion_models/wan2.1_i2v_14B.safetensors"), 36);
    safetensors(&m.join("text_encoders/umt5_xxl_fp8.safetensors"), UMT5);
    safetensors(&m.join("vae/wan_2.1_vae.safetensors"), WAN_VAE);
    safetensors(&m.join("vae/wan2.2_vae.safetensors"), WAN_VAE);
    let (engine, _, status) = run(dir.path(), "wan2.2_ti2v").await;
    assert_eq!(status, QueueItemStatus::Completed);
    {
        let jobs = engine.jobs.lock().unwrap();
        assert_eq!(jobs[0].split.as_ref().unwrap().wan, Some(WanKind::Ti2v));
        assert_eq!(jobs[0].vae.as_ref().unwrap().name, "wan2.2_vae.safetensors");
    }
    let dir2 = tempfile::tempdir().unwrap();
    let m2 = dir2.path().join("models");
    wan_file(&m2.join("diffusion_models/wan2.1_i2v_14B.safetensors"), 36);
    safetensors(&m2.join("text_encoders/umt5_xxl_fp8.safetensors"), UMT5);
    safetensors(&m2.join("vae/wan_2.1_vae.safetensors"), WAN_VAE);
    let (engine, _, _) = run(dir2.path(), "wan2.1_i2v").await;
    assert_eq!(
        engine.jobs.lock().unwrap()[0].split.as_ref().unwrap().wan,
        Some(WanKind::I2v)
    );
}

#[tokio::test]
async fn a_wan_22_high_noise_model_brings_its_low_noise_partner() {
    let dir = tempfile::tempdir().unwrap();
    let m = dir.path().join("models");
    wan_file(
        &m.join("diffusion_models/wan2.2_t2v_high_noise_14B_fp8.safetensors"),
        16,
    );
    wan_file(
        &m.join("diffusion_models/wan2.2_t2v_low_noise_14B_fp8.safetensors"),
        16,
    );
    safetensors(&m.join("text_encoders/umt5_xxl_fp8.safetensors"), UMT5);
    safetensors(&m.join("vae/wan_2.1_vae.safetensors"), WAN_VAE);
    let (engine, _, status) = run(dir.path(), "t2v_high_noise").await;
    assert_eq!(status, QueueItemStatus::Completed);
    {
        let jobs = engine.jobs.lock().unwrap();
        let low = jobs[0].split.as_ref().unwrap().low_noise.as_ref().unwrap();
        assert_eq!(low.name, "wan2.2_t2v_low_noise_14B_fp8.safetensors");
    }
    // Picking the low-noise file is refused with the way out; a high-noise file without a partner too.
    let (_, backend, status) = run(dir.path(), "t2v_low_noise").await;
    assert_eq!(status, QueueItemStatus::Failed);
    assert!(
        error_of(&backend).contains("high-noise file"),
        "{}",
        error_of(&backend)
    );
    let alone = tempfile::tempdir().unwrap();
    let a = alone.path().join("models");
    wan_file(
        &a.join("diffusion_models/wan2.2_i2v_high_noise_14B.safetensors"),
        36,
    );
    safetensors(&a.join("text_encoders/umt5_xxl_fp8.safetensors"), UMT5);
    safetensors(&a.join("vae/wan_2.1_vae.safetensors"), WAN_VAE);
    let (_, backend, status) = run(alone.path(), "i2v_high_noise").await;
    assert_eq!(status, QueueItemStatus::Failed);
    assert!(
        error_of(&backend).contains("low-noise partner"),
        "{}",
        error_of(&backend)
    );
}

#[tokio::test]
async fn a_wan_model_of_an_unknown_kind_and_a_missing_vae_fail_with_the_reason() {
    let dir = tempfile::tempdir().unwrap();
    let m = dir.path().join("models");
    wan_file(&m.join("diffusion_models/wan_odd.safetensors"), 20);
    safetensors(&m.join("text_encoders/umt5_xxl_fp8.safetensors"), UMT5);
    let (_, backend, status) = run(dir.path(), "wan_odd").await;
    assert_eq!(status, QueueItemStatus::Failed);
    assert!(
        error_of(&backend).contains("Cannot tell what"),
        "{}",
        error_of(&backend)
    );
    let dir = tempfile::tempdir().unwrap();
    let m = dir.path().join("models");
    wan_file(&m.join("diffusion_models/wan2.1_t2v.safetensors"), 16);
    safetensors(&m.join("text_encoders/umt5_xxl_fp8.safetensors"), UMT5);
    let (engine, backend, status) = run(dir.path(), "wan2.1_t2v").await;
    assert_eq!(status, QueueItemStatus::Failed);
    assert!(
        error_of(&backend).contains("Wan 2.1 VAE"),
        "{}",
        error_of(&backend)
    );
    assert!(engine.jobs.lock().unwrap().is_empty());
}

#[tokio::test]
async fn hunyuan_video_runs_text_to_video_and_image_to_video_with_its_vision_model() {
    let dir = tempfile::tempdir().unwrap();
    let m = dir.path().join("models");
    let keys = |c: &str| {
        vec![
            "double_blocks.0.img_attn.qkv.weight".to_string(),
            "single_blocks.0.linear1.weight".to_string(),
            "txt_in.individual_token_refiner.blocks.0.norm1.weight".to_string(),
            format!("img_in.proj.weight={c}"),
        ]
    };
    let write = |p: &Path, c: &str| {
        let k = keys(c);
        safetensors(p, &k.iter().map(String::as_str).collect::<Vec<_>>());
    };
    write(
        &m.join("diffusion_models/hunyuan_video_t2v_720p.safetensors"),
        "16",
    );
    write(
        &m.join("diffusion_models/hunyuan_video_i2v_720p.safetensors"),
        "33",
    );
    safetensors(
        &m.join("text_encoders/clip_l.safetensors"),
        &["text_model.encoder.layers.0.self_attn.q_proj.weight"],
    );
    safetensors(
        &m.join("text_encoders/llava_llama3_fp8_scaled.safetensors"),
        &[
            "model.embed_tokens.weight",
            "model.layers.0.self_attn.q_proj.weight",
        ],
    );
    safetensors(&m.join("vae/hunyuan_video_vae_bf16.safetensors"), WAN_VAE);
    let (engine, _, status) = run(dir.path(), "hunyuan_video_t2v").await;
    assert_eq!(status, QueueItemStatus::Completed);
    {
        let jobs = engine.jobs.lock().unwrap();
        let split = jobs[0].split.as_ref().unwrap();
        assert_eq!(split.family, Family::HunyuanVideo);
        let names: Vec<&str> = split
            .text_encoders
            .iter()
            .map(|e| e.name.as_str())
            .collect();
        assert_eq!(
            names,
            ["clip_l.safetensors", "llava_llama3_fp8_scaled.safetensors"]
        );
    }
    // The image-to-video model (33 channels) also needs the LLaVA vision model.
    let (_, backend, status) = run(dir.path(), "hunyuan_video_i2v").await;
    assert_eq!(status, QueueItemStatus::Failed);
    assert!(
        error_of(&backend).contains("llava_llama3_vision"),
        "{}",
        error_of(&backend)
    );
    safetensors(
        &m.join("clip_vision/llava_llama3_vision.safetensors"),
        &["vision_model.encoder.layers.0.self_attn.q_proj.weight"],
    );
    let (engine, _, status) = run(dir.path(), "hunyuan_video_i2v").await;
    assert_eq!(status, QueueItemStatus::Completed);
    let jobs = engine.jobs.lock().unwrap();
    let split = jobs[0].split.as_ref().unwrap();
    assert_eq!(split.variant, novira_core::models::classify::Variant::HyI2v);
    assert_eq!(
        split.clip_vision.as_ref().unwrap().name,
        "llava_llama3_vision.safetensors"
    );
}

#[tokio::test]
async fn an_ltx_checkpoint_gives_its_own_vae() {
    let dir = tempfile::tempdir().unwrap();
    let m = dir.path().join("models");
    safetensors(
        &m.join("diffusion_models/ltx-video-2b-v0.9.5.safetensors"),
        &[
            "model.diffusion_model.patchify_proj.weight",
            "model.diffusion_model.transformer_blocks.0.attn1.to_q.weight",
            "vae.decoder.up_blocks.0.x",
        ],
    );
    safetensors(&m.join("text_encoders/t5xxl_fp8_e4m3fn.safetensors"), UMT5);
    let (engine, _, status) = run(dir.path(), "ltx-video").await;
    assert_eq!(status, QueueItemStatus::Completed);
    let jobs = engine.jobs.lock().unwrap();
    let split = jobs[0].split.as_ref().unwrap();
    assert_eq!(split.family, Family::Ltx);
    assert_eq!(
        split.loader,
        Loader::Checkpoint {
            clip: false,
            vae: true
        }
    );
    assert_eq!(split.text_encoders[0].name, "t5xxl_fp8_e4m3fn.safetensors");
    assert!(jobs[0].vae.is_none());
}

fn wan_file_with(path: &Path, channels: u64, extra: &[&str]) {
    let patch = format!("patch_embedding.weight={channels}");
    let mut tensors = vec!["blocks.0.self_attn.q.weight", patch.as_str()];
    tensors.extend(extra);
    safetensors(path, &tensors);
}

#[tokio::test]
async fn a_wan_21_image_model_needs_the_clip_vision_file_and_gets_it_in_the_job() {
    let dir = tempfile::tempdir().unwrap();
    let m = dir.path().join("models");
    wan_file_with(
        &m.join("diffusion_models/wan2.1_i2v_480p.safetensors"),
        36,
        &["img_emb.proj.0.bias"],
    );
    safetensors(&m.join("text_encoders/umt5_xxl_fp8.safetensors"), UMT5);
    safetensors(&m.join("vae/wan_2.1_vae.safetensors"), WAN_VAE);
    let (engine, backend, status) = run(dir.path(), "wan2.1_i2v").await;
    assert_eq!(status, QueueItemStatus::Failed);
    assert!(
        error_of(&backend).contains("clip_vision_h"),
        "{}",
        error_of(&backend)
    );
    assert!(engine.jobs.lock().unwrap().is_empty());
    // With the CLIP-vision file installed the job carries it.
    safetensors(
        &m.join("clip_vision/clip_vision_h.safetensors"),
        &["visual.transformer.resblocks.0.attn.in_proj_weight"],
    );
    let (engine, _, status) = run(dir.path(), "wan2.1_i2v").await;
    assert_eq!(status, QueueItemStatus::Completed);
    let jobs = engine.jobs.lock().unwrap();
    let split = jobs[0].split.as_ref().unwrap();
    assert_eq!(
        split.clip_vision.as_ref().unwrap().name,
        "clip_vision_h.safetensors"
    );
}

#[tokio::test]
async fn vace_runs_and_a_model_made_for_another_input_is_refused_by_name() {
    use novira_core::models::classify::Variant;
    let dir = tempfile::tempdir().unwrap();
    let m = dir.path().join("models");
    wan_file_with(
        &m.join("diffusion_models/wan2.1_vace_1.3B.safetensors"),
        16,
        &["vace_patch_embedding.weight", "vace_blocks.0.x"],
    );
    safetensors(&m.join("text_encoders/umt5_xxl_fp8.safetensors"), UMT5);
    safetensors(&m.join("vae/wan_2.1_vae.safetensors"), WAN_VAE);
    let (engine, _, status) = run(dir.path(), "vace").await;
    assert_eq!(status, QueueItemStatus::Completed);
    assert_eq!(
        engine.jobs.lock().unwrap()[0]
            .split
            .as_ref()
            .unwrap()
            .variant,
        Variant::WanVace
    );
    // A Fun Control file has the 5B model's 48 channels and the image embedding the 5B lacks.
    let dir = tempfile::tempdir().unwrap();
    let m = dir.path().join("models");
    wan_file_with(
        &m.join("diffusion_models/wan2.1_fun_1.3b_control.safetensors"),
        48,
        &["img_emb.proj.0.bias"],
    );
    safetensors(&m.join("text_encoders/umt5_xxl_fp8.safetensors"), UMT5);
    safetensors(&m.join("vae/wan2.2_vae.safetensors"), WAN_VAE);
    // The job carries the variant; the engine refuses it with the reason when it builds the graph (`validate`).
    let (engine, _, _) = run(dir.path(), "fun_1.3b").await;
    let jobs = engine.jobs.lock().unwrap();
    assert!(matches!(
        jobs[0].split.as_ref().unwrap().variant,
        Variant::Unsupported(why) if why.contains("Fun Control")
    ));
}
