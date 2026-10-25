//! Video, music and voice jobs and how their results are stored.
use super::common::*;
use novira_core::packs::{self, PackKind, PackStatus};
use novira_core::types::*;
use novira_core::voice::VoiceEngine;
use novira_core::{Backend, BackendConfig};
use std::path::Path;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;

fn write_video_pack(models: &Path) {
    for f in packs::files(PackKind::Video) {
        let path = packs::file_path(models, PackKind::Video, f);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, b"x").unwrap();
    }
}

fn video_request(init_image_url: Option<&str>) -> EnqueueRequest {
    let mut req = request("", "a rolling wave", 1);
    req.params.generation_mode = GenerationMode::Video;
    req.params.width = 832;
    req.params.height = 480;
    req.params.video_frames = Some(49);
    req.params.video_fps = Some(24);
    req.init_image_url = init_image_url.map(String::from);
    req
}

#[tokio::test]
async fn video_needs_the_pack_and_is_stored_as_an_mp4_with_a_thumbnail() {
    let dir = tempfile::tempdir().unwrap();
    let engine = Arc::new(FakeEngine::default());
    let (backend, _events) = open(dir.path(), engine.clone());
    tokio::spawn(backend.clone().run_worker());

    // Without the pack the job fails with a reason that says what to do.
    backend.enqueue(video_request(None)).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed]).await;
    let reason = backend.queue_snapshot().items[0].error.clone().unwrap();
    assert!(reason.contains("not installed"), "{reason}");

    write_video_pack(&dir.path().join("models"));
    backend.enqueue(video_request(None)).unwrap();
    wait_until(|| statuses(&backend).last() == Some(&QueueItemStatus::Completed)).await;
    let job = engine.jobs.lock().unwrap().last().unwrap().clone();
    assert_eq!(job.checkpoint.folder, "diffusion_models");
    assert_eq!(job.text_encoder.as_ref().unwrap().folder, "text_encoders");
    assert_eq!(job.vae.as_ref().unwrap().folder, "vae");

    let image = backend
        .bootstrap()
        .images
        .into_iter()
        .find(|i| i.media_type == MediaType::Video)
        .unwrap();
    assert!(image.name.ends_with(".mp4"));
    assert_eq!((image.width, image.height), (104, 60));
    assert_eq!(image.metadata.unwrap().video_frames, Some(49));
    let (bytes, ct) = backend.read_image("full", &image.name).unwrap();
    assert_eq!(ct, "video/mp4");
    assert_eq!(&bytes[4..8], b"ftyp");
    let (_, thumb_ct) = backend.read_image("thumb", &image.name).unwrap();
    assert_eq!(thumb_ct, "image/jpeg");
}

#[tokio::test]
async fn a_video_cannot_be_used_as_a_source_image() {
    let dir = tempfile::tempdir().unwrap();
    write_video_pack(&dir.path().join("models"));
    let (backend, _events) = open(dir.path(), Arc::new(FakeEngine::default()));
    tokio::spawn(backend.clone().run_worker());
    backend.enqueue(video_request(None)).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Completed]).await;
    let video = backend
        .bootstrap()
        .images
        .into_iter()
        .find(|i| i.media_type == MediaType::Video)
        .unwrap();
    backend.enqueue(video_request(Some(&video.url))).unwrap();
    wait_until(|| statuses(&backend).last() == Some(&QueueItemStatus::Failed)).await;
    let reason = backend.queue_snapshot().items[1].error.clone().unwrap();
    assert!(reason.contains("video cannot be a source"), "{reason}");
}

