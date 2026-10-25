//! Wire types shared with the frontend. They mirror `frontend/src/backend/types.ts` (the source of truth for the shape).
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum BaseModel {
    #[serde(rename = "sd-1")]
    Sd1,
    #[serde(rename = "sd-2")]
    Sd2,
    #[serde(rename = "sdxl")]
    Sdxl,
    #[serde(rename = "sd-3")]
    Sd3,
    #[serde(rename = "flux")]
    Flux,
    /// FLUX.2 (dev and klein): Mistral or Qwen3 as the text encoder, its own latent and scheduler.
    #[serde(rename = "flux2")]
    Flux2,
    /// Anima (Cosmos-Predict2 with a Qwen3 text encoder).
    #[serde(rename = "anima")]
    Anima,
    #[serde(rename = "chroma")]
    Chroma,
    #[serde(rename = "qwen-image")]
    QwenImage,
    /// Z-Image and other Lumina 2 models.
    #[serde(rename = "z-image")]
    ZImage,
    #[serde(rename = "hidream")]
    Hidream,
    #[serde(rename = "auraflow")]
    Auraflow,
    /// HunyuanImage 2.1: Qwen2.5-VL and ByT5 as text encoders, its own 32x-compressed latent.
    #[serde(rename = "hunyuan-image")]
    HunyuanImage,
    /// Hunyuan-DiT: a checkpoint with its two text encoders and VAE inside, drawn through the SD picture graph.
    #[serde(rename = "hunyuan-dit")]
    HunyuanDit,
    #[serde(rename = "wan")]
    Wan,
    #[serde(rename = "hunyuan-video")]
    HunyuanVideo,
    #[serde(rename = "hunyuan-video-15")]
    HunyuanVideo15,
    #[serde(rename = "ltx-video")]
    LtxVideo,
    /// LTX-2: video with sound, in two stages.
    #[serde(rename = "ltx2")]
    Ltx2,
    #[serde(rename = "any")]
    Any,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelType {
    Main,
    Vae,
    Lora,
    Controlnet,
    T2iAdapter,
    IpAdapter,
    ClipVision,
    SpandrelImageToImage,
    T5Encoder,
    ClipEmbed,
    /// A diffusion model on its own (Wan and other video models, GGUF files): ComfyUI's `diffusion_models` folder.
    DiffusionModel,
    /// A text encoder on its own (T5, Qwen, CLIP): ComfyUI's `text_encoders` folder.
    TextEncoder,
    /// A model patch (Anima LLLite, the Qwen-Image and Z-Image Fun ControlNets): ComfyUI's `model_patches` folder.
    ModelPatch,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelFormat {
    Checkpoint,
    Diffusers,
    Lycoris,
    Invokeai,
    Gguf,
    BnbQuantized,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelDefaultSettings {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vae: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vae_precision: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub steps: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cfg_scale: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scheduler: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub height: Option<u32>,
}

/// Where ComfyUI finds a model: its folder category (`checkpoints`, `loras`, ...) and the name relative to that folder.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComfyRef {
    pub folder: String,
    pub name: String,
}

/// One use a model's license allows (`Some(true)`), forbids (`Some(false)`) or does not state (`None`).
/// Keys: `sellImages`, `generationServices`, `sellModel`, `shareMerges`, `differentLicense`, `noCredit`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Permission {
    pub key: String,
    pub allowed: Option<bool>,
}

/// The license of an owned model: where it was read from, the license name (Hugging Face), the commercial-use summary
/// (`allowed` / `limited` / `denied`) and the item-by-item permissions.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelLicense {
    /// `civitai` or `huggingface`.
    pub site: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub commercial: String,
    pub permissions: Vec<Permission>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfig {
    pub key: String,
    pub name: String,
    pub base: BaseModel,
    #[serde(rename = "type")]
    pub kind: ModelType,
    pub format: ModelFormat,
    pub description: String,
    pub path: String,
    pub size: u64,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_settings: Option<ModelDefaultSettings>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trigger_phrases: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cover_image_url: Option<String>,
    /// The cover is a mature picture (every picture the site has for the model is). The UI marks it but does not blur it yet.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cover_mature: Option<bool>,
    /// What the model's license allows, as the site it came from states it (looked up by source or file hash).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub license: Option<ModelLicense>,
    /// Backend-only addressing for ComfyUI; the frontend ignores it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub comfy: Option<ComfyRef>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StarterModel {
    pub id: String,
    pub name: String,
    pub base: BaseModel,
    #[serde(rename = "type")]
    pub kind: ModelType,
    pub description: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dependencies: Option<Vec<String>>,
    /// About how many bytes the download is. Known for the files other models load as their parts (encoders, VAEs).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<u64>,
}

/// The starter files an installed model needs but the library does not hold yet (see `models::parts`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelPartsReport {
    pub model_key: String,
    pub model_name: String,
    /// The starter entries that install what is missing, in the order the model loads them. Empty when nothing is missing.
    pub missing: Vec<StarterModel>,
    /// What is missing but has no starter entry to install it from, as the engine words it ("the SD3 VAE (...)").
    pub unavailable: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelInstallStatus {
    Waiting,
    Downloading,
    Running,
    Completed,
    Error,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInstallJob {
    pub id: String,
    pub source: String,
    pub name: String,
    pub status: ModelInstallStatus,
    pub bytes: u64,
    pub total_bytes: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoraParam {
    pub key: String,
    pub weight: f64,
    pub is_enabled: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GenerationMode {
    Txt2img,
    Img2img,
    Inpaint,
    Outpaint,
    Upscale,
    Workflow,
    /// A workflow run as the ComfyUI prompt the editor built (it uses nodes of custom node packs).
    Graph,
    /// A video from text, or from a source image when one is given.
    Video,
    /// A song from tags and lyrics.
    Music,
    /// Speech read out from text.
    Voice,
    /// A logo drawn by the logo pack's model (Z-Image-Turbo) from a prompt that names the text to show.
    Logo,
}

/// Parameters recorded in image metadata. Unknown fields are kept so newer frontends round-trip.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationMetadata {
    pub generation_mode: GenerationMode,
    pub positive_prompt: String,
    pub negative_prompt: String,
    pub model_key: String,
    pub model_name: String,
    pub vae_key: Option<String>,
    pub seed: u64,
    pub steps: u32,
    pub cfg_scale: f64,
    pub cfg_rescale: f64,
    pub scheduler: String,
    pub width: u32,
    pub height: u32,
    pub clip_skip: u32,
    pub seamless_x: bool,
    pub seamless_y: bool,
    pub loras: Vec<LoraParam>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub strength: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub upscale_scale: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub upscale_model_key: Option<String>,
    /// Upscaling: the tile ControlNet that keeps the picture's structure while it is redrawn.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tile_controlnet_model_key: Option<String>,
    /// Upscaling: the model that finishes the drawn picture, before it is fitted to the output size.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub post_processing_model_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub creativity: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub structure: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workflow_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ref_image_count: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub control_layer_count: Option<u32>,
    /// The reference images and control layers the picture was made with (set when the job is queued), so that
    /// "derive" and "remix" can use them again. The pictures stay in the gallery; these only name them.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ref_images: Option<Vec<RefImageInput>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub control_layers: Option<Vec<ControlLayerInput>>,
    /// Canvas regional guidance layers that were enabled, and (set when the job is queued) what they said.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub regional_guidance_count: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub regional_layers: Option<Vec<RegionalLayerInput>>,
    /// The pictures the main model took in itself as references (FLUX.2), set when the job is queued, so that
    /// "derive" can give them again.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference_pictures: Option<Vec<String>>,
    /// Inpaint / outpaint: how far (pixels) the redrawn area blends into the kept picture.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mask_blur: Option<u32>,
    /// A draft: draw only up to this fraction of the steps (0..1) and keep the result as an intermediate image.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub draft_at: Option<f64>,
    /// Video: number of frames (4n + 1) and frames per second.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub video_frames: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub video_fps: Option<u32>,
    /// Video, for a small GPU: load the model's weights as fp8 (half the memory, slightly less exact), and decode the
    /// frames in tiles (a lower peak at the end).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub video_fp8: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub video_tiled_decode: Option<bool>,
    /// Music: lyrics, length and the musical settings (the tags are the positive prompt).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub music: Option<MusicParams>,
    /// Voice: what to read, in which language and voice.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub voice: Option<VoiceParams>,
    /// Text to image: a second pass that enlarges the picture and draws it again at the larger size. When it is set,
    /// `width` and `height` stay the size of the first pass (the setting); the stored picture itself is larger.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hires_fix: Option<HiresFix>,
    /// Pictures: finish the drawn picture as a black-and-white manga page (the ComfyUI-MangaScreen pack's `MangaFinish`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manga_screen: Option<MangaScreen>,
    /// The ComfyUI sampler and scheduler that ran, set by the backend when the picture is saved. A model of the newer
    /// families (Anima, Flux...) always runs its family's own (`Family::picture_sampling`), whatever `scheduler` says;
    /// absent when `scheduler` is what ran.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sampling: Option<Sampling>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

/// A ComfyUI sampler and scheduler by their node names (`euler`, `simple`), or the scheduler node a family's graph takes
/// its sigmas from (`Flux2Scheduler`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sampling {
    pub sampler: String,
    pub scheduler: String,
}

/// The manga finish of a picture: lines kept crisp, values pushed into flat tones and printed as a screentone. The fields
/// are the inputs of the pack's `MangaFinish` node; each is held to the node's own range when the graph is built.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MangaScreen {
    /// Rows of dots across the width (40 to 600; 120 coarse, 200 normal, 300 fine).
    pub screen_lines: u32,
    /// Brighter than this becomes paper white (0.3 to 1.0).
    pub white_point: f64,
    /// Darker than this becomes solid black (0.0 to 0.7).
    pub black_point: f64,
    /// Gradation tone where the original fades smoothly (0 to 1; 0 keeps flat areas only).
    pub gradation: f64,
    /// How many lines inside solid black are cut out white (0 to 1; 0 turns it off).
    pub white_lines: f64,
}

/// The second pass of text to image ("high-resolution fix"): the first picture is enlarged and drawn again with the
/// same seed, prompt and guidance at a low denoise, so the larger picture gets new detail instead of blur.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HiresFix {
    /// Enlargement of the first pass (the form offers 1.25 to 2.0).
    pub scale: f64,
    /// Denoise of the second pass (the form offers 0.2 to 0.75).
    pub strength: f64,
    /// An upscale model (ESRGAN type) enlarges the decoded first picture; absent = a plain Lanczos resize.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub upscale_model_key: Option<String>,
    /// Steps of the second pass; absent = as many as the first pass.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub steps: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicParams {
    pub lyrics: String,
    /// Length in seconds.
    pub seconds: u32,
    pub bpm: u32,
    /// For example "E minor".
    pub key: String,
    pub time_signature: u32,
    /// Language of the lyrics as ACE-Step names it (`en`, `ja`, ... or `unknown`).
    pub language: String,
    /// Music without singing: the lyrics are ignored.
    pub instrumental: bool,
}

/// How the voice is chosen.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VoiceMode {
    /// One of the built-in speakers.
    Preset,
    /// A voice described in words.
    Design,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceParams {
    pub text: String,
    /// A language name the voice engine knows (`Japanese`, `English`, ...) or `Auto`.
    pub language: String,
    pub mode: VoiceMode,
    /// The built-in speaker (preset mode).
    pub speaker: String,
    /// Preset mode: how to speak (optional). Design mode: the description of the voice.
    pub instruct: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImageCategory {
    General,
    User,
    Mask,
    Control,
    Other,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageDTO {
    pub name: String,
    /// Still image (PNG) or video (MP4). The thumbnail of a video is its first frame.
    #[serde(default)]
    pub media_type: MediaType,
    pub url: String,
    pub thumbnail_url: String,
    pub width: u32,
    pub height: u32,
    pub created_at: i64,
    pub board_id: Option<String>,
    pub starred: bool,
    pub is_intermediate: bool,
    pub category: ImageCategory,
    pub metadata: Option<GenerationMetadata>,
    pub workflow: Option<Value>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MediaType {
    #[default]
    Image,
    Video,
    /// Music or speech. Its thumbnail is a generated picture of the waveform.
    Audio,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardDTO {
    pub id: String,
    pub name: String,
    pub archived: bool,
    pub created_at: i64,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardPatch {
    pub name: Option<String>,
    pub archived: Option<bool>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QueueItemStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Canceled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QueueOrigin {
    Generate,
    Canvas,
    Upscaling,
    Workflows,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QueueDestination {
    Gallery,
    Canvas,
    /// A helper result (for example a selection mask) the app uses itself: stored hidden, never shown or staged.
    Intermediate,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnqueueRequest {
    pub origin: QueueOrigin,
    pub destination: QueueDestination,
    pub params: GenerationMetadata,
    pub iterations: u32,
    pub randomize_seed: bool,
    pub prepend: bool,
    pub board_id: Option<String>,
    #[serde(default)]
    pub init_image_url: Option<String>,
    #[serde(default)]
    pub workflow: Option<Value>,
    /// The prompt a `graph` job runs.
    #[serde(default)]
    pub comfy_graph: Option<ComfyGraph>,
    #[serde(flatten)]
    pub guidance: Guidance,
}

/// How a control layer weighs against the prompt (InvokeAI's control modes).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ControlMode {
    Balanced,
    MorePrompt,
    MoreControl,
}

/// What a reference image carries over (InvokeAI's IP-Adapter methods).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RefImageMethod {
    Full,
    Style,
    Composition,
    StyleStrong,
    StylePrecise,
}

/// The image encoder an IP-Adapter model was trained with.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ClipVisionModel {
    #[serde(rename = "ViT-H")]
    VitH,
    #[serde(rename = "ViT-G")]
    VitG,
    #[serde(rename = "ViT-L")]
    VitL,
}

/// What a control picture shows, so a ControlNet that reads several kinds (a union model) is told which it gets.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ControlType {
    /// An OpenPose stick figure.
    Openpose,
    Depth,
    /// Hard edges or line art (canny, lineart).
    Lineart,
    /// Soft edges or a scribble (HED).
    Softedge,
    /// A normal map.
    Normal,
}

/// One control layer (ControlNet): its picture inside the generation area, after the layer's filter.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ControlLayerInput {
    /// A stored image (gallery URL).
    pub image_url: String,
    pub model_key: String,
    pub weight: f64,
    /// Start and end of the effect as fractions of the steps.
    pub begin_end: [f64; 2],
    pub control_mode: ControlMode,
    /// What the picture shows, when known; a union ControlNet is told it. None leaves the model to guess.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub control_type: Option<ControlType>,
}

/// One regional guidance layer: prompts that apply inside a region of the picture.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegionalLayerInput {
    /// A stored image (gallery URL): the region, as white on black, the size of the generation area.
    pub image_url: String,
    /// Said inside the region, besides the prompt of the whole picture.
    #[serde(default)]
    pub positive_prompt: Option<String>,
    /// Kept out of the region.
    #[serde(default)]
    pub negative_prompt: Option<String>,
    /// Also keep the region's positive prompt out of the rest of the picture.
    #[serde(default)]
    pub auto_negative: bool,
}

/// One reference image (IP-Adapter).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefImageInput {
    /// A stored image (gallery URL).
    pub image_url: String,
    pub model_key: String,
    pub clip_vision_model: ClipVisionModel,
    pub weight: f64,
    /// Start and end of the effect as fractions of the steps.
    pub begin_end: [f64; 2],
    pub method: RefImageMethod,
    /// Where the reference applies: a stored picture, white inside, the size of the generation area (IP-Adapter
    /// attention mask). None applies it to the whole picture.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub region_image_url: Option<String>,
}

/// Pictures that guide an image generation besides the prompt and the source image. Checked when the job is
/// enqueued (`service::queue`), carried by the queue item and resolved by the worker.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Guidance {
    /// Inpaint / outpaint: where to redraw, a stored picture the size of the source (white = redraw, grey = redraw
    /// less).
    #[serde(default)]
    pub mask_image_url: Option<String>,
    #[serde(default)]
    pub control_layers: Vec<ControlLayerInput>,
    #[serde(default)]
    pub regional_layers: Vec<RegionalLayerInput>,
    #[serde(default)]
    pub ref_images: Vec<RefImageInput>,
    /// Stored pictures the main model takes in itself as references (FLUX.2 `ReferenceLatent`), not through an
    /// adapter, in order.
    #[serde(default)]
    pub reference_pictures: Vec<String>,
}

impl Guidance {
    pub fn is_empty(&self) -> bool {
        self.mask_image_url.is_none()
            && self.control_layers.is_empty()
            && self.regional_layers.is_empty()
            && self.ref_images.is_empty()
            && self.reference_pictures.is_empty()
    }
}

/// One preview of the Face Rig editor: the pose (`rig`, the node's own text) rendered on the portrait.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FaceRigPreview {
    /// Editor session; the pack keeps the prepared face per key.
    pub node_key: String,
    /// Gallery picture to send as the portrait (set on the first request and when the picture changes).
    #[serde(default)]
    pub image: Option<String>,
    pub rig: String,
    /// `drag` while a handle moves (fast), `final` when it is released.
    pub quality: String,
    #[serde(default = "default_crop_factor")]
    pub crop_factor: f64,
    #[serde(default = "default_src_ratio")]
    pub src_ratio: f64,
    #[serde(default)]
    pub face_index: u32,
}

