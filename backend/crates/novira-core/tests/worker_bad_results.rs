//! The queue worker when an engine hands back something that cannot be saved: bytes that are no picture or audio, a
//! gallery folder that is gone, a voice engine that writes no file or gives up, and a folder for the temporary audio that
//! cannot be made. The usual runs are in `backend_service`.
#![allow(dead_code)]
#[path = "backend_service/common.rs"]
mod common;

use common::*;
use novira_core::engine::{Engine, EngineError, EngineJob, EngineOutput, ProgressFn};
use novira_core::types::*;
use novira_core::voice::VoiceEngine;
use novira_core::{Backend, BackendConfig};
use std::path::Path;
use std::sync::{Arc, Mutex};
use tokio_util::sync::CancellationToken;

/// An engine that answers every job with the next output it was given.
struct Scripted(Mutex<Vec<EngineOutput>>);

#[async_trait::async_trait]
impl Engine for Scripted {
    async fn generate(
        &self,
        _job: &EngineJob,
        _progress: ProgressFn<'_>,
        _cancel: &CancellationToken,
    ) -> Result<EngineOutput, EngineError> {
        Ok(self.0.lock().unwrap().remove(0))
    }
}

/// A voice engine with a fixed answer; it writes the audio file only when `writes` is set.
struct Voice {
    answer: Result<f64, String>,
    writes: bool,
}

#[async_trait::async_trait]
impl VoiceEngine for Voice {
    async fn speak(
        &self,
        _params: &VoiceParams,
        out: &Path,
        _cancel: &CancellationToken,
    ) -> Result<f64, String> {
        if self.writes {
            std::fs::write(out, b"RIFF....WAVE").unwrap();
        }
        self.answer.clone()
    }
}

fn open(dir: &Path, engine: Arc<dyn Engine>, voice: Arc<dyn VoiceEngine>) -> Backend {
    Backend::open_with_engines(
        BackendConfig {
            data_dir: dir.to_path_buf(),
            image_url_base: BASE.into(),
            settings: settings(),
        },
        engine,
        voice,
        (None, None),
    )
    .unwrap()
}

fn silent_voice() -> Arc<dyn VoiceEngine> {
    Arc::new(Voice {
        answer: Ok(1.0),
        writes: true,
    })
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

fn mp4() -> Vec<u8> {
    let mut mp4 = vec![0, 0, 0, 24];
    mp4.extend_from_slice(b"ftypmp42");
    mp4.extend_from_slice(&[0; 16]);
    mp4
}

fn mp3() -> Vec<u8> {
    b"ID3\x04\0\0\0\0\0\0a pretend mp3 file".to_vec()
}

/// Runs one job per output and returns the error each ended with.
async fn errors_for(dir: &Path, outputs: Vec<EngineOutput>, before: impl FnOnce()) -> Vec<String> {
    write_lora_and_checkpoint(&dir.join("models"));
    let n = outputs.len();
    let backend = open(dir, Arc::new(Scripted(Mutex::new(outputs))), silent_voice());
    before();
    tokio::spawn(backend.clone().run_worker());
    let key = main_key(&backend);
    for _ in 0..n {
        backend.enqueue(request(&key, "x", 1)).unwrap();
    }
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed; n]).await;
    backend.shutdown();
    backend
        .queue_snapshot()
        .items
        .into_iter()
        .map(|q| q.error.unwrap())
        .collect()
}

#[tokio::test]
async fn bytes_that_are_no_picture_fail_the_job() {
    let dir = tempfile::tempdir().unwrap();
    let errors = errors_for(
        dir.path(),
        vec![
            EngineOutput::Image(b"not a picture".to_vec()),
            EngineOutput::Video {
                mp4: mp4(),
                frame_png: b"not a picture".to_vec(),
            },
        ],
        || {},
    )
    .await;
    assert!(
        errors.iter().all(|e| e.contains("Cannot save the result")),
        "{errors:?}"
    );
}

