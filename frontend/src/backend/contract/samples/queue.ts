// Generation parameters and the queue.
import type {
  ComfyGraph,
  ControlLayerInput,
  EnqueueRequest,
  GenerationMetadata,
  LowMemoryMode,
  HiresFix,
  MangaScreen,
  MusicParams,
  ProgressEvent,
  QueueItem,
  RefImageInput,
  RegionalLayerInput,
  RetrySize,
  VoiceParams,
} from '../../types';
import type { QueueSnapshot } from './helpers';

export const music = {
  lyrics: '[verse]\nla la la',
  seconds: 30,
  bpm: 120,
  key: 'E minor',
  timeSignature: 4,
  language: 'en',
  instrumental: false,
} satisfies Required<MusicParams>;

export const voice = {
  text: 'Hello there',
  language: 'English',
  mode: 'design',
  speaker: 'Vivian',
  instruct: 'a calm, low voice',
} satisfies Required<VoiceParams>;

export const hiresFix = {
  scale: 1.5,
  strength: 0.45,
  upscaleModelKey: 'upscale-4x',
  steps: 12,
} satisfies Required<HiresFix>;
export const mangaScreen = {
  screenLines: 240,
  whitePoint: 0.85,
  blackPoint: 0.35,
  gradation: 0.75,
  whiteLines: 0.45,
} satisfies Required<MangaScreen>;

export const regionalLayers = [
  {
    imageUrl: 'http://novira-image.localhost/full/region-1.png',
    positivePrompt: 'a red hat',
    negativePrompt: null,
    autoNegative: true,
  },
] satisfies Required<RegionalLayerInput>[];

export const controlLayers = [
  {
    imageUrl: 'http://novira-image.localhost/full/control-1.png',
    modelKey: 'controlnet-union-sdxl',
    weight: 0.75,
    beginEnd: [0.25, 0.75],
    controlMode: 'more_control',
    controlType: 'openpose',
  },
  {
    imageUrl: 'http://novira-image.localhost/full/control-2.png',
    modelKey: 'controlnet-union-sdxl',
    weight: 1.25,
    beginEnd: [0.5, 0.875],
    controlMode: 'balanced',
    controlType: 'softedge',
  },
] satisfies Required<ControlLayerInput>[];

export const refImages = [
  {
    imageUrl: 'http://novira-image.localhost/full/reference.png',
    modelKey: 'ip-adapter-sdxl',
    clipVisionModel: 'ViT-H',
    weight: 0.65,
    beginEnd: [0.125, 0.875],
    method: 'style_precise',
    regionImageUrl: 'http://novira-image.localhost/full/reference-region.png',
  },
] satisfies Required<RefImageInput>[];

export const referencePictures = ['http://novira-image.localhost/full/character.png'];

export const generationMetadata = {
  generationMode: 'img2img',
  positivePrompt: 'a cute girl, watercolor',
  negativePrompt: 'lowres',
  modelKey: 'main-sdxl',
  modelName: 'WAI-illustrious-SDXL',
  vaeKey: 'vae-sdxl',
  seed: 1234567,
  steps: 28,
  cfgScale: 6.5,
  cfgRescale: 0.25,
  scheduler: 'dpmpp_2m_k',
  width: 832,
  height: 1216,
  clipSkip: 2,
  seamlessX: true,
  seamlessY: false,
  loras: [{ key: 'lora-1', weight: 0.75, isEnabled: true }],
  strength: 0.55,
  upscaleScale: 1.5,
  upscaleModelKey: 'upscale-4x',
  creativity: 0.25,
  structure: 0.5,
  tileControlnetModelKey: 'controlnet-tile',
  postProcessingModelKey: 'upscale-4x',
  workflowName: 'My graph',
  refImageCount: 1,
  controlLayerCount: 2,
  refImages,
  controlLayers,
  regionalGuidanceCount: 1,
  regionalLayers,
  referencePictures,
  maskBlur: 12,
  draftAt: 0.5,
  videoFrames: 81,
  videoFps: 16,
  videoFp8: true,
  videoTiledDecode: true,
  music,
  voice,
  hiresFix,
  mangaScreen,
  sampling: { sampler: 'euler', scheduler: 'simple' },
} satisfies Required<GenerationMetadata>;

export const comfyGraph = {
  prompt: {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'model.safetensors' } },
    '2': { class_type: 'SaveImage', inputs: { images: ['1', 0], filename_prefix: 'novira' } },
  },
  outputs: ['2'],
  thumbnail: '1',
} satisfies Required<ComfyGraph>;

export const enqueueRequest = {
  origin: 'canvas',
  destination: 'gallery',
  params: generationMetadata,
  iterations: 2,
  randomizeSeed: true,
  prepend: false,
  boardId: 'board-1',
  initImageUrl: 'http://novira-image.localhost/full/source.png',
  workflow: { nodes: [], edges: [] },
  comfyGraph,
  maskImageUrl: 'http://novira-image.localhost/full/mask.png',
  controlLayers,
  regionalLayers,
  refImages,
  referencePictures,
} satisfies Required<EnqueueRequest>;

export const queueItem = {
  id: 7,
  batchId: 'batch-1',
  status: 'in_progress',
  origin: 'workflows',
  destination: 'canvas',
  params: generationMetadata,
  boardId: 'board-1',
  initImageUrl: 'http://novira-image.localhost/full/source.png',
  workflow: { nodes: [], edges: [] },
  comfyGraph,
  maskImageUrl: 'http://novira-image.localhost/full/mask.png',
  controlLayers,
  regionalLayers,
  refImages,
  referencePictures,
  createdAt: 1700000000000,
  startedAt: 1700000001000,
  completedAt: 1700000002000,
  imageName: 'abc.png',
  error: 'ComfyUI KSampler: CUDA out of memory',
  errorKind: 'out_of_memory',
  resultText: '1girl, solo, smile',
} satisfies Required<QueueItem>;

export const retrySize = { width: 448, height: 640 } satisfies Required<RetrySize>;

export const lowMemoryMode = { enabled: true, ownedEngine: true, pendingRestart: false } satisfies Required<LowMemoryMode>;

export const queueSnapshot = {
  items: [queueItem],
  status: { pending: 1, inProgress: 2, completed: 3, failed: 4, canceled: 5, total: 15, isPaused: true },
} satisfies Required<QueueSnapshot>;

export const progressEvent = {
  itemId: 7,
  step: 3,
  totalSteps: 28,
  progressImageUrl: 'data:image/png;base64,iVBORw0KGgo=',
  message: 'denoising',
} satisfies Required<ProgressEvent>;