fn default_crop_factor() -> f64 {
    2.0
}

fn default_src_ratio() -> f64 {
    1.0
}

/// The custom node packs of the ComfyUI novira runs.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NodePacks {
    /// Packs can be managed: novira knows the ComfyUI folder and its Python.
    pub available: bool,
    pub installed: Vec<crate::comfy::node_packs::InstalledNodePack>,
    /// The version of the ComfyUI novira runs (none when its version file cannot be read).
    pub comfy_version: Option<String>,
    /// Packs changed since ComfyUI started; it loads them when restarted.
    pub restart_needed: bool,
}

/// A ComfyUI API prompt built by the workflow editor and the nodes whose results to keep, most wanted first.
/// Inputs may hold placeholders the backend fills (see `comfy::user_graph`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComfyGraph {
    pub prompt: serde_json::Map<String, Value>,
    pub outputs: Vec<String>,
    /// A node whose picture is the first frame, when the graph makes a video (`outputs[0]` is then the saved video).
    #[serde(default)]
    pub thumbnail: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueItem {
    pub id: u64,
    pub batch_id: String,
    pub status: QueueItemStatus,
    pub origin: QueueOrigin,
    pub destination: QueueDestination,
    pub params: GenerationMetadata,
    pub board_id: Option<String>,
    pub init_image_url: Option<String>,
    pub workflow: Option<Value>,
    #[serde(default)]
    pub comfy_graph: Option<ComfyGraph>,
    #[serde(flatten)]
    pub guidance: Guidance,
    pub created_at: i64,
    pub started_at: Option<i64>,
    pub completed_at: Option<i64>,
    pub image_name: Option<String>,
    /// The engine's own text of a failure, kept for the developer log.
    pub error: Option<String>,
    /// What kind of failure `error` is, when novira recognises it (absent in items stored before it existed).
    #[serde(default)]
    pub error_kind: Option<QueueErrorKind>,
    /// What a job that makes text produced (a picture described as a prompt); no picture is stored for it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub result_text: Option<String>,
}

