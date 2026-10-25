//! The boundary between the queue and an image engine. ComfyUI implements it; tests use fakes.
use crate::types::{ComfyRef, ControlMode, GenerationMetadata, RefImageMethod};
use serde::Serialize;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;

/// What the engine is doing before it can take jobs (shown while ComfyUI is installed or started).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(
    tag = "state",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum EngineStatus {
    /// Nothing has been tried yet.
    Idle,
    Downloading {
        bytes: u64,
        total_bytes: u64,
    },
    Extracting,
    Starting,
    Ready,
    Error {
        message: String,
    },
}

pub type StatusSink = Arc<dyn Fn(EngineStatus) + Send + Sync>;

/// One generation with every model already resolved to a ComfyUI address.
#[derive(Debug, Clone, PartialEq)]
pub struct EngineJob {
    pub params: GenerationMetadata,
    pub checkpoint: ComfyRef,
    pub vae: Option<ComfyRef>,
    pub loras: Vec<(ComfyRef, f64)>,
    pub upscale_model: Option<ComfyRef>,
    /// Upscaling: the tile ControlNet that guides the redraw of the enlarged picture (`None` without one).
    pub tile_controlnet: Option<ComfyRef>,
    /// Upscaling: the model that finishes the drawn picture (`None` without one).
    pub post_processing_model: Option<ComfyRef>,
    /// Video: the text encoder that goes with the video model (the model itself is `checkpoint`).
    pub text_encoder: Option<ComfyRef>,
    /// A model loaded in parts (Anima, Flux...): its family and text encoders (the model itself is `checkpoint`).
    pub split: Option<crate::comfy::split::SplitJob>,
    /// PNG bytes of the source image for image-to-image modes.
    pub init_image: Option<Vec<u8>>,
    /// A `graph` job: the prompt to run instead of one built from `params` (the model fields above are unused).
    pub graph: Option<GraphJob>,
    /// Inpaint mask, control layers and reference images, resolved and read.
    pub guidance: JobGuidance,
}

/// The guidance pictures of a job with their models resolved to ComfyUI addresses and their bytes read.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct JobGuidance {
    /// PNG of the inpaint / outpaint mask (white = redraw).
    pub mask: Option<Vec<u8>>,
    pub controls: Vec<ControlJob>,
    pub regions: Vec<RegionJob>,
    pub refs: Vec<RefJob>,
    /// The pictures the main model takes in itself as references (FLUX.2), as stored in the gallery, in order.
    pub references: Vec<Vec<u8>>,
}

impl JobGuidance {
    /// Every model the guidance loads, for the visibility check.
    pub fn models(&self) -> Vec<&ComfyRef> {
        let mut out: Vec<&ComfyRef> = self.controls.iter().map(|c| &c.model).collect();
        for r in &self.refs {
            out.push(&r.model);
            out.push(&r.clip_vision);
        }
        out
    }
}

/// A control layer (ControlNet).
#[derive(Debug, Clone, PartialEq)]
pub struct ControlJob {
    pub model: ComfyRef,
    /// PNG of the control picture.
    pub image: Vec<u8>,
    pub weight: f64,
    pub begin_end: [f64; 2],
    pub mode: ControlMode,
    /// The kind a union ControlNet is told the picture is, in ComfyUI's words (`SetUnionControlNetType`); None for
    /// another model or an unknown picture.
    pub union_type: Option<&'static str>,
}

/// A regional guidance layer: prompts that apply inside a region.
#[derive(Debug, Clone, PartialEq)]
pub struct RegionJob {
    /// PNG of the region (white inside).
    pub mask: Vec<u8>,
    pub positive: Option<String>,
    pub negative: Option<String>,
    /// Also keep the positive prompt out of the rest of the picture.
    pub auto_negative: bool,
}

/// A reference image (IP-Adapter) with the image encoder its model needs.
#[derive(Debug, Clone, PartialEq)]
pub struct RefJob {
    pub model: ComfyRef,
    pub clip_vision: ComfyRef,
    /// The picture's bytes as stored in the gallery.
    pub image: Vec<u8>,
    pub weight: f64,
    pub begin_end: [f64; 2],
    pub method: RefImageMethod,
    /// Where it applies (white inside), read from the gallery; None for the whole picture.
    pub region: Option<Vec<u8>>,
}

/// A prompt the workflow editor built, with its models resolved and its pictures read from the gallery.
#[derive(Debug, Clone, PartialEq)]
pub struct GraphJob {
    /// Every placeholder but `{"$image": name}` is filled.
    pub prompt: serde_json::Value,
    /// Nodes whose results to keep, most wanted first.
    pub outputs: Vec<String>,
    pub models: Vec<ComfyRef>,
    /// Gallery name and bytes of each picture, video or sound to upload.
    pub images: Vec<(String, Vec<u8>)>,
    /// A node whose picture is the first frame, when the job makes a video.
    pub thumbnail: Option<String>,
    /// The output node writes its file into ComfyUI's own folder and reports nothing to fetch: the job only has to
    /// finish without an error. The engine returns the picture the first of `outputs` showed when there is one,
    /// `EngineOutput::Nothing` otherwise.
    pub no_result: bool,
}

