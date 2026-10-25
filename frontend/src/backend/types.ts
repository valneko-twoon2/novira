// Domain types shared by the UI and the backend client (mock now, Tauri/Rust later).

export type BaseModel =
  | 'sd-1'
  | 'sd-2'
  | 'sdxl'
  | 'sd-3'
  | 'flux'
  | 'flux2'
  | 'anima'
  | 'chroma'
  | 'qwen-image'
  | 'z-image'
  | 'hidream'
  | 'auraflow'
  | 'hunyuan-image'
  | 'hunyuan-dit'
  | 'wan'
  | 'hunyuan-video'
  | 'hunyuan-video-15'
  | 'ltx-video'
  | 'ltx2'
  | 'any';
export type ModelType =
  | 'main'
  | 'vae'
  | 'lora'
  | 'controlnet'
  | 't2i_adapter'
  | 'ip_adapter'
  | 'clip_vision'
  | 'spandrel_image_to_image'
  | 't5_encoder'
  | 'clip_embed'
  | 'diffusion_model'
  | 'text_encoder'
  | 'model_patch';
export type ModelFormat = 'checkpoint' | 'diffusers' | 'lycoris' | 'invokeai' | 'gguf' | 'bnb_quantized';

export interface ModelConfig {
  key: string;
  name: string;
  base: BaseModel;
  type: ModelType;
  format: ModelFormat;
  description: string;
  path: string;
  /** Size on disk in bytes. */
  size: number;
  source: string;
  /** Default generation settings for main models. */
  defaultSettings?: {
    vae?: string | null;
    vaePrecision?: 'fp16' | 'fp32';
    steps?: number;
    cfgScale?: number;
    scheduler?: SchedulerName;
    width?: number;
    height?: number;
  };
  triggerPhrases?: string[];
  coverImageUrl?: string;
  /** The cover is a mature picture (all the site has for the model are), so the pictures carry the `is-mature` class (nothing styles it yet). */
  coverMature?: boolean;
  /** Every picture the site has for the model, the cover first. Absent when the cover is the only one known. */
  coverImageUrls?: string[];
  /** The model's own page on the site it came from; an address `openSourcePage` accepts. */
  pageUrl?: string;
  /** What the license allows, as the site the model came from states it. Absent until it has been looked up. */
  license?: OwnedModelLicense;
}

export interface StarterModel {
  id: string;
  name: string;
  base: BaseModel;
  type: ModelType;
  description: string;
  source: string;
  dependencies?: string[];
  /** About how many bytes the download is; known for the files other models load as their parts. */
  sizeBytes?: number;
}

/** The starter files an installed model needs but the library does not hold yet. */
export interface ModelPartsReport {
  modelKey: string;
  modelName: string;
  /** The starter entries that install what is missing, in loading order. Empty when nothing is missing. */
  missing: StarterModel[];
  /** What is missing but has no starter entry to install it from, as the engine words it. */
  unavailable: string[];
}

export type ModelInstallStatus = 'waiting' | 'downloading' | 'running' | 'completed' | 'error' | 'cancelled';

export interface ModelInstallJob {
  id: string;
  source: string;
  name: string;
  status: ModelInstallStatus;
  bytes: number;
  totalBytes: number;
  error?: string;
}

export type SchedulerName =
  | 'euler'
  | 'euler_a'
  | 'euler_k'
  | 'dpmpp_2m'
  | 'dpmpp_2m_k'
  | 'dpmpp_2m_sde_k'
  | 'dpmpp_sde_k'
  | 'heun'
  | 'lms'
  | 'ddim'
  | 'unipc'
  | 'lcm'
  | 'tcd';

export const SCHEDULERS: SchedulerName[] = [
  'euler',
  'euler_a',
  'euler_k',
  'dpmpp_2m',
  'dpmpp_2m_k',
  'dpmpp_2m_sde_k',
  'dpmpp_sde_k',
  'heun',
  'lms',
  'ddim',
  'unipc',
  'lcm',
  'tcd',
];

export interface LoRAParam {
  key: string;
  weight: number;
  isEnabled: boolean;
}

/**
 * `graph`: a workflow run as a ComfyUI prompt (it uses nodes of custom node packs).
 */
export type GenerationMode = 'txt2img' | 'img2img' | 'inpaint' | 'outpaint' | 'upscale' | 'workflow' | 'graph' | 'video' | 'music' | 'voice' | 'logo';