/// A failure the frontend explains and offers a way out of.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QueueErrorKind {
    /// The GPU (or the device the engine runs on) ran out of memory.
    OutOfMemory,
}

/// The size a failed item is queued again with (`retry_queue_item`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetrySize {
    pub width: u32,
    pub height: u32,
}

/// ComfyUI's low-memory mode (the `lowMemoryMode` setting).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LowMemoryMode {
    pub enabled: bool,
    /// novira starts this ComfyUI itself, so the setting takes effect (false for a server at `comfyuiUrl`).
    pub owned_engine: bool,
    /// The running ComfyUI was started with the other value; it applies when ComfyUI starts next.
    pub pending_restart: bool,
}

/// Which ComfyUI the app uses: its own copy, a server at `comfyuiUrl`, or the folder at `comfyuiDir`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ComfyuiMode {
    Owned,
    Url,
    Folder,
}

/// The ComfyUI portable package novira downloads (`comfyuiPackage`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ComfyuiPackage {
    Nvidia,
    Amd,
}

/// The engine settings the Settings screen shows, as saved in `settings.json`. Changes apply at the next start.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineSettings {
    /// The app's data folder (display only).
    pub data_dir: String,
    pub comfyui_mode: ComfyuiMode,
    /// Display only: these are changed in `settings.json`, never from the app.
    pub comfyui_url: Option<String>,
    pub comfyui_dir: Option<String>,
    pub comfyui_package: ComfyuiPackage,
    /// novira's own ComfyUI is installed in the data folder (owned mode only).
    pub comfyui_installed: bool,
    /// The package that install was made from; `None` when it is not known (an install made before the record existed).
    pub installed_comfyui_package: Option<ComfyuiPackage>,
    pub comfyui_start_timeout_secs: u64,
    /// The extra model folders; novira's own `models/` is always scanned and is not listed.
    pub model_roots: Vec<String>,
    /// Look up local models on Civitai by file hash (their pictures and licenses). Sends the hashes; off by default.
    pub civitai_lookup: bool,
    /// A saved value (package, start timeout, model folders, the lookup) differs from what the running app started with.
    pub restart_needed: bool,
}