/// What a finished job produced.
#[derive(Debug, Clone, PartialEq)]
pub enum EngineOutput {
    /// PNG bytes.
    Image(Vec<u8>),
    /// MP4 bytes with a PNG of the first frame.
    Video { mp4: Vec<u8>, frame_png: Vec<u8> },
    /// Music, speech or a sound a workflow made, with the file extension of its format (`mp3`, `wav`, `flac`).
    Audio { bytes: Vec<u8>, ext: &'static str },
    /// Text an output node showed (ComfyUI's `PreviewAny`, "Preview as Text"), e.g. a picture described as a prompt.
    Text(String),
    /// The job finished and left its result in ComfyUI's folder (`GraphJob::no_result`).
    Nothing,
}

#[derive(Debug, Clone, PartialEq)]
pub struct EngineProgress {
    pub step: u32,
    pub total_steps: u32,
    /// `data:` URL of a low-resolution preview, when the engine sends one.
    pub preview: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum EngineError {
    #[error("cancelled")]
    Cancelled,
    #[error("{0}")]
    Failed(String),
}

pub type ProgressFn<'a> = &'a (dyn Fn(EngineProgress) + Send + Sync);

/// Whether an engine's error text says the device ran out of memory. The phrases are the ones PyTorch and ComfyUI
/// write: CUDA, ROCm (HIP) and MPS say "... out of memory", PyTorch with the asynchronous allocator says
/// "Allocation on device 0 would exceed allowed memory. (out of memory)", the exception class is
/// `torch.OutOfMemoryError`, ComfyUI adds "This error means you ran out of memory on your GPU" to every OOM it
/// recognises, DirectML says "not enough GPU video memory", PyTorch's CPU allocator says "not enough memory", and
/// nodes shorten it to "OOM".
pub fn is_out_of_memory(message: &str) -> bool {
    const PHRASES: &[&str] = &[
        "out of memory",
        "outofmemoryerror",
        "allocation on device",
        "not enough gpu video memory",
        "not enough memory",
    ];
    let lower = message.to_lowercase();
    PHRASES.iter().any(|p| lower.contains(p))
        || message
            .split(|c: char| !c.is_ascii_alphanumeric())
            .any(|word| word == "OOM")
}

#[async_trait::async_trait]
pub trait Engine: Send + Sync {
    /// Checks the job can run (models present, sampler known) before any GPU work. Default: accept.
    async fn validate(&self, _job: &EngineJob) -> Result<(), EngineError> {
        Ok(())
    }

    /// Runs one job and returns what it produced.
    async fn generate(
        &self,
        job: &EngineJob,
        progress: ProgressFn<'_>,
        cancel: &CancellationToken,
    ) -> Result<EngineOutput, EngineError>;

    /// Definitions of every node the engine can run (ComfyUI's `object_info`), keyed by node class.
    /// Default: none, for engines that do not run node graphs.
    async fn node_defs(
        &self,
        _cancel: &CancellationToken,
    ) -> Result<serde_json::Value, EngineError> {
        Ok(serde_json::Value::Object(Default::default()))
    }

    /// The words the engine's own screens show in a language (ComfyUI's names of categories, nodes and inputs), or
    /// None when it has none for that language. Default: none.
    async fn ui_locale(
        &self,
        _cancel: &CancellationToken,
        _locale: &str,
    ) -> Result<Option<crate::comfy::ui_locale::ComfyUiLocale>, EngineError> {
        Ok(None)
    }

    /// Calls a route a custom node pack added to the engine's server: `POST` with a JSON body, or `GET` without one.
    /// Default: not supported.
    async fn pack_request(
        &self,
        _cancel: &CancellationToken,
        _route: &str,
        _body: Option<serde_json::Value>,
    ) -> Result<serde_json::Value, EngineError> {
        Err(EngineError::Failed(
            "This engine has no custom node packs".into(),
        ))
    }

    /// Replaces the ComfyUI novira installed by the release `tag`: stops it, installs that release, moves the pack
    /// folders over and installs each pack again (their Python libraries lived in the old package), starts it and goes
    /// back to the old one when the new one does not start. `on_pack` hears of each pack's progress by its address.
    /// Returns the folders of the packs that could not be installed again. Default: not supported.
    async fn switch_version(
        &self,
        _tag: &str,
        _data_dir: &std::path::Path,
        _cancel: &CancellationToken,
        _on_pack: &(dyn Fn(String, crate::packs::PackStatus) + Send + Sync),
    ) -> Result<Vec<String>, EngineError> {
        Err(EngineError::Failed(
            "This ComfyUI was not installed by novira, so its version cannot be changed here"
                .into(),
        ))
    }