/** Parameters recorded in image metadata and recalled with "Use All". */
export interface GenerationMetadata {
  generationMode: GenerationMode;
  positivePrompt: string;
  negativePrompt: string;
  modelKey: string;
  modelName: string;
  vaeKey: string | null;
  seed: number;
  steps: number;
  cfgScale: number;
  cfgRescale: number;
  scheduler: SchedulerName;
  width: number;
  height: number;
  clipSkip: number;
  seamlessX: boolean;
  seamlessY: boolean;
  loras: LoRAParam[];
  strength?: number;
  upscaleScale?: number;
  upscaleModelKey?: string;
  /** Upscaling: the tile ControlNet that keeps the picture's structure while it is redrawn. */
  tileControlnetModelKey?: string;
  /** Upscaling: the model that finishes the drawn picture, before it is fitted to the output size. */
  postProcessingModelKey?: string;
  creativity?: number;
  structure?: number;
  workflowName?: string;
  refImageCount?: number;
  controlLayerCount?: number;
  /** The reference images and control layers the picture was made with (the queue stores them), so a derived picture can use them again. */
  refImages?: RefImageInput[];
  controlLayers?: ControlLayerInput[];
  /** Canvas regional guidance layers that were enabled, and (the queue stores them) what they said. */
  regionalGuidanceCount?: number;
  regionalLayers?: RegionalLayerInput[];
  /** The pictures the main model took in itself as references (FLUX.2; the queue stores them), so a derived picture can use them again. */
  referencePictures?: string[];
  /** Inpaint / outpaint: how far (pixels) the redrawn area blends into the kept picture. */
  maskBlur?: number;
  /** A draft: draw only up to this fraction (0..1) of the steps; the image is kept as an intermediate. */
  draftAt?: number;
  /** Video: number of frames (4n + 1) and frames per second. */
  videoFrames?: number;
  videoFps?: number;
  /** Video, for a small GPU: fp8 weights, and decoding the frames in tiles. */
  videoFp8?: boolean;
  videoTiledDecode?: boolean;
  /** Music: lyrics, length and musical settings (the style tags are the positive prompt). */
  music?: MusicParams;
  /** Voice: what is read out, and in which voice. */
  voice?: VoiceParams;
  /** Text to image: a second pass that enlarges the picture and draws it again. When set, `width` and `height` stay
   * the first pass's size (the setting); the picture itself is larger. */
  hiresFix?: HiresFix;
  /** Pictures: the drawn picture is finished as a black-and-white manga page (the ComfyUI-MangaScreen pack). */
  mangaScreen?: MangaScreen;
  /** The ComfyUI sampler and scheduler that ran, set by the backend when the picture is saved: a model of the newer
   * families (Anima, Flux...) always runs its family's own (`FAMILY_SAMPLING`), whatever `scheduler` says. Absent when
   * `scheduler` is what ran. */
  sampling?: Sampling;
}

/** A ComfyUI sampler and scheduler by their node names (`euler`, `simple`), or the scheduler node a family's graph
 * takes its sigmas from (`Flux2Scheduler`). Engine names, never translated. */
export interface Sampling {
  sampler: string;
  scheduler: string;
}

/** The manga finish of a picture: lines kept crisp, values pushed into flat tones and printed as a screentone. */
export interface MangaScreen {
  /** Rows of dots across the width (40 to 600). */
  screenLines: number;
  /** Brighter than this becomes paper white (0.3 to 1). */
  whitePoint: number;
  /** Darker than this becomes solid black (0 to 0.7). */
  blackPoint: number;
  /** Gradation tone where the original fades smoothly (0 to 1). */
  gradation: number;
  /** How many lines inside solid black are cut out white (0 to 1). */
  whiteLines: number;
}

/** The second pass of text to image ("high-resolution fix"): the first picture enlarged and drawn again with the same
 * seed, prompt and guidance at a low strength. */
export interface HiresFix {
  /** Enlargement of the first pass (the form offers 1.25 to 2.0). */
  scale: number;
  /** Denoise of the second pass (the form offers 0.2 to 0.75). */
  strength: number;
  /** An upscale model enlarges the decoded first picture; absent = a plain Lanczos resize ("smooth"). */
  upscaleModelKey?: string;
  /** Steps of the second pass; absent = as many as the first pass. */
  steps?: number;
}

export interface MusicParams {
  lyrics: string;
  /** Length in seconds. */
  seconds: number;
  bpm: number;
  /** For example `E minor`. */
  key: string;
  timeSignature: number;
  /** Language of the lyrics as ACE-Step names it: `en`, `ja`, ... or `unknown`. */
  language: string;
  /** Music without singing: the lyrics are ignored. */
  instrumental: boolean;
}

export type VoiceMode = 'preset' | 'design';

export interface VoiceParams {
  text: string;
  /** A language name the voice engine knows (`Japanese`, `English`, ...) or `Auto`. */
  language: string;
  mode: VoiceMode;
  /** The built-in speaker (preset mode). */
  speaker: string;
  /** Preset mode: how to speak (optional). Design mode: the description of the voice. */
  instruct: string;
}

export type ImageCategory = 'general' | 'user' | 'mask' | 'control' | 'other';

export interface ImageDTO {
  name: string;
  /** A video's `url` is the MP4 and its thumbnail is the first frame; an audio file's thumbnail is a picture of its waveform. Absent means a still image. */
  mediaType?: 'image' | 'video' | 'audio';
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  /** Epoch milliseconds. */
  createdAt: number;
  boardId: string | null;
  starred: boolean;
  isIntermediate: boolean;
  category: ImageCategory;
  metadata: GenerationMetadata | null;
  /** Serialized workflow graph, if the image was produced by a workflow. */
  workflow: unknown | null;
}

export interface BoardDTO {
  id: string;
  name: string;
  archived: boolean;
  createdAt: number;
}

