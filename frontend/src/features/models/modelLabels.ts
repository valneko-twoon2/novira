// Display helpers for model types, formats and sizes. Keys only; render with t() at render time.
import type { BaseModel, ModelConfig, ModelFormat, ModelInstallStatus, ModelType } from '@/backend';
import type { MessageKey } from '@/i18n';

export const MODEL_TYPES: ModelType[] = [
  'main',
  'lora',
  'vae',
  'controlnet',
  't2i_adapter',
  'ip_adapter',
  'clip_vision',
  'spandrel_image_to_image',
  't5_encoder',
  'clip_embed',
  'diffusion_model',
  'text_encoder',
  'model_patch',
];

/** Install job statuses that are still in progress. */
export const ACTIVE_STATUSES = new Set<ModelInstallStatus>(['waiting', 'downloading', 'running']);

export const BASE_MODELS: BaseModel[] = ['sd-1', 'sd-2', 'sdxl', 'sd-3', 'flux', 'flux2', 'anima', 'chroma', 'qwen-image', 'z-image', 'hidream', 'auraflow', 'hunyuan-image', 'hunyuan-dit', 'wan', 'hunyuan-video', 'hunyuan-video-15', 'ltx-video', 'ltx2', 'any'];

export const TYPE_KEYS: Record<ModelType, MessageKey> = {
  main: 'models.type.main',
  lora: 'models.type.lora',
  vae: 'models.type.vae',
  controlnet: 'models.type.controlnet',
  t2i_adapter: 'models.type.t2iAdapter',
  ip_adapter: 'models.type.ipAdapter',
  clip_vision: 'models.type.clipVision',
  spandrel_image_to_image: 'models.type.spandrel',
  t5_encoder: 'models.type.t5Encoder',
  clip_embed: 'models.type.clipEmbed',
  diffusion_model: 'models.type.diffusion',
  text_encoder: 'models.type.textEncoder',
  model_patch: 'models.type.modelPatch',
};

export const FORMAT_LABELS: Record<ModelFormat, string> = {
  checkpoint: 'Checkpoint',
  diffusers: 'Diffusers',
  lycoris: 'LyCORIS',
  invokeai: 'InvokeAI',
  gguf: 'GGUF',
  bnb_quantized: 'BnB NF4',
};

/**
 * The file-format tag of a model, or null when it says nothing. `checkpoint` is the plain single-file format; on anything
 * but a main model it only repeats "file" and reads like a category (a diffusion model tagged "Checkpoint").
 */
export function formatTag(model: Pick<ModelConfig, 'type' | 'format'>): string | null {
  if (model.format === 'checkpoint' && model.type !== 'main') return null;
  return FORMAT_LABELS[model.format];
}

export const INSTALL_STATUS_KEYS: Record<ModelInstallStatus, MessageKey> = {
  waiting: 'models.install.status.waiting',
  downloading: 'models.install.status.downloading',
  running: 'models.install.status.running',
  completed: 'models.install.status.completed',
  error: 'models.install.status.error',
  cancelled: 'models.install.status.cancelled',
};

/** Human readable byte size (binary units). Unit symbols are not translated. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / 1024 ** i;
  return `${v.toFixed(i === 0 ? 0 : v < 10 ? 2 : 1)} ${units[i]}`;
}

/** The page a model came from: the stored one, else built from its install source (`civitai:<id>/…`, `owner/repo::file`, or an address). */
export function modelPageUrl(model: { pageUrl?: string | null; source: string }): string | null {
  if (model.pageUrl) return model.pageUrl;
  const s = model.source.trim();
  if (/^https?:\/\//i.test(s)) return s;
  const civitai = /^civitai:(\d{1,12})(?:\/|$)/.exec(s);
  if (civitai) return `https://civitai.com/models/${civitai[1]}`;
  const hf = /^([\w.-]+\/[\w.-]+)::/.exec(s);
  return hf ? `https://huggingface.co/${hf[1]}` : null;
}
