//! The queue worker on its refusal and failure paths: unsupported models, packs that are not installed, a waiting
//! GPU lock that is given up, and engines that answer with nothing. The normal runs are in `backend_service`.
#![allow(dead_code)]
#[path = "backend_service/common.rs"]
mod common;

use common::*;
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, ProgressFn};
use novira_core::packs::{self, PackKind};
use novira_core::types::*;
use novira_core::voice::QwenVoice;
use novira_core::{Backend, BackendConfig, BackendError, Settings};
use serde_json::json;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tokio_util::sync::CancellationToken;

/// How the odd engine ends a job.
#[derive(Clone, Copy)]
enum Mode {
    /// Finishes without a result.
    Nothing,
    /// Gives up by itself, without the user having cancelled.
    Cancelled,
}

struct Odd {
    mode: Mode,
}

#[async_trait::async_trait]
impl Engine for Odd {
    async fn generate(
        &self,
        _job: &EngineJob,
        _progress: ProgressFn<'_>,
        _cancel: &CancellationToken,
    ) -> Result<EngineOutput, EngineError> {
        match self.mode {
            Mode::Nothing => Ok(EngineOutput::Nothing),
            Mode::Cancelled => Err(EngineError::Cancelled),
        }
    }
}

type Events = Arc<Mutex<Vec<BackendEvent>>>;

fn open_with(dir: &Path, engine: Arc<dyn Engine>, settings: Settings) -> (Backend, Events) {
    let voice = Arc::new(QwenVoice::new(
        dir.to_path_buf(),
        dir.join("models"),
        None,
        None,
    ));
    let backend = Backend::open_with_engines(
        BackendConfig {
            data_dir: dir.to_path_buf(),
            image_url_base: BASE.into(),
            settings,
        },
        engine,
        voice,
        (None, Some(dir.join("comfy"))),
    )
    .unwrap();
    let events: Events = Arc::default();
    let sink = events.clone();
    backend.set_event_sink(Arc::new(move |e| sink.lock().unwrap().push(e)));
    (backend, events)
}

fn odd(_dir: &Path, mode: Mode) -> Arc<Odd> {
    Arc::new(Odd { mode })
}

fn last_error(b: &Backend) -> String {
    b.queue_snapshot().items[0]
        .error
        .clone()
        .unwrap_or_default()
}

async fn fails_with(b: &Backend, req: EnqueueRequest) -> String {
    b.enqueue(req).unwrap();
    wait_until(|| statuses(b) == vec![QueueItemStatus::Failed]).await;
    last_error(b)
}

// Refusals by the worker ----------------------------------------------------------------------------------------

// A video family's model has no picture graph; Flux, which the picture graph now runs, no longer fails here.
#[tokio::test]
async fn a_model_of_a_base_the_backend_cannot_run_fails_the_job_with_its_name() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let (backend, _) = open_with(dir.path(), Arc::new(FakeEngine::default()), settings());
    tokio::spawn(backend.clone().run_worker());
    let key = main_key(&backend);
    backend
        .update_model(&key, json!({ "base": "hunyuan-video" }))
        .unwrap();
    let err = fails_with(&backend, request(&key, "a cat", 1)).await;
    assert!(
        err.contains("hunyuan-video") && err.contains("not supported by the ComfyUI backend"),
        "{err}"
    );
}

#[tokio::test]
async fn video_music_and_logo_jobs_need_their_packs() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open_with(dir.path(), Arc::new(FakeEngine::default()), settings());
    tokio::spawn(backend.clone().run_worker());
    for (mode, key, expected) in [
        (
            GenerationMode::Video,
            "video-turbo",
            "video models are not installed",
        ),
        (
            GenerationMode::Video,
            "video",
            "video models are not installed",
        ),
        (
            GenerationMode::Music,
            "music",
            "music model is not installed",
        ),
        (GenerationMode::Logo, "logo", "logo model is not installed"),
    ] {
        let mut req = request(key, "a cat", 1);
        req.params.generation_mode = mode;
        let err = fails_with(&backend, req).await;
        assert!(err.contains(expected), "{key}: {err}");
        backend.clear_queue().unwrap();
    }
}

#[tokio::test]
async fn an_upscale_model_that_is_unknown_fails_the_job() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let (backend, _) = open_with(dir.path(), Arc::new(FakeEngine::default()), settings());
    tokio::spawn(backend.clone().run_worker());
    let key = main_key(&backend);

    let mut req = request(&key, "a cat", 1);
    req.params.generation_mode = GenerationMode::Upscale;
    req.params.upscale_model_key = Some("no-such-upscaler".into());
    let err = fails_with(&backend, req).await;
    assert!(err.contains("Upscale model not found"), "{err}");
}

#[tokio::test]
async fn a_post_processing_model_that_is_unknown_fails_the_job() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let (backend, _) = open_with(dir.path(), Arc::new(FakeEngine::default()), settings());
    tokio::spawn(backend.clone().run_worker());
    let key = main_key(&backend);

    let mut req = request(&key, "a cat", 1);
    req.params.generation_mode = GenerationMode::Upscale;
    req.params.post_processing_model_key = Some("no-such-finisher".into());
    let err = fails_with(&backend, req).await;
    assert!(err.contains("Upscale model not found"), "{err}");
}

#[tokio::test]
async fn an_engine_that_finishes_without_a_result_fails_the_job() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let (backend, _) = open_with(dir.path(), odd(dir.path(), Mode::Nothing), settings());
    tokio::spawn(backend.clone().run_worker());
    let key = main_key(&backend);
    let err = fails_with(&backend, request(&key, "a cat", 1)).await;
    assert!(err.contains("without a result"), "{err}");
}

