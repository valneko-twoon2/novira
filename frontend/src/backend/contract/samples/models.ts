// Installed models, starter models, installs and the online model search.
import type {
  CivitaiModel,
  CivitaiSearchParams,
  CivitaiSearchResult,
  ModelConfig,
  ModelInstallJob,
  ModelPartsReport,
  OwnedModelLicense,
  StarterModel,
} from '../../types';
import type { ScannedFile } from './helpers';

export const license = {
  site: 'huggingface',
  name: 'CreativeML Open RAIL++-M',
  commercial: 'limited',
  permissions: [
    { key: 'sellImages', allowed: true },
    { key: 'sellModel', allowed: false },
    { key: 'noCredit', allowed: null },
  ],
} satisfies Required<OwnedModelLicense>;

export const defaultSettings = {
  vae: 'vae-sdxl',
  vaePrecision: 'fp16',
  steps: 30,
  cfgScale: 5.5,
  scheduler: 'euler_a',
  width: 1024,
  height: 1024,
} satisfies Required<NonNullable<ModelConfig['defaultSettings']>>;

export const modelConfig = {
  key: 'main-sdxl',
  name: 'WAI-illustrious-SDXL',
  base: 'sdxl',
  type: 'main',
  format: 'checkpoint',
  description: 'An anime model',
  path: 'checkpoints/wai.safetensors',
  size: 6938078334,
  source: 'civitai:827184',
  defaultSettings,
  triggerPhrases: ['masterpiece'],
  coverImageUrl: 'https://image.civitai.com/cover.jpeg',
  coverMature: true,
  license,
} satisfies Required<ModelConfig>;

export const starterModel = {
  id: 'sdxl-base',
  name: 'SDXL base',
  base: 'sdxl',
  type: 'main',
  description: 'The base model',
  source: 'stabilityai/stable-diffusion-xl-base-1.0',
  dependencies: ['sdxl-vae'],
  sizeBytes: 6938078334,
} satisfies Required<StarterModel>;

export const modelPartsReport = {
  modelKey: 'diffusion-anima',
  modelName: 'anima-base-v1.0',
  missing: [
    {
      id: 'starter-qwen3-06b',
      name: 'qwen_3_06b_base',
      base: 'any',
      type: 'text_encoder',
      description: 'Text encoder',
      source: 'circlestone-labs/Anima::split_files/text_encoders/qwen_3_06b_base.safetensors',
      sizeBytes: 1190000000,
    },
  ],
  unavailable: ['the SD3 VAE (sd3_vae.safetensors)'],
} satisfies Required<ModelPartsReport>;

export const modelInstallJob = {
  id: 'job-1',
  source: 'https://civitai.com/api/download/models/1',
  name: 'Some LoRA',
  status: 'error',
  bytes: 1024,
  totalBytes: 4096,
  error: 'disk full',
} satisfies Required<ModelInstallJob>;

export const scannedFile = { path: 'D:/models/a.safetensors', installed: true } satisfies Required<ScannedFile>;

export const civitaiSearchParams = {
  source: 'huggingface',
  query: 'anime',
  kind: 'LoRA',
  baseModel: 'sdxl-compat',
  sort: 'rating',
  period: 'month',
  includeNsfw: false,
  cursor: 'next-page',
  licenses: ['sellImages', 'noCredit'],
  checkpointType: 'Merge',
  safetensorsOnly: true,
  creator: 'someone',
} satisfies Required<CivitaiSearchParams>;

export const civitaiModel = {
  id: '827184',
  name: 'WAI-illustrious-SDXL',
  kind: 'Checkpoint',
  baseModel: 'Illustrious',
  creator: 'someone',
  downloads: 1000,
  likes: 200,
  rating: 4.5,
  ratingCount: 30,
  createdAt: 1700000000000,
  nsfw: false,
  imageCount: 2,
  imageUrls: ['https://image.civitai.com/a.jpeg', 'https://image.civitai.com/b.jpeg'],
  tags: ['anime'],
  description: '<p>A model</p>',
  license: ['Sell images'],
  commercial: 'allowed',
  permissions: [{ key: 'sellImages', allowed: true }],
  triggerWords: ['masterpiece'],
  source: 'civitai',
  versions: [
    {
      id: '1',
      name: 'v1',
      baseModel: 'Illustrious',
      createdAt: 1700000000000,
      triggerWords: ['masterpiece'],
      files: [{ id: '10', name: 'wai.safetensors', sizeBytes: 6938078334, format: 'SafeTensor', precision: 'fp16' }],
    },
  ],
} satisfies Required<CivitaiModel>;

export const civitaiSearchResult = { items: [civitaiModel], nextCursor: 'cursor-2' } satisfies Required<CivitaiSearchResult>;
