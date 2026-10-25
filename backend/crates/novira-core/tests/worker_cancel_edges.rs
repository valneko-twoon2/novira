//! The queue worker when a job is cancelled at the last moment and when the GPU lock cannot be taken at all. The usual
//! runs are in `backend_service`.
#![allow(dead_code)]
#[path = "backend_service/common.rs"]
mod common;

use common::*;
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, ProgressFn};
use novira_core::types::*;
use novira_core::voice::VoiceEngine;
use novira_core::{Backend, BackendConfig, Settings};
use std::path::Path;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;

/// An engine that is cancelled while it works and still hands back a picture.
struct CancelledWhileWorking;

#[async_trait::async_trait]
impl Engine for CancelledWhileWorking {
    async fn generate(
        &self,
        _job: &EngineJob,
        _progress: ProgressFn<'_>,
        cancel: &CancellationToken,
    ) -> Result<EngineOutput, EngineError> {
        cancel.cancel();
        Ok(EngineOutput::Image(png(8, 8)))
    }
}

/// A voice engine that is cancelled while it speaks and still writes the audio.
struct CancelledWhileSpeaking;

#[async_trait::async_trait]
impl VoiceEngine for CancelledWhileSpeaking {
    async fn speak(
        &self,
        _params: &VoiceParams,
        out: &Path,
        cancel: &CancellationToken,
    ) -> Result<f64, String> {
        std::fs::write(out, b"RIFF....WAVE").unwrap();
        cancel.cancel();
        Ok(1.0)
    }
}

fn open(
    dir: &Path,
    engine: Arc<dyn Engine>,
    voice: Arc<dyn VoiceEngine>,
    settings: Settings,
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

fn silent_voice(dir: &Path) -> Arc<dyn VoiceEngine> {
    Arc::new(novira_core::voice::QwenVoice::new(
        dir.to_path_buf(),
        dir.join("models"),
        None,
        None,
    ))
}

fn voice_request() -> EnqueueRequest {
    let mut req = request("", "", 1);
    req.params.generation_mode = GenerationMode::Voice;
    req.params.voice = Some(VoiceParams {
        text: "hello".into(),
        language: "English".into(),
        mode: VoiceMode::Preset,
        speaker: "Ryan".into(),
        instruct: String::new(),
    });
    req
}

#[tokio::test]
async fn a_picture_job_cancelled_just_as_it_finishes_is_cancelled_not_saved() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let backend = open(
        dir.path(),
        Arc::new(CancelledWhileWorking),
        silent_voice(dir.path()),
        settings(),
    );
    tokio::spawn(backend.clone().run_worker());
    let key = main_key(&backend);
    backend.enqueue(request(&key, "a cat", 1)).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Canceled]).await;
}

#[tokio::test]
async fn a_voice_job_cancelled_just_as_it_finishes_is_cancelled_not_saved() {
    let dir = tempfile::tempdir().unwrap();
    let backend = open(
        dir.path(),
        Arc::new(FakeEngine::default()),
        Arc::new(CancelledWhileSpeaking),
        settings(),
    );
    tokio::spawn(backend.clone().run_worker());
    backend.enqueue(voice_request()).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Canceled]).await;
}

#[tokio::test]
async fn a_gpu_lock_that_cannot_be_taken_fails_the_job_with_the_path() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    // The lock would have to live inside a file.
    let blocker = dir.path().join("blocker");
    std::fs::write(&blocker, b"x").unwrap();
    let lock = blocker.join("gpu.lock");
    let backend = open(
        dir.path(),
        Arc::new(FakeEngine::default()),
        silent_voice(dir.path()),
        Settings {
            gpu_lock: lock.to_string_lossy().into_owned(),
            ..settings()
        },
    );
    tokio::spawn(backend.clone().run_worker());
    let key = main_key(&backend);
    backend.enqueue(request(&key, "a cat", 1)).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed]).await;
    let err = backend.queue_snapshot().items[0].error.clone().unwrap();
    assert!(err.contains("Cannot take the GPU lock"), "{err}");
    assert!(err.contains("gpu.lock"), "{err}");
}