export type QueueItemStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'canceled';
export type QueueOrigin = 'generate' | 'canvas' | 'upscaling' | 'workflows';
/** `intermediate`: a helper result the app uses itself (a selection mask); stored hidden, never shown or staged. */
export type QueueDestination = 'gallery' | 'canvas' | 'intermediate';
/** A failure the app explains and offers a way out of: `out_of_memory` = the GPU ran out of memory. */
export type QueueErrorKind = 'out_of_memory';

/** The size a failed item is queued again with (`retryQueueItem`): multiples of 8, not larger than before. */
export interface RetrySize {
  width: number;
  height: number;
}

/** ComfyUI's low-memory mode (the backend's `lowMemoryMode` setting). */
export interface LowMemoryMode {
  enabled: boolean;
  /** novira starts this ComfyUI itself, so the setting takes effect (false for a ComfyUI the user started). */
  ownedEngine: boolean;
  /** The running ComfyUI was started with the other value; it applies when ComfyUI starts next. */
  pendingRestart: boolean;
}

/** Which ComfyUI the app uses: its own copy, a server at `comfyuiUrl`, or the folder at `comfyuiDir`. */
export type ComfyuiMode = 'owned' | 'url' | 'folder';

/** The ComfyUI portable package novira downloads. */
export type ComfyuiPackage = 'nvidia' | 'amd';

/** The engine settings of the backend's `settings.json` that the Settings screen shows. Changes apply at the next start. */
export interface EngineSettings {
  /** The app's data folder (display only). */
  dataDir: string;
  comfyuiMode: ComfyuiMode;
  /** Display only: changed in `settings.json`, never from the app. */
  comfyuiUrl: string | null;
  comfyuiDir: string | null;
  comfyuiPackage: ComfyuiPackage;
  /** novira's own ComfyUI is installed in the data folder (owned mode only). */
  comfyuiInstalled: boolean;
  /** The package that install was made from; `null` when it is not known (an install made before the record existed). */
  installedComfyuiPackage: ComfyuiPackage | null;
  /** Seconds to wait for ComfyUI to answer after starting it: a whole number from 30 to 1800. */
  comfyuiStartTimeoutSecs: number;
  /** The extra model folders (at most 16). novira's own `models/` folder is always scanned and is not listed. */
  modelRoots: string[];
  /** Look up local models on Civitai by file hash (their pictures and licenses). Sends the hashes; off by default. */
  civitaiLookup: boolean;
  /** A saved value (package, start timeout, model folders, the lookup) differs from what the running app started with. */
  restartNeeded: boolean;
}

/** The engine settings `setEngineSettings` may change; a missing field is left as it is. */
export interface EngineSettingsPatch {
  comfyuiPackage?: ComfyuiPackage;
  comfyuiStartTimeoutSecs?: number;
  civitaiLookup?: boolean;
}

export interface EnqueueRequest {
  origin: QueueOrigin;
  destination: QueueDestination;
  /** Base parameters; the seed is varied per iteration. */
  params: GenerationMetadata;
  iterations: number;
  /** When true each iteration gets a fresh random seed, otherwise seed + i. */
  randomizeSeed: boolean;
  /** Put the batch at the front of the queue. */
  prepend: boolean;
  boardId: string | null;
  /** Optional source image (img2img, inpaint, upscale). */
  initImageUrl?: string | null;
  workflow?: unknown;
  /** The prompt a `graph` job runs. */
  comfyGraph?: ComfyGraph | null;
  /** Inpaint / outpaint: where to redraw, a picture the size of the source (white = redraw, grey = redraw less). */
  maskImageUrl?: string | null;
  /** Control layers (ControlNet), in order; as many as `params.controlLayerCount`. */
  controlLayers?: ControlLayerInput[];
  /** Regional guidance layers, in order; as many as `params.regionalGuidanceCount`. */
  regionalLayers?: RegionalLayerInput[];
  /** Reference images (IP-Adapter), in order; as many as `params.refImageCount`. */
  refImages?: RefImageInput[];
  /** Stored pictures the main model takes in itself as references (FLUX.2), not through an adapter, in order. */
  referencePictures?: string[];
}

/** How a control layer weighs against the prompt. */
export type ControlMode = 'balanced' | 'more_prompt' | 'more_control';
/**
 * What a control picture shows: an OpenPose stick figure, a depth map, hard edges or line art, soft edges or a scribble,
 * a normal map. A ControlNet that reads several kinds (a union model) is told it.
 */
export type ControlType = 'openpose' | 'depth' | 'lineart' | 'softedge' | 'normal';
/** What a reference image carries over. */
export type RefImageMethod = 'full' | 'style' | 'composition' | 'style_strong' | 'style_precise';
/** The image encoder an IP-Adapter model was trained with. */
export type ClipVisionModel = 'ViT-H' | 'ViT-G' | 'ViT-L';

/** One regional guidance layer: prompts that apply inside a region of the picture. */
export interface RegionalLayerInput {
  /** The region as white on black, the size of the generation area. */
  imageUrl: string;
  /** Said inside the region, besides the prompt of the whole picture. */
  positivePrompt: string | null;
  /** Kept out of the region. */
  negativePrompt: string | null;
  /** Also keep the region's positive prompt out of the rest of the picture. */
  autoNegative: boolean;
}