#[tokio::test]
async fn a_logo_needs_the_logo_pack_and_loads_its_three_files() {
    let dir = tempfile::tempdir().unwrap();
    let engine = Arc::new(FakeEngine::default());
    let (backend, _events) = open(dir.path(), engine.clone());
    tokio::spawn(backend.clone().run_worker());
    let logo_request = || {
        let mut req = request("", "A logo with the text \"NOVA\"", 1);
        req.params.generation_mode = GenerationMode::Logo;
        req.params.steps = 8;
        req
    };

    backend.enqueue(logo_request()).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed]).await;
    let reason = backend.queue_snapshot().items[0].error.clone().unwrap();
    assert!(reason.contains("logo model is not installed"), "{reason}");
    assert!(matches!(
        backend.pack_status(PackKind::Logo),
        PackStatus::Missing { .. }
    ));

    let models = dir.path().join("models");
    for f in packs::files(PackKind::Logo) {
        let path = packs::file_path(&models, PackKind::Logo, f);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, b"x").unwrap();
    }
    backend.enqueue(logo_request()).unwrap();
    wait_until(|| statuses(&backend).last() == Some(&QueueItemStatus::Completed)).await;
    let job = engine.jobs.lock().unwrap().last().unwrap().clone();
    assert_eq!(job.checkpoint.name, "z-image-turbo-fp8-e4m3fn.safetensors");
    assert_eq!(
        job.text_encoder.unwrap().name,
        "qwen_3_4b_fp8_mixed.safetensors"
    );
    assert_eq!(job.vae.unwrap().name, "ae.safetensors");
    assert!(job.loras.is_empty());

    // The finished logo is an asset, not a general picture.
    let logo = backend.bootstrap().images.into_iter().next().unwrap();
    assert_eq!(logo.category, ImageCategory::Other);
    assert_eq!(logo.metadata.unwrap().generation_mode, GenerationMode::Logo);
}

fn write_music_pack(models: &Path) {
    for f in packs::files(PackKind::Music) {
        let path = packs::file_path(models, PackKind::Music, f);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, b"x").unwrap();
    }
}

fn music_request() -> EnqueueRequest {
    let mut req = request("", "city pop, warm, female vocals", 1);
    req.params.generation_mode = GenerationMode::Music;
    req.params.steps = 8;
    req.params.cfg_scale = 1.0;
    req.params.music = Some(MusicParams {
        lyrics: "[Verse]\nla la".into(),
        seconds: 60,
        bpm: 120,
        key: "C major".into(),
        time_signature: 4,
        language: "ja".into(),
        instrumental: false,
    });
    req
}

#[tokio::test]
async fn music_needs_the_pack_and_is_stored_as_audio_with_a_waveform_thumbnail() {
    let dir = tempfile::tempdir().unwrap();
    let engine = Arc::new(FakeEngine::default());
    let (backend, _events) = open(dir.path(), engine.clone());
    assert!(matches!(
        backend.pack_status(PackKind::Music),
        PackStatus::Missing { .. }
    ));
    tokio::spawn(backend.clone().run_worker());

    backend.enqueue(music_request()).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed]).await;
    let reason = backend.queue_snapshot().items[0].error.clone().unwrap();
    assert!(reason.contains("music model is not installed"), "{reason}");

    write_music_pack(&dir.path().join("models"));
    backend.enqueue(music_request()).unwrap();
    wait_until(|| statuses(&backend).last() == Some(&QueueItemStatus::Completed)).await;
    let job = engine.jobs.lock().unwrap().last().unwrap().clone();
    assert_eq!(job.checkpoint.folder, "checkpoints");
    assert!(job.checkpoint.name.contains("ace_step"));
    assert!(job.vae.is_none() && job.loras.is_empty());

    let image = backend
        .bootstrap()
        .images
        .into_iter()
        .find(|i| i.media_type == MediaType::Audio)
        .unwrap();
    assert!(image.name.ends_with(".mp3"));
    assert_eq!((image.width, image.height), (256, 144));
    assert_eq!(
        image
            .metadata
            .as_ref()
            .unwrap()
            .music
            .as_ref()
            .unwrap()
            .seconds,
        60
    );
    let (bytes, ct) = backend.read_image("full", &image.name).unwrap();
    assert_eq!(ct, "audio/mpeg");
    assert!(bytes.starts_with(b"ID3"));
    let (_, thumb_ct) = backend.read_image("thumb", &image.name).unwrap();
    assert_eq!(thumb_ct, "image/png");
}

