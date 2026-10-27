// Rail categories: each groups one or more model types. Keys only; render with t() at render time.
import type { ModelType } from '@/backend';
import type { MessageKey } from '@/i18n';

export type CategoryId = 'all' | 'favorites' | 'main' | 'lora' | 'controlnet' | 'ipAdapter' | 'vae' | 'upscale' | 'encoders' | 'diffusion';

export interface Category {
  id: CategoryId;
  labelKey: MessageKey;
  types: ModelType[];
}

export const CATEGORIES: Category[] = [
  { id: 'main', labelKey: 'models.rail.main', types: ['main'] },
  { id: 'lora', labelKey: 'models.rail.lora', types: ['lora'] },
  { id: 'controlnet', labelKey: 'models.rail.controlnet', types: ['controlnet', 't2i_adapter', 'model_patch'] },
  { id: 'ipAdapter', labelKey: 'models.rail.ipAdapter', types: ['ip_adapter', 'clip_vision'] },
  { id: 'vae', labelKey: 'models.rail.vae', types: ['vae'] },
  { id: 'upscale', labelKey: 'models.rail.upscale', types: ['spandrel_image_to_image'] },
  { id: 'encoders', labelKey: 'models.rail.encoders', types: ['t5_encoder', 'clip_embed', 'text_encoder'] },
  { id: 'diffusion', labelKey: 'models.rail.diffusion', types: ['diffusion_model'] },
];

export function matchesCategory(type: ModelType, id: CategoryId): boolean {
  const c = CATEGORIES.find((x) => x.id === id);
  return c ? c.types.includes(type) : true;
}

export type CoverKind = 'picture' | 'icon';

/** Main models, diffusion models (Anima, Flux, Wan... kept as a diffusion model alone), LoRA and adapters show a picture,
 * the rest an icon. Every cover has the same shape. */
export function coverKind(type: ModelType): CoverKind {
  if (type === 'main' || type === 'diffusion_model' || type === 'lora' || type === 'controlnet' || type === 't2i_adapter' || type === 'ip_adapter') return 'picture';
  return 'icon';
}