/** One control layer: its picture inside the generation area (after the layer's filter) and its settings. */
export interface ControlLayerInput {
  imageUrl: string;
  modelKey: string;
  weight: number;
  /** Start and end of the effect as fractions of the steps. */
  beginEnd: [number, number];
  controlMode: ControlMode;
  /** What the picture shows, when known; left out, a union ControlNet guesses. */
  controlType?: ControlType;
}

/** One reference image. */
export interface RefImageInput {
  imageUrl: string;
  modelKey: string;
  clipVisionModel: ClipVisionModel;
  weight: number;
  /** Start and end of the effect as fractions of the steps. */
  beginEnd: [number, number];
  method: RefImageMethod;
  /** Where it applies: a stored picture, white inside, the size of the generation area; absent for the whole picture. */
  regionImageUrl?: string | null;
}

/** One node of a ComfyUI API prompt; an input is a value, a link `[node id, output slot]` or a placeholder the backend fills. */
export interface ComfyPromptNode {
  class_type: string;
  inputs: Record<string, unknown>;
}

/** A ComfyUI API prompt and the nodes whose results to keep, most wanted first. */
export interface ComfyGraph {
  prompt: Record<string, ComfyPromptNode>;
  outputs: string[];
  /** A node whose picture is the first frame, when the graph makes a video (`outputs[0]` is then the saved video). */
  thumbnail?: string;
}

export interface QueueItem {
  id: number;
  batchId: string;
  status: QueueItemStatus;
  origin: QueueOrigin;
  destination: QueueDestination;
  params: GenerationMetadata;
  boardId: string | null;
  initImageUrl: string | null;
  workflow: unknown | null;
  /** The prompt of a `graph` job. */
  comfyGraph?: ComfyGraph | null;
  maskImageUrl?: string | null;
  controlLayers?: ControlLayerInput[];
  regionalLayers?: RegionalLayerInput[];
  refImages?: RefImageInput[];
  referencePictures?: string[];
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  imageName: string | null;
  /** The engine's own text of a failure (shown in the developer log and the queue details). */
  error: string | null;
  /** What kind of failure `error` is, when the backend recognises it. */
  errorKind?: QueueErrorKind | null;
  /** What a job that makes text produced (a picture described as a prompt); no picture is stored for it. */
  resultText?: string | null;
}

export interface QueueStatus {
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  canceled: number;
  total: number;
  isPaused: boolean;
}

export interface ProgressEvent {
  itemId: number;
  step: number;
  totalSteps: number;
  /** Small low-res preview of the image being denoised. */
  progressImageUrl: string | null;
  message: string;
}

export interface SavedWorkflow {
  id: string;
  name: string;
  description: string;
  author: string;
  tags: string[];
  category: 'default' | 'user';
  updatedAt: number;
  /** Serialized editor graph (owned by the workflows feature). */
  graph: unknown;
}

/**
 * A saved comic project: one row of the backend's comics table. The backend keeps `document` as it is;
 * the frontend owns its shape.
 */
export interface ComicRecord {
  id: string;
  updatedAt: number;
  document: unknown;
}

/** One input of a ComfyUI node: its type (a list of choices for a combo) and the options of its control. */
export type ComfyInputSpec = [type: string | string[], options?: Record<string, unknown>];

/** A node as ComfyUI describes it in `object_info`. */
export interface ComfyNodeDef {
  input: {
    required?: Record<string, ComfyInputSpec>;
    optional?: Record<string, ComfyInputSpec>;
    hidden?: Record<string, unknown>;
  };
  input_order?: Record<string, string[]>;
  output: (string | string[])[];
  output_is_list?: boolean[];
  output_name?: string[];
  name: string;
  display_name?: string;
  description?: string;
  /** `nodes` / `comfy_extras.*` for ComfyUI's own nodes, `comfy_api_nodes.*` for its cloud API nodes, `custom_nodes.<pack>` for installed packs. */
  python_module?: string;
  category?: string;
  output_node?: boolean;
  deprecated?: boolean;
  experimental?: boolean;
  /** A ComfyUI cloud API node: it needs an account with a paid service, so the editor does not offer it. */
  api_node?: boolean;
}

/** Every node the engine can run, keyed by node class. */
export type ComfyNodeDefs = Record<string, ComfyNodeDef>;

/** The words ComfyUI's own screens show in one language, read from the running ComfyUI; absent where it has none. */
export interface ComfyUiLocale {
  /** Names of the parts of node categories, by the part (`model`, `background removal`). */
  categories: Record<string, string>;
  /** Heading of the node library's section of ComfyUI's own nodes. */
  comfyNodesHeading: string | null;
  /** Heading of its section of extension nodes. */
  extensionsHeading: string | null;
  /** By node class. */
  nodes: Record<string, ComfyUiNodeText>;
}

export interface ComfyUiNodeText {
  name: string | null;
  description: string | null;
  /** By input name. */
  inputs: Record<string, ComfyUiFieldText>;
  /** By output index (`"0"`). */
  outputs: Record<string, ComfyUiFieldText>;
}

export interface ComfyUiFieldText {
  name: string | null;
  tooltip: string | null;
}

