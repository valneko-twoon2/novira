// Installed models, starter models, installs and the online model search.
import type {
  CivitaiModel,
  CivitaiSample,
  CivitaiSearchParams,
  CivitaiSearchResult,
  ModelConfig,
  ModelInstallJob,
  ModelPartsReport,
  ModelUpdate,
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
  coverImageUrls: ['https://image.civitai.com/cover.jpeg', 'https://image.civitai.com/cover2.jpeg'],
  pageUrl: 'https://civitai.com/models/827184?modelVersionId=1',
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
  price: 'free',
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
      paid: true,
      paidUntil: 1893456000000,
      files: [{ id: '10', name: 'wai.safetensors', sizeBytes: 6938078334, format: 'SafeTensor', precision: 'fp16' }],
    },
  ],
} satisfies Required<CivitaiModel>;

export const civitaiSearchResult = { items: [civitaiModel], nextCursor: 'cursor-2' } satisfies Required<CivitaiSearchResult>;

export const civitaiSamples = {
  samples: [
    {
      id: '94080991',
      imageUrl: 'https://image.civitai.com/a/width=512/94080991.jpeg',
      prompt: 'a hiker on a mountain',
      negativePrompt: 'blurry',
      seed: 746810293,
      steps: 25,
      cfgScale: 7.5,
      width: 512,
      height: 768,
      clipSkip: 2,
      sampler: 'DPM++ 2M Karras',
      resources: [
        { kind: 'checkpoint', name: null, versionId: '128713', weight: null },
        { kind: 'lora', name: 'detail-lora', versionId: null, weight: 0.65 },
      ],
    },
    {
      id: '2',
      imageUrl: 'https://image.civitai.com/b/width=512/2.jpeg',
      prompt: 'only a prompt',
      negativePrompt: null,
      seed: null,
      steps: null,
      cfgScale: null,
      width: null,
      height: null,
      clipSkip: null,
      sampler: null,
      resources: [],
    },
  ] satisfies CivitaiSample[],
};

export const modelUpdates = {
  updates: [
    {
      key: 'main-juggernaut-xl',
      modelId: '133005',
      installedVersionId: '288982',
      latestVersionId: '357609',
      latestName: 'v10',
      publishedAt: 1700000000000,
      pageUrl: 'https://civitai.com/models/133005?modelVersionId=357609',
    },
  ] satisfies ModelUpdate[],
};