#[tokio::test]
async fn a_gallery_folder_that_is_gone_fails_the_save_of_every_kind_of_result() {
    let dir = tempfile::tempdir().unwrap();
    let thumbnails = dir.path().join("thumbnails");
    let errors = errors_for(
        dir.path(),
        vec![
            EngineOutput::Image(png(8, 8)),
            EngineOutput::Video {
                mp4: mp4(),
                frame_png: png(8, 8),
            },
            EngineOutput::Audio {
                bytes: mp3(),
                ext: "mp3",
            },
            EngineOutput::Audio {
                bytes: b"not audio".to_vec(),
                ext: "mp3",
            },
        ],
        || std::fs::remove_dir_all(&thumbnails).unwrap(),
    )
    .await;
    assert!(
        errors.iter().all(|e| e.contains("Cannot save the result")),
        "{errors:?}"
    );
}

async fn voice_error(dir: &Path, voice: Voice) -> (QueueItemStatus, Option<String>) {
    let backend = open(dir, Arc::new(FakeEngine::default()), Arc::new(voice));
    tokio::spawn(backend.clone().run_worker());
    backend.enqueue(voice_request()).unwrap();
    wait_until(|| {
        statuses(&backend)
            .iter()
            .all(|s| *s != QueueItemStatus::Pending && *s != QueueItemStatus::InProgress)
    })
    .await;
    backend.shutdown();
    let item = backend.queue_snapshot().items.remove(0);
    (item.status, item.error)
}

#[tokio::test]
async fn a_voice_engine_that_writes_no_file_or_gives_up_ends_the_job_without_a_saved_result() {
    let dir = tempfile::tempdir().unwrap();
    let (status, error) = voice_error(
        dir.path(),
        Voice {
            answer: Ok(1.0),
            writes: false,
        },
    )
    .await;
    assert_eq!(status, QueueItemStatus::Failed);
    assert!(error.unwrap().contains("No audio was made"));

    let dir = tempfile::tempdir().unwrap();
    let (status, error) = voice_error(
        dir.path(),
        Voice {
            answer: Err("cancelled".into()),
            writes: false,
        },
    )
    .await;
    assert_eq!(status, QueueItemStatus::Canceled);
    assert_eq!(error, None);
}

#[tokio::test]
async fn a_folder_for_the_temporary_audio_that_cannot_be_made_fails_the_voice_job() {
    let dir = tempfile::tempdir().unwrap();
    // A file where the `cache` folder should be.
    std::fs::write(dir.path().join("cache"), b"not a folder").unwrap();
    let (status, error) = voice_error(
        dir.path(),
        Voice {
            answer: Ok(1.0),
            writes: true,
        },
    )
    .await;
    assert_eq!(status, QueueItemStatus::Failed);
    assert!(error.is_some());
}

/// An engine whose work panics.
struct Panicking;

#[async_trait::async_trait]
impl Engine for Panicking {
    async fn generate(
        &self,
        _job: &EngineJob,
        _progress: ProgressFn<'_>,
        _cancel: &CancellationToken,
    ) -> Result<EngineOutput, EngineError> {
        panic!("the engine blew up");
    }
}

#[tokio::test]
async fn a_job_that_panics_fails_and_the_worker_goes_on() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let backend = open(dir.path(), Arc::new(Panicking), silent_voice());
    tokio::spawn(backend.clone().run_worker());
    let key = main_key(&backend);
    backend.enqueue(request(&key, "first", 1)).unwrap();
    backend.enqueue(request(&key, "second", 1)).unwrap();
    // The second job is reached, so the panic of the first did not stop the queue.
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed; 2]).await;
    let error = backend.queue_snapshot().items[0].error.clone().unwrap();
    assert!(error.contains("the engine blew up"), "{error}");
    backend.shutdown();
}

#[tokio::test]
async fn a_lora_that_is_not_in_the_model_list_fails_the_job_by_its_key() {
    let dir = tempfile::tempdir().unwrap();
    write_lora_and_checkpoint(&dir.path().join("models"));
    let backend = open(
        dir.path(),
        Arc::new(Scripted(Mutex::new(vec![]))),
        silent_voice(),
    );
    tokio::spawn(backend.clone().run_worker());
    let mut req = request(&main_key(&backend), "x", 1);
    req.params.loras = vec![LoraParam {
        key: "lora-that-is-gone".into(),
        weight: 0.8,
        is_enabled: true,
    }];
    backend.enqueue(req).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed]).await;
    let error = backend.queue_snapshot().items[0].error.clone().unwrap();
    assert!(error.contains("LoRA model not found"), "{error}");
    backend.shutdown();
}