/** One axis of the Face Rig pack (a direction the face can be pushed in) and the range of its weight. */
export interface FaceRigAxis {
  name: string;
  label: string;
  au: string;
  group: 'mouth' | 'eyes' | 'brows' | 'head' | string;
  side: 'L' | 'R' | 'C';
  lo: number;
  hi: number;
}

/** What the Face Rig pack offers: its axes and the ready-made expressions. */
export interface FaceRigLibrary {
  axes: FaceRigAxis[];
  presets: Record<string, { aus: unknown; missing: string[] }>;
}

export interface FaceRigPreviewRequest {
  /** Editor session; the pack keeps the prepared face per key. */
  nodeKey: string;
  /** Gallery picture to use as the portrait; send it on the first request and when the picture changes. */
  image?: string | null;
  /** The pose, in the Face Rig node's own text format. */
  rig: string;
  /** `drag` while a handle moves (fast), `final` when it is released (also re-measures the handles). */
  quality: 'drag' | 'final';
  cropFactor?: number;
  srcRatio?: number;
  faceIndex?: number;
}

/** A rendered pose, or why there is none. Handle positions are 0..1 over the picture. */
export type FaceRigPreviewResult =
  | { image: string; anchors: Record<string, [number, number]>; settled: boolean; warning?: string }
  | { needsFrame: true }
  | { error: string };

export type BackendEvent =
  | { type: 'queue_item_status_changed'; item: QueueItem }
  | { type: 'queue_cleared' }
  | { type: 'processor_state'; isPaused: boolean }
  | { type: 'invocation_progress'; progress: ProgressEvent }
  | { type: 'image_added'; image: ImageDTO; item: QueueItem | null }
  | { type: 'model_install'; job: ModelInstallJob }
  | { type: 'model_added'; model: ModelConfig }
  | { type: 'engine_status'; status: EngineStatus }
  | { type: 'pack'; kind: PackKind; status: PackStatus }
  /** Progress of installing a custom node pack, keyed by its GitHub address. */
  | { type: 'node_pack'; url: string; status: PackStatus }
  /** A line of the app's own log, for the developer log. */
  | { type: 'log'; entry: LogEntry }
  /** Progress of writing a backup or unpacking one for a restore. */
  | { type: 'backup'; progress: BackupProgress }
  /** A tool call of the assistant's running request (see `AgentToolCall`). */
  | { type: 'agent_tool_call'; call: AgentToolCall }
  /** A page saved the screen state (`saveUiState`): `origin` is that page's own id, `revision` only grows. The state is read with `adoptUiState(null)`. */
  | { type: 'ui_state_changed'; origin: string; revision: number };

export type LogLevel = 'info' | 'warn' | 'error';

/** One line of the app's log (backend lines arrive as `log` events; the frontend adds its own). */
export interface LogEntry {
  /** Milliseconds since the Unix epoch. */
  at: number;
  level: LogLevel;
  /** Where it came from: "backend", "queue", "engine", "panic", "frontend", ... */
  source: string;
  message: string;
}

/** The graphics card the models would run on, for recommending ones that fit. */
export interface HardwareInfo {
  /** The card's name; empty when none was found. */
  gpuName: string;
  /** Its memory in bytes; `null` when it could not be read. */
  vramBytes: number | null;
}

/** The extra models a kind of media (or the erase tool, `inpaint`; the fast video model, `turbo`) needs; each is downloaded on request. */
export type PackKind = 'video' | 'turbo' | 'music' | 'voice' | 'inpaint' | 'logo';

export type PackStatus =
  | { state: 'missing'; totalBytes: number }
  | { state: 'downloading'; file: string; index: number; count: number; bytes: number; totalBytes: number }
  /** A step that is not a plain download (installing the voice engine's libraries). */
  | { state: 'installing'; step: string }
  | { state: 'ready' }
  | { state: 'error'; message: string };

export type Packs = Record<PackKind, PackStatus>;

/** A custom node pack in ComfyUI's `custom_nodes` folder. */
export interface InstalledNodePack {
  folder: string;
  /** Where novira installed it from (null for packs put there by hand). */
  url: string | null;
  /** The tag it was installed at (null: the default branch, or put there by hand). */
  version: string | null;
}

/** One pack of the ComfyUI Registry (the public list of custom node packs), hosted on GitHub. */
export interface RegistryNode {
  id: string;
  name: string;
  description: string;
  publisher: string;
  /** `https://github.com/<owner>/<repo>`. */
  repository: string;
  /** A picture address on an allowed host, or null. */
  icon: string | null;
  downloads: number;
  stars: number;
  version: string | null;
  /** Date (`YYYY-MM-DD`) the latest version was published. */
  updated: string | null;
  license: string | null;
}

/** What GitHub says about a pack's repository. */
export interface NodePackInfo {
  author: string;
  /** SPDX id of the licence (null when the repository has none GitHub recognises). */
  license: string | null;
  description: string | null;
  stars: number;
}

/** The custom node packs of the ComfyUI novira runs. */
export interface NodePacks {
  /** Packs can be managed: novira knows the ComfyUI folder and its Python. */
  available: boolean;
  installed: InstalledNodePack[];
  /** The version of the ComfyUI novira runs (null when it cannot be read). */
  comfyVersion: string | null;
  /** Packs changed since ComfyUI started; it loads them when restarted. */
  restartNeeded: boolean;
}

