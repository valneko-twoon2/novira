//! Makes one picture or clip with an installed model on the real engine, without a window: the backend opens the data
//! folder, the worker runs the job through the queue and the real ComfyUI, and the result is read back. This is the
//! engine half of what `docs/verification.md` calls "real app, isolated" (no WebView, no Playwright, no second build).
//! It does not see the screens or the IPC layer.
//!
//! Run on purpose while the GPU is free (set `NOVIRA_GPU_LOCK`; the worker takes the lock itself):
//! `NOVIRA_LIVE_DATA=<data folder> NOVIRA_LIVE_MODEL=<part of the model name> cargo test -p novira-core --test models_live -- --ignored --nocapture`
//! The data folder's `settings.json` says where ComfyUI is (a copy, see the guide), and its `models/` holds the model
//! and the files it needs (encoders, VAE). Optional: `NOVIRA_LIVE_IMAGE` (a picture: image to image, or the start of a
//! clip), `NOVIRA_LIVE_PROMPT`, `NOVIRA_LIVE_NEGATIVE`, `NOVIRA_LIVE_STEPS`, `NOVIRA_LIVE_CFG`, `NOVIRA_LIVE_SIZE` (`WxH`), `NOVIRA_LIVE_FRAMES`, `NOVIRA_LIVE_OUT`
//! (a folder that gets the result file), `NOVIRA_LIVE_REGION_MASK` and `NOVIRA_LIVE_REGION_PROMPT` (a regional guidance
//! layer), `NOVIRA_LIVE_SEAMLESS` (`x`, `y` or `xy`, seamless tiling), `NOVIRA_LIVE_DRAFT` (a draft position, 0 to 1),
//! `NOVIRA_LIVE_UPSCALE` (a scale: upscale `NOVIRA_LIVE_IMAGE` with the first upscale model installed).
use novira_core::types::*;
use novira_core::{Backend, BackendConfig, Settings};
use std::path::PathBuf;
use std::time::{Duration, Instant};

fn env(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|v| !v.is_empty())
}

fn open() -> Backend {
    let data_dir = PathBuf::from(env("NOVIRA_LIVE_DATA").expect("set NOVIRA_LIVE_DATA"));
    let settings = Settings::load(&data_dir).unwrap();
    Backend::open(BackendConfig {
        data_dir,
        image_url_base: "http://novira-image.localhost".into(),
        settings,
    })
    .unwrap()
}

/// The steps, CFG and size a family draws well with (the same numbers as the Video screen presets and the guide).
struct Preset {
    steps: u32,
    cfg: f64,
    size: (u32, u32),
    frames: u32,
    fps: u32,
}

fn preset(base: BaseModel) -> Preset {
    let (steps, cfg, size, frames, fps) = match base {
        BaseModel::Wan => (20, 6.0, (832, 480), 29, 16),
        BaseModel::HunyuanVideo => (20, 6.0, (848, 480), 21, 24),
        BaseModel::LtxVideo => (30, 3.0, (768, 512), 49, 25),
        BaseModel::HunyuanVideo15 => (20, 1.0, (848, 480), 33, 24),
        BaseModel::HunyuanImage => (8, 3.5, (1024, 1024), 0, 0),
        BaseModel::Ltx2 => (20, 4.0, (960, 544), 49, 24),
        BaseModel::Flux2 => (20, 4.0, (1024, 1024), 0, 0),
        BaseModel::QwenImage => (20, 4.0, (1024, 1024), 0, 0),
        BaseModel::ZImage => (8, 1.0, (1024, 1024), 0, 0),
        BaseModel::Flux | BaseModel::Chroma => (20, 3.5, (1024, 1024), 0, 0),
        BaseModel::Sdxl => (25, 6.0, (1024, 1024), 0, 0),
        _ => (30, 4.5, (1024, 1024), 0, 0),
    };
    Preset {
        steps,
        cfg,
        size,
        frames,
        fps,
    }
}

fn is_video(base: BaseModel) -> bool {
    matches!(
        base,
        BaseModel::Wan
            | BaseModel::HunyuanVideo
            | BaseModel::HunyuanVideo15
            | BaseModel::LtxVideo
            | BaseModel::Ltx2
    )
}