/// A voice engine that writes a short WAV, or fails when the text says so.
struct FakeVoice;

#[async_trait::async_trait]
impl VoiceEngine for FakeVoice {
    async fn speak(
        &self,
        p: &VoiceParams,
        out: &Path,
        _: &CancellationToken,
    ) -> Result<f64, String> {
        if p.text.contains("[fail]") {
            return Err("the voice engine failed".into());
        }
        let samples: Vec<u8> = (0..4800i16).flat_map(|i| (i * 5).to_le_bytes()).collect();
        let mut wav = Vec::new();
        wav.extend_from_slice(b"RIFF");
        wav.extend_from_slice(&(36 + samples.len() as u32).to_le_bytes());
        wav.extend_from_slice(b"WAVEfmt ");
        wav.extend_from_slice(&16u32.to_le_bytes());
        wav.extend_from_slice(&1u16.to_le_bytes());
        wav.extend_from_slice(&1u16.to_le_bytes());
        wav.extend_from_slice(&24000u32.to_le_bytes());
        wav.extend_from_slice(&48000u32.to_le_bytes());
        wav.extend_from_slice(&2u16.to_le_bytes());
        wav.extend_from_slice(&16u16.to_le_bytes());
        wav.extend_from_slice(b"data");
        wav.extend_from_slice(&(samples.len() as u32).to_le_bytes());
        wav.extend_from_slice(&samples);
        std::fs::write(out, wav).map_err(|e| e.to_string())?;
        Ok(0.2)
    }
}

fn voice_request(text: &str) -> EnqueueRequest {
    let mut req = request("", text, 1);
    req.params.generation_mode = GenerationMode::Voice;
    req.params.voice = Some(VoiceParams {
        text: text.into(),
        language: "Japanese".into(),
        mode: VoiceMode::Preset,
        speaker: "Ono_Anna".into(),
        instruct: String::new(),
    });
    req
}

#[tokio::test]
async fn speech_is_made_by_the_voice_engine_and_stored_as_a_wav() {
    let dir = tempfile::tempdir().unwrap();
    let backend = Backend::open_with_engines(
        BackendConfig {
            data_dir: dir.path().to_path_buf(),
            image_url_base: BASE.into(),
            settings: settings(),
        },
        Arc::new(FakeEngine::default()),
        Arc::new(FakeVoice),
        (None, None),
    )
    .unwrap();
    tokio::spawn(backend.clone().run_worker());

    backend.enqueue(voice_request("こんにちは")).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Completed]).await;
    let image = backend
        .bootstrap()
        .images
        .into_iter()
        .find(|i| i.media_type == MediaType::Audio)
        .unwrap();
    assert!(image.name.ends_with(".wav"));
    assert_eq!(
        image
            .metadata
            .as_ref()
            .unwrap()
            .voice
            .as_ref()
            .unwrap()
            .speaker,
        "Ono_Anna"
    );
    let (bytes, ct) = backend.read_image("full", &image.name).unwrap();
    assert_eq!(ct, "audio/wav");
    assert_eq!(&bytes[..4], b"RIFF");
    // The scratch file the engine wrote is gone.
    let temp = dir.path().join("cache").join("temp");
    assert_eq!(std::fs::read_dir(temp).unwrap().count(), 0);

    // A failure of the engine and an empty text both fail the job with a reason.
    backend.enqueue(voice_request("[fail] x")).unwrap();
    wait_until(|| statuses(&backend).last() == Some(&QueueItemStatus::Failed)).await;
    assert_eq!(
        backend.queue_snapshot().items[1].error.as_deref(),
        Some("the voice engine failed")
    );
    backend.enqueue(voice_request("   ")).unwrap();
    wait_until(|| {
        statuses(&backend).len() == 3 && statuses(&backend)[2] == QueueItemStatus::Failed
    })
    .await;
    assert!(backend.queue_snapshot().items[2]
        .error
        .as_deref()
        .unwrap()
        .contains("no text"));
}