/** State of the image engine (ComfyUI) that the backend installs and starts by itself. */
export type EngineStatus =
  | { state: 'idle' }
  | { state: 'downloading'; bytes: number; totalBytes: number }
  | { state: 'extracting' }
  | { state: 'starting' }
  | { state: 'ready' }
  | { state: 'error'; message: string };

// Civitai-style online model search (Browse tab) ---------------------------------------------

export type CivitaiKind = 'LoRA' | 'Checkpoint' | 'ControlNet' | 'VAE' | 'Diffusion';
export type CivitaiSort = 'downloads' | 'rating' | 'newest';
export type CivitaiPeriod = 'all' | 'year' | 'month' | 'week' | 'day';

export interface CivitaiFile {
  id: string;
  name: string;
  sizeBytes: number;
  format: 'SafeTensor' | 'PickleTensor' | 'GGUF';
  precision: 'fp16' | 'fp32' | 'bf16' | 'fp8';
}

export interface CivitaiVersion {
  id: string;
  name: string;
  baseModel: string;
  createdAt: number;
  triggerWords: string[];
  files: CivitaiFile[];
}

/** Whether generated images / the model may be used commercially, derived from the license terms. */
export type CommercialUse = 'allowed' | 'limited' | 'denied';

/** The uses a license is checked for, in display order. */
export type PermissionKey = 'sellImages' | 'generationServices' | 'sellModel' | 'shareMerges' | 'differentLicense' | 'noCredit';

/** The license of a model on this PC: the site it was read from, its name (Hugging Face) and what it allows. */
export interface OwnedModelLicense {
  site: ModelSource;
  name?: string;
  commercial: CommercialUse;
  permissions: ModelPermission[];
}

/** One use the license allows (`true`), forbids (`false`) or does not state (`null`). */
export interface ModelPermission {
  key: PermissionKey;
  allowed: boolean | null;
}

export interface CivitaiModel {
  id: string;
  name: string;
  kind: CivitaiKind;
  baseModel: string;
  creator: string;
  downloads: number;
  likes: number;
  rating: number;
  ratingCount: number;
  createdAt: number;
  nsfw: boolean;
  /** Number of cover images. */
  imageCount: number;
  /** Real cover image URLs. Absent for the mock, whose covers are synthesized on the client from the model id. */
  imageUrls?: string[];
  tags: string[];
  description: string;
  license: string[];
  /** Commercial use summary shown as a tag in the browser. */
  commercial: CommercialUse;
  /** Item-by-item view of the license (Civitai's permission flags, or what the Hugging Face license tag means). */
  permissions?: ModelPermission[];
  triggerWords: string[];
  /** Where the model is from. Absent means Civitai. */
  source?: ModelSource;
  versions: CivitaiVersion[];
}

export type ModelSource = 'civitai' | 'huggingface';

export interface CivitaiSearchParams {
  /** Where to search. Absent means Civitai. */
  source?: ModelSource;
  query: string;
  kind: CivitaiKind | 'all';
  /** 'all', 'sdxl-compat' (SDXL 1.0 / Illustrious / NoobAI / Pony) or an exact base model name. */
  baseModel: string;
  sort: CivitaiSort;
  period: CivitaiPeriod;
  includeNsfw: boolean;
  cursor?: string | null;
  /** Permission keys (`ModelPermission.key`) the license must allow; every one of them. Civitai only. */
  licenses?: string[];
  /** Checkpoints only: `Trained` or `Merge`; absent or empty for either. Civitai only. */
  checkpointType?: string;
  /** Only models that have a `.safetensors` file. Civitai only. */
  safetensorsOnly?: boolean;
  /** Only models of this creator. Civitai only. */
  creator?: string;
}

export interface CivitaiSearchResult {
  items: CivitaiModel[];
  nextCursor: string | null;
}

// AI assistant ---------------------------------------------------------------

/** What powers the assistant: the `claude` or `codex` command-line tool (the user signs in to it), or a server with an OpenAI-compatible chat API ('openai': Ollama, LM Studio, ...; the app runs the tool loop itself). */
export type AgentProvider = 'claude' | 'codex' | 'openai';

export interface AgentStatus {
  /** The chosen tool; null until the user picks one. */
  provider: AgentProvider | null;
  installed: boolean;
  loggedIn: boolean;
  /** The models the user can choose for the tool, with their efforts: Claude's aliases, or the models Codex lists. */
  models: AgentModelOption[];
  /** The saved OpenAI-compatible server (present once one is saved, whichever provider is selected). */
  endpoint?: AgentEndpointInfo;
}

/** Whether the connected model can call the app's tools: not tested yet, a test call worked, or it cannot (see `toolsReason`). */
export type AgentToolsState = 'unknown' | 'supported' | 'unsupported';

/** The saved OpenAI-compatible server. The API key stays in the backend; only whether one is set is known here. */
export interface AgentEndpointInfo {
  baseUrl: string;
  model: string;
  hasKey: boolean;
  /** The address is not on this PC: the pictures and prompts the assistant reads would be sent to it. */
  remote: boolean;
  /** The address is plain http and not on this PC: everything, the key included, travels unencrypted. */
  insecure: boolean;
  tools: AgentToolsState;
  /** Why the model cannot use the tools (the server's or the check's own words); only when `tools` is 'unsupported'. */
  toolsReason?: string;
}

