//! Rare paths of the queue worker: a job cancelled while it waits for the GPU or after the voice engine ran, an engine
//! that fails after the user cancelled, a LoRA picked as the main model, and video models that need a vision model.
use super::common::*;
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, ProgressFn};
use novira_core::types::*;
use novira_core::voice::VoiceEngine;
use novira_core::{Backend, BackendConfig, Settings};
use std::path::Path;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;

/// An engine that waits for the user to cancel and then reports a failure instead of "cancelled".
struct FailsAfterCancel;

#[async_trait::async_trait]
impl Engine for FailsAfterCancel {
    async fn generate(
        &self,
        _job: &EngineJob,
        _progress: ProgressFn<'_>,
        cancel: &CancellationToken,
    ) -> Result<EngineOutput, EngineError> {
        cancel.cancelled().await;
        Err(EngineError::Failed("the connection dropped".into()))
    }
}

/// A voice engine that is cancelled while it speaks but still hands back a sound.
struct CancelledWhileSpeaking;

#[async_trait::async_trait]
impl VoiceEngine for CancelledWhileSpeaking {
    async fn speak(
        &self,
        _p: &VoiceParams,
        out: &Path,
        cancel: &CancellationToken,
    ) -> Result<f64, String> {
        cancel.cancel();
        std::fs::write(out, b"RIFF....WAVE").map_err(|e| e.to_string())?;
        Ok(0.1)
    }
}

fn open_with(
    dir: &Path,
    settings: Settings,
    engine: Arc<dyn Engine>,
    voice: Arc<dyn VoiceEngine>,
) -> Backend {
    Backend::open_with_engines(
        BackendConfig {
            data_dir: dir.to_path_buf(),
            image_url_base: BASE.into(),
            settings,
        },
        engine,
        voice,
        (None, None),
    )
    .unwrap()
}

fn error_of(b: &Backend) -> String {
    b.queue_snapshot()
        .items
        .last()
        .unwrap()
        .error
        .clone()
        .unwrap()
}

fn voice_request() -> EnqueueRequest {
    let mut req = request("", "hello", 1);
    req.params.generation_mode = GenerationMode::Voice;
    req.params.voice = Some(VoiceParams {
        text: "hello".into(),
        language: "Japanese".into(),
        mode: VoiceMode::Preset,
        speaker: "Ono_Anna".into(),
        instruct: String::new(),
    });
    req
}

fn speech_graph_request() -> EnqueueRequest {
    let mut req = request("", "", 1);
    req.origin = QueueOrigin::Workflows;
    req.params.generation_mode = GenerationMode::Graph;
    req.workflow = Some(serde_json::json!({ "nodes": [] }));
    req.comfy_graph = Some(
        serde_json::from_value(serde_json::json!({
            "prompt": {
                "say": { "class_type": "LoadAudio", "inputs": { "audio": { "$speech": {
                    "text": "hi", "language": "Auto", "mode": "preset", "speaker": "Ono_Anna", "instruct": ""
                } } } },
                "save": { "class_type": "SaveAudioAdvanced", "inputs": { "audio": ["say", 0], "format": "flac" } }
            },
            "outputs": ["save"]
        }))
        .unwrap(),
    );
    req
}

#[tokio::test]
async fn a_failure_reported_after_the_user_cancelled_is_not_recorded_as_a_failure() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let backend = open_with(
        dir.path(),
        settings(),
        Arc::new(FailsAfterCancel),
        Arc::new(CancelledWhileSpeaking),
    );
    tokio::spawn(backend.clone().run_worker());
    let id = backend
        .enqueue(request(&main_key(&backend), "a cat", 1))
        .unwrap()[0]
        .id;
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::InProgress]).await;
    backend.cancel_queue_item(id);
    wait_until(|| backend.queue_snapshot().items[0].completed_at.is_some()).await;
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    let item = &backend.queue_snapshot().items[0];
    assert_eq!(item.status, QueueItemStatus::Canceled);
    assert!(item.error.is_none(), "{:?}", item.error);
    backend.shutdown();
}