    /// Stops and starts the engine again (after custom node packs changed). Default: nothing to restart.
    async fn restart(&self, _cancel: &CancellationToken) -> Result<(), EngineError> {
        Ok(())
    }

    /// Installs (if needed) and starts the engine so the first job does not have to wait. Default: nothing to do.
    async fn prepare(&self, _cancel: &CancellationToken) -> Result<(), EngineError> {
        Ok(())
    }

    /// Starts the engine with its low-memory option from its next start on. Returns false when the engine cannot
    /// (it did not start its server itself). Default: not supported.
    fn set_low_memory(&self, _on: bool) -> bool {
        false
    }

    /// The running engine was started with the other low-memory value, so it applies only after a restart.
    /// Default: never.
    fn low_memory_pending(&self) -> bool {
        false
    }

    fn status(&self) -> EngineStatus {
        EngineStatus::Ready
    }

    /// Receives every status change.
    fn set_status_sink(&self, _sink: StatusSink) {}

    /// Stops anything the engine owns (e.g. a ComfyUI process it started).
    fn shutdown(&self) {}
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    struct Minimal;

    #[async_trait::async_trait]
    impl Engine for Minimal {
        async fn generate(
            &self,
            _job: &EngineJob,
            _progress: ProgressFn<'_>,
            _cancel: &CancellationToken,
        ) -> Result<EngineOutput, EngineError> {
            Err(EngineError::Cancelled)
        }
    }

    #[test]
    fn status_is_tagged_by_state_with_camel_case_fields() {
        assert_eq!(
            serde_json::to_value(EngineStatus::Downloading {
                bytes: 1,
                total_bytes: 2
            })
            .unwrap(),
            json!({"state": "downloading", "bytes": 1, "totalBytes": 2})
        );
        assert_eq!(
            serde_json::to_value(EngineStatus::Error {
                message: "x".into()
            })
            .unwrap(),
            json!({"state": "error", "message": "x"})
        );
        for (status, state) in [
            (EngineStatus::Idle, "idle"),
            (EngineStatus::Extracting, "extracting"),
            (EngineStatus::Starting, "starting"),
            (EngineStatus::Ready, "ready"),
        ] {
            assert_eq!(
                serde_json::to_value(status).unwrap(),
                json!({ "state": state })
            );
        }
    }

    #[tokio::test]
    async fn default_methods_accept_jobs_and_refuse_pack_routes() {
        let engine = Minimal;
        let cancel = CancellationToken::new();
        assert_eq!(engine.status(), EngineStatus::Ready);
        assert_eq!(engine.node_defs(&cancel).await.unwrap(), json!({}));
        assert_eq!(engine.ui_locale(&cancel, "ja").await.unwrap(), None);
        assert!(matches!(
            engine
                .pack_request(&cancel, "nkd/facerig/library", None)
                .await,
            Err(EngineError::Failed(_))
        ));
        assert!(engine.restart(&cancel).await.is_ok());
        assert!(engine.prepare(&cancel).await.is_ok());
        assert!(!engine.set_low_memory(true));
        assert!(!engine.low_memory_pending());
    }

    #[test]
    fn out_of_memory_texts_are_recognised() {
        for text in [
            "ComfyUI KSampler: OOM",
            "ComfyUI KSampler: CUDA out of memory. Tried to allocate 2.00 GiB (GPU 0; 8.00 GiB total capacity)",
            "ComfyUI KSampler: Allocation on device 0 would exceed allowed memory. (out of memory)\nCurrently allocated     : 7.10 GiB\n\nThis error means you ran out of memory on your GPU.",
            "ComfyUI VAEDecode: HIP out of memory. Tried to allocate 1.50 GiB",
            "ComfyUI KSampler: MPS backend out of memory (MPS allocated: 9.00 GB)",
            "torch.OutOfMemoryError: CUDA error",
            "ComfyUI KSampler: Could not allocate tensor with 471859200 bytes. There is not enough GPU video memory available!",
            "ComfyUI VAEDecode: [enforce fail at alloc_cpu.cpp:114] data. DefaultCPUAllocator: not enough memory: you tried to allocate 3221225472 bytes.",
        ] {
            assert!(is_out_of_memory(text), "{text}");
        }
        for text in [
            "ComfyUI KSampler: mat1 and mat2 shapes cannot be multiplied (77x2048 and 768x320)",
            "ComfyUI does not see a.safetensors in checkpoints",
            "A room with a view",
            "ComfyUI LoadImage: Zoom level not supported",
            "",
        ] {
            assert!(!is_out_of_memory(text), "{text}");
        }
    }
}
