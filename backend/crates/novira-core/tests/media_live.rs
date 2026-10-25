//! Makes real speech and music: downloads the packs and runs the real engines. Run on purpose, one at a time, while
//! the GPU is free: `NOVIRA_LIVE_DATA=<data folder> cargo test -p novira-core --test media_live voice -- --ignored --nocapture`
//! (use `music` for the song). The data folder's `settings.json` says where ComfyUI is.
use novira_core::packs::{PackKind, PackStatus};
use novira_core::types::*;
use novira_core::{Backend, BackendConfig, Settings};
use std::path::PathBuf;
use std::time::{Duration, Instant};

fn open() -> Backend {
    let data_dir = PathBuf::from(std::env::var("NOVIRA_LIVE_DATA").expect("set NOVIRA_LIVE_DATA"));
    let settings = Settings::load(&data_dir).unwrap();
    Backend::open(BackendConfig {
        data_dir,
        image_url_base: "http://novira-image.localhost".into(),
        settings,
    })
    .unwrap()
}

async fn install(backend: &Backend, kind: PackKind) {
    let started = Instant::now();
    // Starts the download in the background; the status tells how far it is.
    backend.install_pack(kind).await.unwrap();
    let mut last_print = 0;
    loop {
        let status = backend.pack_status(kind);
        let elapsed = started.elapsed().as_secs();
        match &status {
            PackStatus::Ready => break,
            PackStatus::Error { message } => panic!("install failed: {message}"),
            // Right after the start the task has not reported yet.
            PackStatus::Missing { .. } if elapsed >= 5 => panic!("install stopped: {status:?}"),
            PackStatus::Downloading {
                file,
                index,
                count,
                bytes,
                total_bytes,
            } if elapsed >= last_print + 30 => {
                println!(
                    "[{elapsed:>4}s] downloading {index}/{count} {file}: {} of {} MB",
                    bytes / 1_000_000,
                    total_bytes / 1_000_000
                );
                last_print = elapsed;
            }
            PackStatus::Installing { step } if elapsed >= last_print + 30 => {
                println!("[{elapsed:>4}s] installing {step}");
                last_print = elapsed;
            }
            _ => {}
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
    println!("installed in {}s", started.elapsed().as_secs());
}

async fn run_one(backend: &Backend, request: EnqueueRequest, media: MediaType) -> ImageDTO {
    tokio::spawn(backend.clone().run_worker());
    backend.enqueue(request).unwrap();
    let started = Instant::now();
    loop {
        let snapshot = backend.queue_snapshot();
        let item = snapshot.items.last().unwrap();
        match item.status {
            QueueItemStatus::Completed => break,
            QueueItemStatus::Failed => panic!("failed: {:?}", item.error),
            _ => {}
        }
        assert!(
            started.elapsed() < Duration::from_secs(1800),
            "took too long"
        );
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    println!("generated in {}s", started.elapsed().as_secs());
    backend
        .bootstrap()
        .images
        .into_iter()
        .find(|i| i.media_type == media)
        .expect("the generated file")
}

fn params(mode: GenerationMode, prompt: &str) -> GenerationMetadata {
    serde_json::from_value(serde_json::json!({
        "generationMode": mode, "positivePrompt": prompt, "negativePrompt": "", "modelKey": "",
        "modelName": "live", "vaeKey": null, "seed": 42, "steps": 8, "cfgScale": 1.0, "cfgRescale": 0.0,
        "scheduler": "euler", "width": 256, "height": 144, "clipSkip": 0, "seamlessX": false,
        "seamlessY": false, "loras": []
    }))
    .unwrap()
}

fn enqueue_of(params: GenerationMetadata) -> EnqueueRequest {
    serde_json::from_value(serde_json::json!({
        "origin": "generate", "destination": "gallery", "iterations": 1, "randomizeSeed": false,
        "prepend": false, "boardId": null, "params": params
    }))
    .unwrap()
}

#[tokio::test]
#[ignore = "downloads about 9 GB and uses the GPU"]
async fn voice_installs_and_speaks() {
    let backend = open();
    install(&backend, PackKind::Voice).await;
    let mut p = params(GenerationMode::Voice, "");
    p.voice = Some(VoiceParams {
        text: "こんにちは。今日はとてもいい天気ですね。".into(),
        language: "Japanese".into(),
        mode: VoiceMode::Preset,
        speaker: "Ono_Anna".into(),
        instruct: String::new(),
    });
    let image = run_one(&backend, enqueue_of(p), MediaType::Audio).await;
    let (bytes, content_type) = backend.read_image("full", &image.name).unwrap();
    println!("{} ({content_type}, {} bytes)", image.name, bytes.len());
    assert_eq!(content_type, "audio/wav");
    assert!(bytes.len() > 20_000);
    backend.shutdown();
}

#[tokio::test]
#[ignore = "downloads about 10 GB and uses the GPU"]
async fn music_installs_and_composes() {
    let backend = open();
    install(&backend, PackKind::Music).await;
    let mut p = params(
        GenerationMode::Music,
        "calm lo-fi piano, soft drums, relaxing",
    );
    p.music = Some(MusicParams {
        lyrics: String::new(),
        seconds: 30,
        bpm: 90,
        key: "C major".into(),
        time_signature: 4,
        language: "unknown".into(),
        instrumental: true,
    });
    let image = run_one(&backend, enqueue_of(p), MediaType::Audio).await;
    let (bytes, content_type) = backend.read_image("full", &image.name).unwrap();
    println!("{} ({content_type}, {} bytes)", image.name, bytes.len());
    assert!(bytes.len() > 100_000);
    backend.shutdown();
}

#[tokio::test]
#[ignore = "downloads about 18 GB and uses the GPU"]
async fn video_installs_and_animates_a_picture() {
    let backend = open();
    install(&backend, PackKind::Video).await;
    // The picture to animate: NOVIRA_LIVE_IMAGE, stored in the gallery first.
    let path = std::env::var("NOVIRA_LIVE_IMAGE").expect("set NOVIRA_LIVE_IMAGE");
    let source = backend
        .upload_image(
            std::fs::read(path).unwrap(),
            ImageOptions {
                board_id: None,
                is_intermediate: None,
                category: Some(ImageCategory::User),
            },
        )
        .await
        .unwrap();
    let mut p = params(
        GenerationMode::Video,
        "a cute puppy wagging its tail and tilting its head, soft light, gentle camera motion",
    );
    p.steps = 20;
    p.cfg_scale = 5.0;
    p.scheduler = "unipc".into();
    p.width = 704;
    p.height = 704;
    p.video_frames = Some(49);
    p.video_fps = Some(24);
    let mut request = enqueue_of(p);
    request.init_image_url = Some(source.url.clone());
    let video = run_one(&backend, request, MediaType::Video).await;
    let (bytes, content_type) = backend.read_image("full", &video.name).unwrap();
    println!("{} ({content_type}, {} bytes)", video.name, bytes.len());
    assert_eq!(content_type, "video/mp4");
    assert!(bytes.len() > 50_000);
    backend.shutdown();
}