#[tokio::test]
async fn a_job_cancelled_while_it_waits_for_the_gpu_lock_is_canceled() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    // A lock folder with no owner record belongs to someone else and is never cleared.
    let lock = dir.path().join("gpu.lock");
    std::fs::create_dir_all(&lock).unwrap();
    let backend = open_with(
        dir.path(),
        Settings {
            gpu_lock: lock.to_string_lossy().into_owned(),
            ..settings()
        },
        Arc::new(FakeEngine::default()),
        Arc::new(CancelledWhileSpeaking),
    );
    tokio::spawn(backend.clone().run_worker());
    let key = main_key(&backend);
    let image = backend.enqueue(request(&key, "a cat", 1)).unwrap()[0].id;
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::InProgress]).await;
    backend.cancel_queue_item(image);
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Canceled]).await;
    // The same wait is taken before a voice job and before a graph that reads aloud.
    let voice = backend.enqueue(voice_request()).unwrap()[0].id;
    wait_until(|| statuses(&backend).last() == Some(&QueueItemStatus::InProgress)).await;
    backend.cancel_queue_item(voice);
    wait_until(|| statuses(&backend).last() == Some(&QueueItemStatus::Canceled)).await;
    let graph = backend.enqueue(speech_graph_request()).unwrap()[0].id;
    wait_until(|| statuses(&backend).last() == Some(&QueueItemStatus::InProgress)).await;
    backend.cancel_queue_item(graph);
    wait_until(|| statuses(&backend).last() == Some(&QueueItemStatus::Canceled)).await;
    assert!(lock.exists(), "the foreign lock is left alone");
    backend.shutdown();
}

#[tokio::test]
async fn a_graph_whose_speech_is_cancelled_in_the_voice_engine_ends_canceled() {
    let dir = tempfile::tempdir().unwrap();
    let engine = Arc::new(FakeEngine::default());
    let backend = open_with(
        dir.path(),
        settings(),
        engine.clone(),
        Arc::new(CancelledWhileSpeaking),
    );
    tokio::spawn(backend.clone().run_worker());
    backend.enqueue(speech_graph_request()).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Canceled]).await;
    assert!(
        engine.jobs.lock().unwrap().is_empty(),
        "ComfyUI is never asked"
    );
    backend.shutdown();
}

#[tokio::test]
async fn a_lora_given_as_the_main_model_and_an_unknown_tile_controlnet_are_told_apart() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let engine = Arc::new(FakeEngine::default());
    let (backend, _) = open(dir.path(), engine.clone());
    let lora = backend
        .bootstrap()
        .models
        .into_iter()
        .find(|m| m.kind == ModelType::Lora)
        .unwrap()
        .key;
    let key = main_key(&backend);
    tokio::spawn(backend.clone().run_worker());
    // Not a diffusion model: no split job is made, and the plain path carries on.
    backend.enqueue(request(&lora, "as main", 1)).unwrap();
    let mut upscale = request(&key, "upscale", 1);
    upscale.params.generation_mode = GenerationMode::Upscale;
    upscale.params.tile_controlnet_model_key = Some("no-such-controlnet".into());
    backend.enqueue(upscale).unwrap();
    wait_until(|| {
        let s = statuses(&backend);
        s.len() == 2
            && !s.contains(&QueueItemStatus::Pending)
            && !s.contains(&QueueItemStatus::InProgress)
    })
    .await;
    let items = backend.queue_snapshot().items;
    assert_eq!(items[0].status, QueueItemStatus::Completed);
    assert_eq!(items[1].status, QueueItemStatus::Failed);
    assert!(
        items[1]
            .error
            .as_deref()
            .unwrap()
            .contains("ControlNet model not found"),
        "{:?}",
        items[1].error
    );
    assert!(engine.jobs.lock().unwrap()[0].split.is_none());
    backend.shutdown();
}