/** The settings of the server as the form holds them. `apiKey`: absent keeps the saved key (for the same address), '' removes it. */
export interface AgentEndpointInput {
  baseUrl: string;
  model: string;
  apiKey?: string;
}

/** The result of "test connection": reachability, the model, and a tool-call round trip with a trivial tool. */
export interface AgentEndpointTest {
  reachable: boolean;
  error?: string;
  /** The model is among the server's models (absent when the server lists none). */
  modelFound?: boolean;
  tools: AgentToolsState;
  toolsReason?: string;
}

/** A model the assistant's tool can run on, the efforts it takes (from the lightest) and the one it starts at. */
export interface AgentModelOption {
  id: string;
  name: string;
  efforts: AgentEffort[];
  defaultEffort: AgentEffort;
}

export interface AgentTurn {
  role: 'user' | 'assistant';
  text: string;
}

/** A workflow-editor node type, summarized for the assistant. */
export interface AgentNodeType {
  type: string;
  inputs: string[];
  outputs: string[];
}

/** A node of ComfyUI or of an installed extension, as the assistant is told about it (`comfy:<Class>` in the editor). */
export interface AgentComfyNode {
  type: string;
  title: string;
  /** The part of ComfyUI's category the node is filed under (`audio`, `model/sampling`); absent for an extension's node. */
  group?: string;
  /** The extension the node comes from. */
  pack?: string;
  about?: string;
  /** The node ends a graph: its result is kept. */
  output?: true;
  /** `name*:type=default` (`*` marks a required input, `name<-TYPE` an input that takes a connection). */
  inputs: string[];
  /** `name:TYPE`; the name is what a connection's sourceHandle takes. */
  outputs: string[];
}

/** What a search of ComfyUI's nodes answers. */
export interface AgentNodeSearch {
  /** ComfyUI has told the editor which nodes it has. */
  ready: boolean;
  /** How many nodes of ComfyUI and of extensions there are to search. */
  total: number;
  note?: string;
  /** For a search with no words: the groups and how many nodes each holds. */
  groups?: { group: string; count: number }[];
  matches: AgentComfyNode[];
}

/** An extension pack as the assistant is told about it. */
export interface AgentPackInfo {
  id: string;
  name: string;
  goals: string[];
  about: string;
  installed: boolean;
}

/** A ready-made workflow graph the assistant can start from or combine; nodes are `[key, type, x, y, inputs?]`, edges `[from key, output, to key, input]`. */
export interface AgentRecipe {
  id: string;
  title: string;
  about: string;
  /** Extension packs (catalog ids) the graph needs that are not installed yet. */
  missing: string[];
  nodes: unknown[][];
  edges: string[][];
}

/** One screen or feature of the app as the assistant is told about it, so it can answer how-to questions from facts. */
export interface AgentGuideEntry {
  id: string;
  /** What the screen or feature is called on screen, in the user's language. */
  name: string;
  /** English: what it is for and how to reach it. */
  about: string;
}

/** An extension the question may be about: a pack of the ComfyUI Registry, one novira suggests, or one installed. */
export interface AgentExtensionInfo {
  /** `ext:` followed by the folder name. */
  id: string;
  name: string;
  publisher?: string;
  /** What the registry or the catalog says it does (English). */
  about: string;
  /** The purposes it is filed under (ids of the extension manager's list). */
  purposes?: string[];
  installed: boolean;
  version?: string | null;
  downloads?: number;
  url?: string | null;
  license?: string | null;
  /** The nodes it adds to ComfyUI, when it is installed and the question is about it. */
  nodes?: { name: string; about?: string; inputs: string[]; outputs: string[] }[];
}

/**
 * One message to the assistant. Only what every request needs travels with it; the model reads the rest (models,
 * settings, editors, the guide, extensions) through the app's tools, which the frontend runs (`agent_tool_call`).
 */
export interface AgentRequest {
  message: string;
  /** UI language (BCP 47 tag, e.g. ja, en, zh-CN); the assistant answers in it. */
  locale: string;
  /** Earlier turns of the conversation. */
  history?: AgentTurn[];
  /** What the user is looking at. */
  screen?: AgentScreen;
  /** The id (`ext:<folder>`) of the extension the user asked about from the extension manager. */
  focus?: string;
  /** The model the tool runs on (a Claude alias or full name, or a model Codex listed); left out for the tool's default. */
  agentModel?: string;
  /** How hard the model thinks: one of the efforts the chosen model takes; left out for the default. */
  effort?: AgentEffort;
  /** Gallery pictures attached to this message (names, at most `AGENT_MAX_ATTACHMENTS`); the backend reads and sends them. */
  images?: string[];
}

/** The most pictures one assistant message may carry (`attach::MAX_ATTACHMENTS` in the backend). */
export const AGENT_MAX_ATTACHMENTS = 4;

/** The thinking effort a chat turn can ask for (each model takes some of them; see AgentModelOption). */
export type AgentEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra';