/// The engine settings `set_engine_settings` may change; a missing field is left as it is. Values are checked by
/// `settings::check_package` and `settings::check_start_timeout`.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EngineSettingsPatch {
    #[serde(default)]
    pub comfyui_package: Option<String>,
    #[serde(default)]
    pub comfyui_start_timeout_secs: Option<u64>,
    #[serde(default)]
    pub civitai_lookup: Option<bool>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueStatus {
    pub pending: u32,
    pub in_progress: u32,
    pub completed: u32,
    pub failed: u32,
    pub canceled: u32,
    pub total: u32,
    pub is_paused: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub item_id: u64,
    pub step: u32,
    pub total_steps: u32,
    pub progress_image_url: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedWorkflow {
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub tags: Vec<String>,
    pub category: String,
    pub updated_at: i64,
    pub graph: Value,
}

/// `saveWorkflow` input: a workflow without the server-owned fields.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowInput {
    #[serde(default)]
    pub id: Option<String>,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub graph: Value,
}

/// One saved comic project. The backend keeps `document` as it is; the frontend owns its shape.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComicRecord {
    pub id: String,
    pub updated_at: i64,
    pub document: Value,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImagePatch {
    /// `Some(None)` moves the images to "uncategorized".
    #[serde(
        default,
        deserialize_with = "double_option",
        skip_serializing_if = "Option::is_none"
    )]
    pub board_id: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub starred: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_intermediate: Option<bool>,
}

