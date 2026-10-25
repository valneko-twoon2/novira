//! Shared fixtures: a fake engine, backend setup, requests and waiting helpers.
use novira_core::engine::{
    Engine, EngineError, EngineJob, EngineOutput, EngineProgress, ProgressFn,
};
use novira_core::types::*;
use novira_core::{Backend, BackendConfig, Settings};
use serde_json::json;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio_util::sync::CancellationToken;

pub(crate) const BASE: &str = "http://novira-image.localhost";

#[derive(Default)]
pub(crate) struct FakeEngine {
    pub(crate) jobs: Mutex<Vec<EngineJob>>,
    /// When set, `generate` waits for cancellation instead of finishing.
    pub(crate) block: bool,
    /// When set, `validate` refuses every job.
    pub(crate) reject: bool,
    /// Pack routes called, with their bodies.
    pub(crate) pack_calls: Mutex<Vec<(String, Option<serde_json::Value>)>>,
    pub(crate) restarts: Mutex<u32>,
    /// The server is not the engine's own (a ComfyUI at `comfyuiUrl`): low-memory mode cannot be applied.
    pub(crate) external: bool,
    /// Low-memory mode for the next start, and what the running server was started with (`None`: not running).
    pub(crate) low_memory: Mutex<bool>,
    pub(crate) running_low_memory: Mutex<Option<bool>>,
}

pub(crate) fn png(w: u32, h: u32) -> Vec<u8> {
    let img = image::RgbImage::from_pixel(w, h, image::Rgb([200, 100, 50]));
    let mut out = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(img)
        .write_to(&mut out, image::ImageFormat::Png)
        .unwrap();
    out.into_inner()
}

#[async_trait::async_trait]
impl Engine for FakeEngine {
    async fn validate(&self, _job: &EngineJob) -> Result<(), EngineError> {
        if self.reject {
            return Err(EngineError::Failed("unknown sampler".into()));
        }
        Ok(())
    }

    async fn pack_request(
        &self,
        _cancel: &CancellationToken,
        route: &str,
        body: Option<serde_json::Value>,
    ) -> Result<serde_json::Value, EngineError> {
        self.pack_calls
            .lock()
            .unwrap()
            .push((route.to_string(), body));
        Ok(json!({ "ok": true }))
    }

    async fn restart(&self, _cancel: &CancellationToken) -> Result<(), EngineError> {
        *self.restarts.lock().unwrap() += 1;
        *self.running_low_memory.lock().unwrap() = Some(*self.low_memory.lock().unwrap());
        Ok(())
    }

    fn set_low_memory(&self, on: bool) -> bool {
        *self.low_memory.lock().unwrap() = on;
        !self.external
    }

    fn low_memory_pending(&self) -> bool {
        let wanted = *self.low_memory.lock().unwrap();
        self.running_low_memory
            .lock()
            .unwrap()
            .is_some_and(|running| running != wanted)
    }