/// A safetensors file with the given tensors (one element each) and a metadata map.
fn safetensors_with(path: &Path, tensors: &[&str], metadata: serde_json::Value) {
    let mut header = serde_json::Map::new();
    header.insert("__metadata__".into(), metadata);
    for t in tensors {
        header.insert(
            t.to_string(),
            serde_json::json!({"dtype": "BF16", "shape": [1], "data_offsets": [0, 2]}),
        );
    }
    let json = serde_json::to_vec(&header).unwrap();
    let mut bytes = (json.len() as u64).to_le_bytes().to_vec();
    bytes.extend(json);
    bytes.extend([0u8; 2]);
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, bytes).unwrap();
}

fn video_request(key: &str) -> EnqueueRequest {
    let mut req = request(key, "a wave", 1);
    req.params.generation_mode = GenerationMode::Video;
    req.params.video_frames = Some(17);
    req.params.video_fps = Some(16);
    req
}

async fn failure_of(dir: &Path, name_part: &str) -> String {
    let (backend, _) = open(dir, Arc::new(FakeEngine::default()));
    let key = backend
        .bootstrap()
        .models
        .into_iter()
        .find(|m| m.path.contains(name_part))
        .unwrap_or_else(|| panic!("{name_part} is listed"))
        .key;
    tokio::spawn(backend.clone().run_worker());
    backend.enqueue(video_request(&key)).unwrap();
    wait_until(|| {
        matches!(
            statuses(&backend).last(),
            Some(QueueItemStatus::Completed | QueueItemStatus::Failed)
        )
    })
    .await;
    let failed = statuses(&backend).last() == Some(&QueueItemStatus::Failed);
    let error = if failed {
        error_of(&backend)
    } else {
        String::new()
    };
    backend.shutdown();
    error
}

const T5: &[&str] = &[
    "encoder.block.0.layer.0.SelfAttention.q.weight",
    "shared.weight",
];

#[tokio::test]
async fn a_hunyuan_video_15_image_model_needs_the_sigclip_vision_file() {
    let dir = tempfile::tempdir().unwrap();
    let m = dir.path().join("models");
    safetensors_with(
        &m.join("diffusion_models/hunyuanvideo1.5_720p_i2v.safetensors"),
        &[
            "double_blocks.0.img_attn.qkv.weight",
            "single_blocks.0.linear1.weight",
            "txt_in.individual_token_refiner.blocks.0.norm1.weight",
            "vision_in.proj.0.weight",
        ],
        serde_json::json!({"model_type": "hunyuanvideo1.5_720p_i2v"}),
    );
    safetensors_with(
        &m.join("text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors"),
        &[
            "model.embed_tokens.weight",
            "model.layers.0.self_attn.q_proj.weight",
            "visual.blocks.0.attn.qkv.weight",
        ],
        serde_json::json!({}),
    );
    safetensors_with(
        &m.join("text_encoders/byt5_small_glyphxl_fp16.safetensors"),
        T5,
        serde_json::json!({}),
    );
    let error = failure_of(dir.path(), "hunyuanvideo1.5").await;
    assert!(error.contains("HunyuanVideo 1.5 image to video"), "{error}");
}

#[tokio::test]
async fn a_gguf_wan_model_is_told_apart_by_its_name_alone() {
    let dir = tempfile::tempdir().unwrap();
    let m = dir.path().join("models");
    std::fs::create_dir_all(m.join("diffusion_models")).unwrap();
    std::fs::write(
        m.join("diffusion_models/wan2.1_i2v_14B-Q4_K_M.gguf"),
        b"GGUF",
    )
    .unwrap();
    std::fs::write(m.join("diffusion_models/wan_mystery-Q4_K_M.gguf"), b"GGUF").unwrap();
    safetensors_with(
        &m.join("text_encoders/umt5_xxl_fp8.safetensors"),
        T5,
        serde_json::json!({}),
    );
    // An image-to-video file that is not Wan 2.2's carries the image embedding: it wants the CLIP-vision file.
    let error = failure_of(dir.path(), "wan2.1_i2v").await;
    assert!(error.contains("clip_vision_h"), "{error}");
    let error = failure_of(dir.path(), "wan_mystery").await;
    assert!(error.contains("Cannot tell what"), "{error}");
}