/** The side bar's tabs, and on the Generate tab the screen of the kind being made (`generate` is images). */
export type AgentScreen = 'generate' | 'canvas' | 'comic' | 'upscaling' | 'workflows' | 'models' | 'browse' | 'queue' | 'extensions' | 'text' | 'video' | 'music' | 'voice' | 'logo';

/** The assistant's final answer. What it changed on the way, the frontend knows: it ran the tool calls. */
export interface AgentReply {
  /** A few short lines on how the request was read and why (the model's own summary). */
  thoughts?: string[];
  text: string;
}

/** A tool call of the running request, for the frontend to run and answer with `agentToolResult`. */
export interface AgentToolCall {
  /** `c-` and 32 hex digits. */
  callId: string;
  /** One of the tools the backend offers (`agent/tools.rs`); the frontend's dispatcher knows each one. */
  tool: string;
  /** The arguments, already checked against the tool's schema by the backend. */
  args: unknown;
  /** The call reads the user's pictures or prompts: it runs only as the user's permission setting says. */
  readGated: boolean;
}

/** The language editions of Wikipedia the assistant may look a fact up in. */
export type ReferenceLanguage = 'ja' | 'en';

/** One Wikipedia article found for the assistant: its title, the start of its text (plain, at most 1500 characters) and its address. */
export interface ReferenceHit {
  title: string;
  extract: string;
  url: string;
}

/** The answer to a tool call: text or JSON for the model, and whether the call failed (or was declined). */
export interface AgentToolAnswer {
  callId: string;
  ok: boolean;
  content: unknown;
}

// Export for sharing and backups ------------------------------------------------------------------------------------

/** File format of a copy exported for sharing. WebP is lossless (no quality setting). */
export type ExportFormat = 'png' | 'jpeg' | 'webp';

/** How shared copies are made. */
export interface ExportOptions {
  format: ExportFormat;
  /** JPEG quality, 1 to 100 (PNG and WebP ignore it). */
  quality: number;
  /** Longest side in pixels; null keeps the original size. Pictures are never enlarged. */
  maxSide: number | null;
  /** Leave out the prompt, settings and workflow. When false, only a PNG keeps them. */
  removeInfo: boolean;
  /** Mark every copy as made by AI: invisible TrustMark watermark, IPTC label in XMP, signed C2PA content credentials. */
  watermark: boolean;
}

export interface ExportResult {
  count: number;
  /** Selected items that were not written: videos, audio, or missing files. */
  skipped: number;
  /** Copies that carry the watermark and content credentials. */
  watermarked: number;
  /** The folder the user chose, for display; empty when the browser downloaded the files. */
  folder: string;
}

/** Whether the export watermark's files (TrustMark models, ONNX Runtime) are on this PC. */
export type WatermarkStatus =
  | { state: 'missing' }
  | { state: 'downloading'; done: number; total: number }
  | { state: 'ready' }
  | { state: 'failed'; message: string };

/** What "check a picture" found in one file. */
export interface WatermarkCheck {
  /** The checked file's name, for display. */
  fileName: string;
  /** The watermark was looked for; false when its files are not ready (the other checks still ran). */
  watermarkChecked: boolean;
  watermarkFound: boolean;
  /** The watermark carries novira's marker. */
  noviraMarker: boolean;
  /** The random id of a novira watermark (12 hex digits). */
  watermarkId: string | null;
  /** The gallery picture the id was exported from, when this app's database knows it. */
  originalName: string | null;
  originalInGallery: boolean;
  /** Milliseconds since the Unix epoch. */
  exportedAt: number | null;
  credentialsPresent: boolean;
  /** Signature and hashes check out (the signer may still be unknown). */
  credentialsValid: boolean;
  /** The signer is on a trust list (never for novira's own certificate). */
  credentialsTrusted: boolean;
  /** The credentials say the picture was made by AI. */
  credentialsAi: boolean;
  credentialsSigner: string | null;
  /** Signed by this installation of novira. */
  credentialsThisApp: boolean;
  /** The file's XMP labels it as made by AI (IPTC digital source type). */
  iptcAi: boolean;
}

/** What a backup holds (its manifest). */
export interface BackupInfo {
  appVersion: string;
  /** Milliseconds since the Unix epoch. */
  createdAt: number;
  images: number;
  boards: number;
  workflows: number;
}

export interface BackupSummary {
  /** The file name only, for display. */
  fileName: string;
  bytes: number;
  info: BackupInfo;
}

export type BackupPhase = 'create' | 'restore';

/** Files written into a backup or unpacked from one so far. */
export interface BackupProgress {
  phase: BackupPhase;
  done: number;
  total: number;
}

/** What the start-up did with a confirmed restore, told once. */
export type RestoreOutcome =
  | { state: 'none' }
  /** The backup's saved screen state: a JSON object of browser-storage keys to values. */
  | { state: 'restored'; uiState: string }
  | { state: 'failed'; message: string };

/** A partial file that an interrupted download left in the data folder. It is kept so the download can continue; the Data pane of the settings lists them. */
export interface UnfinishedDownload {
  /** Relative to the data folder, with `/` separators, for example `comfyui/.downloads/comfyui.part`. Identifies the file when deleting. */
  path: string;
  /** The file name only, for display. */
  name: string;
  /** Bytes kept so far. */
  bytes: number;
}