    async fn generate(
        &self,
        job: &EngineJob,
        progress: ProgressFn<'_>,
        cancel: &CancellationToken,
    ) -> Result<EngineOutput, EngineError> {
        self.jobs.lock().unwrap().push(job.clone());
        if job.params.positive_prompt.contains("[fail]") {
            return Err(EngineError::Failed("engine failed".into()));
        }
        if job.params.positive_prompt.contains("[oom]") {
            return Err(EngineError::Failed(
                "ComfyUI KSampler: CUDA out of memory. Tried to allocate 2.00 GiB".into(),
            ));
        }
        for step in 1..=job.params.steps {
            progress(EngineProgress {
                step,
                total_steps: job.params.steps,
                preview: None,
                message: "denoise".into(),
            });
        }
        if self.block {
            cancel.cancelled().await;
            return Err(EngineError::Cancelled);
        }
        if let Some(g) = &job.graph {
            let nodes = g.prompt.as_object().unwrap();
            if nodes.values().any(|n| n["class_type"] == "PreviewAny") {
                return Ok(EngineOutput::Text("1girl, solo, smile".into()));
            }
            if nodes
                .values()
                .any(|n| n["class_type"] == "SaveAudioAdvanced")
            {
                return Ok(EngineOutput::Audio {
                    bytes: b"fLaC a pretend flac file".to_vec(),
                    ext: "flac",
                });
            }
            if nodes.values().any(|n| n["class_type"] == "SaveVideo") {
                let mut mp4 = vec![0, 0, 0, 24];
                mp4.extend_from_slice(b"ftypmp42");
                mp4.extend_from_slice(&[0; 16]);
                return Ok(EngineOutput::Video {
                    mp4,
                    frame_png: png(48, 32),
                });
            }
        }
        if job.params.generation_mode == GenerationMode::Music {
            return Ok(EngineOutput::Audio {
                bytes: b"ID3\x04\0\0\0\0\0\0a pretend mp3 file".to_vec(),
                ext: "mp3",
            });
        }
        // An eighth of the size asked for (a high-resolution fix enlarges it by its scale).
        let scale = job.params.hires_fix.as_ref().map_or(1.0, |h| h.scale);
        let side = |v: u32| (v as f64 * scale / 8.0).round() as u32;
        let frame = png(side(job.params.width), side(job.params.height));
        if job.params.generation_mode == GenerationMode::Video {
            let mut mp4 = vec![0, 0, 0, 24];
            mp4.extend_from_slice(b"ftypmp42");
            mp4.extend_from_slice(&[0; 16]);
            return Ok(EngineOutput::Video {
                mp4,
                frame_png: frame,
            });
        }
        Ok(EngineOutput::Image(frame))
    }
}

pub(crate) fn settings() -> Settings {
    Settings {
        gpu_lock: String::new(),
        ..Settings::default()
    }
}

pub(crate) fn write_lora_and_checkpoint(models: &Path) {
    for (dir, file) in [
        ("checkpoints", "sdxl_base.safetensors"),
        ("loras", "detail-xl.safetensors"),
    ] {
        std::fs::create_dir_all(models.join(dir)).unwrap();
        std::fs::write(models.join(dir).join(file), b"x").unwrap();
    }
}

pub(crate) fn open(
    dir: &Path,
    engine: Arc<FakeEngine>,
) -> (Backend, Arc<Mutex<Vec<BackendEvent>>>) {
    let backend = Backend::open_with_engine(
        BackendConfig {
            data_dir: dir.to_path_buf(),
            image_url_base: BASE.into(),
            settings: settings(),
        },
        engine,
    )
    .unwrap();
    let events = Arc::new(Mutex::new(Vec::new()));
    let sink = events.clone();
    backend.set_event_sink(Arc::new(move |e| sink.lock().unwrap().push(e)));
    (backend, events)
}

pub(crate) fn request(model_key: &str, prompt: &str, iterations: u32) -> EnqueueRequest {
    serde_json::from_value(json!({
        "origin": "generate", "destination": "gallery", "iterations": iterations, "randomizeSeed": false,
        "prepend": false, "boardId": null,
        "params": {
            "generationMode": "txt2img", "positivePrompt": prompt, "negativePrompt": "", "modelKey": model_key,
            "modelName": "Base", "vaeKey": null, "seed": 10, "steps": 3, "cfgScale": 7, "cfgRescale": 0,
            "scheduler": "euler", "width": 512, "height": 512, "clipSkip": 0, "seamlessX": false,
            "seamlessY": false, "loras": []
        }
    }))
    .unwrap()
}

pub(crate) async fn wait_until(mut f: impl FnMut() -> bool) {
    for _ in 0..200 {
        if f() {
            return;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    panic!("condition not reached");
}

pub(crate) fn statuses(b: &Backend) -> Vec<QueueItemStatus> {
    b.queue_snapshot().items.iter().map(|q| q.status).collect()
}

pub(crate) fn main_key(b: &Backend) -> String {
    b.bootstrap()
        .models
        .into_iter()
        .find(|m| m.kind == ModelType::Main)
        .unwrap()
        .key
}