/// A graph that loads speech (`$speech`) and saves it as a sound, the way the workflow editor compiles its Read Aloud node.
fn speech_graph_request(text: &str) -> EnqueueRequest {
    let mut req = request("", "", 1);
    req.origin = QueueOrigin::Workflows;
    req.params.generation_mode = GenerationMode::Graph;
    req.workflow = Some(serde_json::json!({ "nodes": [] }));
    req.comfy_graph = Some(
        serde_json::from_value(serde_json::json!({
            "prompt": {
                "say": { "class_type": "LoadAudio", "inputs": { "audio": { "$speech": {
                    "text": text, "language": "Auto", "mode": "preset", "speaker": "Ono_Anna", "instruct": ""
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
async fn a_graph_that_reads_text_aloud_gets_the_speech_uploaded_before_the_run() {
    let dir = tempfile::tempdir().unwrap();
    let engine = Arc::new(FakeEngine::default());
    let backend = Backend::open_with_engines(
        BackendConfig {
            data_dir: dir.path().to_path_buf(),
            image_url_base: BASE.into(),
            settings: settings(),
        },
        engine.clone(),
        Arc::new(FakeVoice),
        (None, None),
    )
    .unwrap();
    tokio::spawn(backend.clone().run_worker());

    backend
        .enqueue(speech_graph_request("Good morning"))
        .unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Completed]).await;
    {
        let jobs = engine.jobs.lock().unwrap();
        let graph = jobs[0].graph.as_ref().unwrap();
        assert_eq!(
            graph.prompt["say"]["inputs"]["audio"],
            serde_json::json!({ "$image": "speech-1.wav" })
        );
        assert_eq!(graph.images.len(), 1);
        assert_eq!(graph.images[0].0, "speech-1.wav");
        assert_eq!(&graph.images[0].1[..4], b"RIFF", "the voice engine's sound");
    }
    // The scratch file of the voice engine is gone.
    let temp = dir.path().join("cache").join("temp");
    assert_eq!(std::fs::read_dir(temp).unwrap().count(), 0);

    // A voice that fails fails the job before ComfyUI is asked; a speech with no text is refused before the GPU is taken.
    backend.enqueue(speech_graph_request("[fail] x")).unwrap();
    wait_until(|| statuses(&backend).last() == Some(&QueueItemStatus::Failed)).await;
    assert_eq!(
        backend.queue_snapshot().items[1].error.as_deref(),
        Some("the voice engine failed")
    );
    backend.enqueue(speech_graph_request("  ")).unwrap();
    wait_until(|| {
        statuses(&backend).len() == 3 && statuses(&backend)[2] == QueueItemStatus::Failed
    })
    .await;
    assert!(backend.queue_snapshot().items[2]
        .error
        .as_deref()
        .unwrap()
        .contains("no text to read"));
    assert_eq!(
        engine.jobs.lock().unwrap().len(),
        1,
        "only the first run reached ComfyUI"
    );
}

#[tokio::test]
async fn without_the_voice_engine_installed_speech_fails_with_a_reason() {
    let dir = tempfile::tempdir().unwrap();
    // `open_with_engine` uses the real voice engine, which refuses until it is installed.
    let (backend, _events) = open(dir.path(), Arc::new(FakeEngine::default()));
    tokio::spawn(backend.clone().run_worker());
    backend.enqueue(voice_request("hello")).unwrap();
    wait_until(|| statuses(&backend) == vec![QueueItemStatus::Failed]).await;
    let reason = backend.queue_snapshot().items[0].error.clone().unwrap();
    assert!(reason.contains("voice engine"), "{reason}");
    assert!(matches!(
        backend.pack_status(PackKind::Voice),
        PackStatus::Missing { .. }
    ));
    assert!(matches!(
        backend.bootstrap().packs.voice,
        PackStatus::Missing { .. }
    ));
}
