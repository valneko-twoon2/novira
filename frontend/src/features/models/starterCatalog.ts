// How the Starter Models tab sorts what it offers: by what it is for (making pictures, video, a logo, upscaling...) and by
// the family it belongs to (Anima, SDXL, Wan...). The starter models come from the backend; the media packs (video,
// music, voice, logo...) are downloaded by their own mechanism and listed here beside them.
import type { BaseModel, PackKind, StarterModel } from '@/backend';
import type { MessageKey } from '@/i18n';
import { BASE_ORDER, VIDEO_BASES } from '@/state/models';

export const STARTER_PURPOSES = ['picture', 'edit', 'video', 'logo', 'music', 'voice', 'erase', 'upscale', 'control', 'reference', 'parts'] as const;
export type StarterPurpose = (typeof STARTER_PURPOSES)[number];

export const PURPOSE_KEYS: Record<StarterPurpose, MessageKey> = {
  picture: 'models.starter.purpose.picture',
  edit: 'models.starter.purpose.edit',
  video: 'models.starter.purpose.video',
  logo: 'models.starter.purpose.logo',
  music: 'models.starter.purpose.music',
  voice: 'models.starter.purpose.voice',
  erase: 'models.starter.purpose.erase',
  upscale: 'models.starter.purpose.upscale',
  control: 'models.starter.purpose.control',
  reference: 'models.starter.purpose.reference',
  parts: 'models.starter.purpose.parts',
};

/** One thing the tab offers: a starter model, or a media pack. */
export type StarterEntry =
  | { kind: 'model'; model: StarterModel; purpose: StarterPurpose; families: BaseModel[] }
  | { kind: 'pack'; pack: PackKind; purpose: StarterPurpose; families: BaseModel[] };

/** What each pack is for and the family of the model it brings, if it has one the Generate tab knows. */
const PACKS: Record<PackKind, { purpose: StarterPurpose; families: BaseModel[] }> = {
  video: { purpose: 'video', families: ['wan'] },
  turbo: { purpose: 'video', families: ['wan'] },
  logo: { purpose: 'logo', families: ['z-image'] },
  music: { purpose: 'music', families: [] },
  voice: { purpose: 'voice', families: [] },
  inpaint: { purpose: 'erase', families: [] },
};
export const PACK_KINDS = Object.keys(PACKS) as PackKind[];

/** The edit models only change a source picture (Flux Kontext and Fill, Qwen-Image-Edit), told apart by name as the backend does. */
function isEditModel(s: StarterModel): boolean {
  const name = s.name.toLowerCase();
  return (s.base === 'flux' && (name.includes('kontext') || name.includes('fill'))) || (s.base === 'qwen-image' && name.includes('edit'));
}

export function purposeOf(s: StarterModel): StarterPurpose {
  switch (s.type) {
    case 'spandrel_image_to_image':
      return 'upscale';
    case 'controlnet':
    case 't2i_adapter':
    case 'model_patch':
      return 'control';
    case 'ip_adapter':
      return 'reference';
    case 'vae':
    case 'text_encoder':
    case 't5_encoder':
    case 'clip_embed':
    case 'clip_vision':
      return 'parts';
    case 'main':
    case 'diffusion_model':
    case 'lora':
      if (VIDEO_BASES.has(s.base)) return 'video';
      return isEditModel(s) ? 'edit' : 'picture';
  }
}

/**
 * The families a starter model belongs to: its own base, or, for a shared part (`any`: an encoder, a VAE), the bases of
 * the models that need it. A part no model needs, such as an upscaler, belongs to none.
 */
export function familiesOf(s: StarterModel, all: StarterModel[]): BaseModel[] {
  if (s.base !== 'any') return [s.base];
  const users = new Set(all.filter((m) => m.dependencies?.includes(s.id)).map((m) => m.base));
  // A part of a part (the CLIP vision model of an IP-Adapter) belongs to the families of that part.
  for (const m of all) if (m.base === 'any' && m.dependencies?.includes(s.id)) for (const b of familiesOf(m, all)) users.add(b);
  return BASE_ORDER.filter((b) => b !== 'any' && users.has(b));
}

/** Every starter model and pack, models first in the order the backend lists them. */
export function starterEntries(models: StarterModel[]): StarterEntry[] {
  return [
    ...models.map((model): StarterEntry => ({ kind: 'model', model, purpose: purposeOf(model), families: familiesOf(model, models) })),
    ...PACK_KINDS.map((pack): StarterEntry => ({ kind: 'pack', pack, ...PACKS[pack] })),
  ];
}

/** The families that have at least one entry, in the order the model screens use. */
export function familiesIn(entries: StarterEntry[]): BaseModel[] {
  const present = new Set(entries.flatMap((e) => e.families));
  return BASE_ORDER.filter((b) => present.has(b));
}

/** The entries of a purpose and a family (`null` for every one), grouped by purpose in the order of `STARTER_PURPOSES`. */
export function filterEntries(entries: StarterEntry[], purpose: StarterPurpose | null, family: BaseModel | null): StarterEntry[] {
  return entries
    .filter((e) => (purpose === null || e.purpose === purpose) && (family === null || e.families.includes(family)))
    .sort((a, b) => STARTER_PURPOSES.indexOf(a.purpose) - STARTER_PURPOSES.indexOf(b.purpose));
}