#[tokio::test]
async fn an_engine_that_gives_up_by_itself_cancels_the_job_without_an_error() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let (backend, _) = open_with(dir.path(), odd(dir.path(), Mode::Cancelled), settings());
    tokio::spawn(backend.clone().run_worker());
    let key = main_key(&backend);
    backend.enqueue(request(&key, "a cat", 1)).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Canceled]).await;
    assert_eq!(last_error(&backend), "");
}

#[tokio::test]
async fn the_turbo_video_model_runs_once_its_pack_is_installed() {
    let dir = tempfile::tempdir().unwrap();
    let models = dir.path().join("models");
    for kind in [PackKind::Video, PackKind::Turbo] {
        for f in packs::files(kind) {
            let path = packs::file_path(&models, kind, f);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(path, b"x").unwrap();
        }
    }
    let engine = Arc::new(FakeEngine::default());
    let (backend, _) = open_with(dir.path(), engine.clone(), settings());
    tokio::spawn(backend.clone().run_worker());
    let mut req = request(packs::TURBO_KEY, "a cat", 1);
    req.params.generation_mode = GenerationMode::Video;
    backend.enqueue(req).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Completed]).await;
    let job = engine.jobs.lock().unwrap()[0].clone();
    assert_eq!(job.checkpoint, packs::video_turbo_unet_ref());
}

#[tokio::test]
async fn a_picture_deleted_while_its_job_waits_fails_the_job_by_name() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open_with(dir.path(), Arc::new(FakeEngine::default()), settings());
    let photo = backend
        .upload_image(png(30, 20), ImageOptions::default())
        .await
        .unwrap();
    let mut req = request("", "", 1);
    req.origin = QueueOrigin::Workflows;
    req.params.generation_mode = GenerationMode::Graph;
    req.comfy_graph = Some(
        serde_json::from_value(json!({
            "prompt": {
                "src": { "class_type": "LoadImage", "inputs": { "image": { "$image": photo.name } } },
                "show": { "class_type": "PreviewAny", "inputs": { "source": ["src", 0] } }
            },
            "outputs": ["show"]
        }))
        .unwrap(),
    );
    backend.enqueue(req).unwrap();
    // The job is queued but the worker has not started; the picture goes away.
    backend
        .delete_images(std::slice::from_ref(&photo.name))
        .unwrap();
    tokio::spawn(backend.clone().run_worker());
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed]).await;
    let err = last_error(&backend);
    assert!(
        err.contains(&photo.name) && err.contains("deleted"),
        "{err}"
    );
}

// A GPU lock that someone else holds ----------------------------------------------------------------------------

fn locked_settings(lock: &Path) -> Settings {
    Settings {
        gpu_lock: lock.to_string_lossy().into_owned(),
        ..settings()
    }
}

async fn wait_for_the_lock_message(events: &Events) {
    wait_until(|| {
        events.lock().unwrap().iter().any(|e| {
            matches!(e, BackendEvent::InvocationProgress { progress }
                if progress.message == "waiting for GPU lock")
        })
    })
    .await;
}

#[tokio::test]
async fn a_picture_job_waiting_for_the_gpu_lock_can_be_cancelled_and_leaves_the_lock_alone() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let lock = dir.path().join("gpu.lock");
    std::fs::create_dir(&lock).unwrap();
    let (backend, events) = open_with(
        dir.path(),
        Arc::new(FakeEngine::default()),
        locked_settings(&lock),
    );
    tokio::spawn(backend.clone().run_worker());
    let key = main_key(&backend);
    let id = backend.enqueue(request(&key, "a cat", 1)).unwrap()[0].id;
    wait_for_the_lock_message(&events).await;
    backend.cancel_queue_item(id);
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Canceled]).await;
    assert!(lock.is_dir(), "somebody else's lock is never removed");
}

#[tokio::test]
async fn a_voice_job_waiting_for_the_gpu_lock_can_be_cancelled() {
    let dir = tempfile::tempdir().unwrap();
    let lock = dir.path().join("gpu.lock");
    std::fs::create_dir(&lock).unwrap();
    let (backend, events) = open_with(
        dir.path(),
        Arc::new(FakeEngine::default()),
        locked_settings(&lock),
    );
    tokio::spawn(backend.clone().run_worker());
    let mut req = request("", "", 1);
    req.params.generation_mode = GenerationMode::Voice;
    req.params.voice = Some(VoiceParams {
        text: "hello".into(),
        language: "English".into(),
        mode: VoiceMode::Preset,
        speaker: "Ryan".into(),
        instruct: String::new(),
    });
    let id = backend.enqueue(req).unwrap()[0].id;
    wait_for_the_lock_message(&events).await;
    backend.cancel_queue_item(id);
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Canceled]).await;
}

#[tokio::test]
async fn a_voice_job_without_text_is_refused_before_it_is_queued_or_fails_when_run() {
    let dir = tempfile::tempdir().unwrap();
    let (backend, _) = open_with(dir.path(), Arc::new(FakeEngine::default()), settings());
    tokio::spawn(backend.clone().run_worker());
    let mut req = request("", "", 1);
    req.params.generation_mode = GenerationMode::Voice;
    req.params.voice = Some(VoiceParams {
        text: "   ".into(),
        language: "English".into(),
        mode: VoiceMode::Preset,
        speaker: "Ryan".into(),
        instruct: String::new(),
    });
    match backend.enqueue(req) {
        Err(BackendError::Invalid(_)) => {}
        Ok(_) => wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed]).await,
        Err(e) => panic!("unexpected error: {e}"),
    }
}