#[tokio::test]
#[ignore = "uses the GPU and a model you name"]
async fn a_model_makes_a_picture_or_a_clip() {
    let wanted = env("NOVIRA_LIVE_MODEL").expect("set NOVIRA_LIVE_MODEL");
    let backend = open();
    let models = backend.bootstrap().models;
    let model = models
        .iter()
        .find(|m| {
            m.name.to_lowercase().contains(&wanted.to_lowercase())
                && matches!(m.kind, ModelType::Main | ModelType::DiffusionModel)
        })
        .unwrap_or_else(|| {
            let names: Vec<_> = models.iter().map(|m| m.name.as_str()).collect();
            panic!("no model like {wanted:?} among {names:?}")
        });
    let video = is_video(model.base);
    println!("{} ({:?}, {:?})", model.name, model.base, model.kind);
    let p = preset(model.base);
    let (w, h) = env("NOVIRA_LIVE_SIZE")
        .and_then(|s| {
            let (w, h) = s.split_once('x')?;
            Some((w.parse().ok()?, h.parse().ok()?))
        })
        .unwrap_or(p.size);
    let mut params: GenerationMetadata = serde_json::from_value(serde_json::json!({
        "generationMode": if video { GenerationMode::Video } else { GenerationMode::Txt2img },
        "positivePrompt": env("NOVIRA_LIVE_PROMPT").unwrap_or_else(|| "a cute girl with long hair smiling in a flower field, soft light, detailed".into()),
        "negativePrompt": env("NOVIRA_LIVE_NEGATIVE").unwrap_or_default(), "modelKey": model.key, "modelName": model.name, "vaeKey": null,
        "seed": 42,
        "steps": env("NOVIRA_LIVE_STEPS").and_then(|v| v.parse().ok()).unwrap_or(p.steps),
        "cfgScale": env("NOVIRA_LIVE_CFG").and_then(|v| v.parse().ok()).unwrap_or(p.cfg),
        "cfgRescale": 0.0, "scheduler": "euler", "width": w, "height": h, "clipSkip": 0,
        "seamlessX": env("NOVIRA_LIVE_SEAMLESS").is_some_and(|v| v.contains('x')),
        "seamlessY": env("NOVIRA_LIVE_SEAMLESS").is_some_and(|v| v.contains('y')),
        "loras": []
    }))
    .unwrap();
    if video {
        params.video_frames = Some(
            env("NOVIRA_LIVE_FRAMES")
                .and_then(|v| v.parse().ok())
                .unwrap_or(p.frames),
        );
        params.video_fps = Some(p.fps);
    }
    let mut request: EnqueueRequest = serde_json::from_value(serde_json::json!({
        "origin": "generate", "destination": "gallery", "iterations": 1, "randomizeSeed": false,
        "prepend": false, "boardId": null, "params": params
    }))
    .unwrap();
    if let Some(path) = env("NOVIRA_LIVE_IMAGE") {
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
        request.init_image_url = Some(source.url);
        if let Some(scale) = env("NOVIRA_LIVE_UPSCALE").and_then(|v| v.parse().ok()) {
            let up = models
                .iter()
                .find(|m| m.kind == ModelType::SpandrelImageToImage)
                .expect("an upscale model");
            println!(
                "upscale x{scale} of {}x{} with {}",
                source.width, source.height, up.name
            );
            request.params.generation_mode = GenerationMode::Upscale;
            request.params.upscale_scale = Some(scale);
            request.params.upscale_model_key = Some(up.key.clone());
            request.params.width = source.width;
            request.params.height = source.height;
        } else if !video {
            request.params.generation_mode = GenerationMode::Img2img;
            request.params.strength = Some(0.6);
        }
    }
    request.params.draft_at = env("NOVIRA_LIVE_DRAFT").and_then(|v| v.parse().ok());

    // A regional guidance layer: NOVIRA_LIVE_REGION_MASK (white inside) with NOVIRA_LIVE_REGION_PROMPT.
    if let (Some(path), Some(prompt)) = (
        env("NOVIRA_LIVE_REGION_MASK"),
        env("NOVIRA_LIVE_REGION_PROMPT"),
    ) {
        let mask = backend
            .upload_image(
                std::fs::read(path).unwrap(),
                ImageOptions {
                    board_id: None,
                    is_intermediate: None,
                    category: Some(ImageCategory::Mask),
                },
            )
            .await
            .unwrap();
        request.params.regional_guidance_count = Some(1);
        request.guidance.regional_layers = vec![RegionalLayerInput {
            image_url: mask.url,
            positive_prompt: Some(prompt),
            negative_prompt: None,
            auto_negative: true,
        }];
    }

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
            started.elapsed() < Duration::from_secs(3600),
            "took too long"
        );
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    println!("generated in {}s", started.elapsed().as_secs());
    let wanted_type = if video {
        MediaType::Video
    } else {
        MediaType::Image
    };
    let result = backend
        .bootstrap()
        .images
        .into_iter()
        .find(|i| i.media_type == wanted_type && i.category == ImageCategory::General)
        .expect("the generated file");
    let (bytes, content_type) = backend.read_image("full", &result.name).unwrap();
    println!(
        "{} ({content_type}, {} bytes, {}x{})",
        result.name,
        bytes.len(),
        result.width,
        result.height
    );
    if let Some(dir) = env("NOVIRA_LIVE_OUT") {
        let ext = if video { "mp4" } else { "png" };
        let file =
            PathBuf::from(dir).join(format!("{}.{ext}", model.name.replace(['/', '\\'], "_")));
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(&file, &bytes).unwrap();
        println!("saved {}", file.display());
    }
    assert!(bytes.len() > 20_000);
    backend.shutdown();
}