fn double_option<'de, D: serde::Deserializer<'de>>(
    d: D,
) -> Result<Option<Option<String>>, D::Error> {
    Option::<String>::deserialize(d).map(Some)
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageOptions {
    pub board_id: Option<String>,
    #[serde(default)]
    pub is_intermediate: Option<bool>,
    #[serde(default)]
    pub category: Option<ImageCategory>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueSnapshot {
    pub items: Vec<QueueItem>,
    pub status: QueueStatus,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bootstrap {
    pub models: Vec<ModelConfig>,
    pub boards: Vec<BoardDTO>,
    pub images: Vec<ImageDTO>,
    pub workflows: Vec<SavedWorkflow>,
    pub queue: QueueSnapshot,
    pub engine: crate::engine::EngineStatus,
    pub packs: crate::packs::Packs,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedFile {
    pub path: String,
    pub installed: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LogLevel {
    Info,
    Warn,
    Error,
}

/// One line of the app's own log (see `applog`), shown in the frontend's developer log.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    /// Milliseconds since the Unix epoch.
    pub at: u64,
    pub level: LogLevel,
    /// Where it came from: "backend", "queue", "engine", "panic", ...
    pub source: String,
    pub message: String,
}

/// Events pushed to the frontend. `queue_cleared` also carries the remaining items so a client mirror can resync.
// Events are built once and serialized right away, so the size difference between variants does not matter.
#[allow(clippy::large_enum_variant)]
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BackendEvent {
    QueueItemStatusChanged {
        item: QueueItem,
    },
    QueueCleared {
        items: Vec<QueueItem>,
    },
    ProcessorState {
        #[serde(rename = "isPaused")]
        is_paused: bool,
    },
    InvocationProgress {
        progress: ProgressEvent,
    },
    EngineStatus {
        status: crate::engine::EngineStatus,
    },
    Pack {
        kind: crate::packs::PackKind,
        status: crate::packs::PackStatus,
    },
    /// Progress of installing a custom node pack, keyed by its GitHub address.
    NodePack {
        url: String,
        status: crate::packs::PackStatus,
    },
    ImageAdded {
        image: ImageDTO,
        item: Option<QueueItem>,
    },
    ModelInstall {
        job: ModelInstallJob,
    },
    ModelAdded {
        model: ModelConfig,
    },
    /// A line of the app's log (developer log).
    Log {
        entry: LogEntry,
    },
    /// Progress of writing a backup or unpacking one for a restore.
    Backup {
        progress: crate::backup::BackupProgress,
    },
    /// A tool call of the assistant's running request, for the frontend to run and answer (`agent_tool_result`).
    AgentToolCall {
        call: crate::agent::AgentToolCall,
    },
    /// The screen state was saved by a page (`save_ui_state`). `origin` is that page's own id (empty when it sent
    /// none); `revision` only grows. The state is read with `adopt_ui_state`.
    UiStateChanged {
        origin: String,
        revision: u64,
    },
}

/// Whether the files of the export watermark (TrustMark's models and ONNX Runtime) are on this PC.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum WatermarkStatus {
    /// Not there, and no download is running.
    Missing,
    /// Being downloaded (bytes so far of the total).
    Downloading {
        done: u64,
        total: u64,
    },
    Ready,
    /// The last download or load failed.
    Failed {
        message: String,
    },
}

/// What "check a picture" found in one file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatermarkCheck {
    /// The checked file's name, for display.
    pub file_name: String,
    /// The watermark was looked for; false when its files are not ready (the other checks still ran).
    pub watermark_checked: bool,
    /// A TrustMark watermark was read.
    pub watermark_found: bool,
    /// That watermark carries novira's marker.
    pub novira_marker: bool,
    /// The random id of a novira watermark, as 12 hexadecimal digits.
    pub watermark_id: Option<String>,
    /// The gallery picture this id was exported from, when this app's database knows the id.
    pub original_name: Option<String>,
    /// That picture is still in the gallery.
    pub original_in_gallery: bool,
    /// When the copy was exported (milliseconds since the Unix epoch).
    pub exported_at: Option<i64>,
    /// The file carries C2PA content credentials.
    pub credentials_present: bool,
    /// Their signature and hashes check out (the signer may still be unknown).
    pub credentials_valid: bool,
    /// The signer is on a trust list (never the case for novira's own certificate).
    pub credentials_trusted: bool,
    /// The credentials say the picture was made by AI.
    pub credentials_ai: bool,
    /// The signer's name as the credentials state it.
    pub credentials_signer: Option<String>,
    /// Signed by this installation of novira.
    pub credentials_this_app: bool,
    /// The file's XMP labels it as made by AI (IPTC digital source type).
    pub iptc_ai: bool,
}

#[cfg(test)]
mod tests;
