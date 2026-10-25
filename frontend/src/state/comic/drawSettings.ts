// The drawing settings a comic keeps for itself: the model, LoRAs, sampler, steps, size, seed, reference pictures and the
// high-resolution fix. While the comic screen is open the generation form holds the open comic's (see drawSync.ts); the
// Generate tab's own settings are put back when another screen opens. The prompts are the panel's own (see promptSync.ts).
import type { ParamsFields } from '../params';

export const DRAW_KEYS = [
  'modelKey',
  'vaeKey',
  'vaePrecision',
  'scheduler',
  'steps',
  'cfgScale',
  'cfgRescale',
  'clipSkip',
  'seed',
  'shouldRandomizeSeed',
  'width',
  'height',
  'aspectRatio',
  'aspectLocked',
  'loras',
  'refImages',
  'hires',
] as const satisfies readonly (keyof ParamsFields)[];

export type DrawKey = (typeof DRAW_KEYS)[number];
export type DrawSettings = Partial<Pick<ParamsFields, DrawKey>>;

/** The drawing settings of the form as it is now. */
export function pickDraw(form: ParamsFields): DrawSettings {
  return Object.fromEntries(DRAW_KEYS.map((k) => [k, form[k]])) as DrawSettings;
}

const kinds: Record<DrawKey, 'string?' | 'string' | 'number' | 'boolean' | 'array' | 'object'> = {
  modelKey: 'string?',
  vaeKey: 'string?',
  vaePrecision: 'string',
  scheduler: 'string',
  steps: 'number',
  cfgScale: 'number',
  cfgRescale: 'number',
  clipSkip: 'number',
  seed: 'number',
  shouldRandomizeSeed: 'boolean',
  width: 'number',
  height: 'number',
  aspectRatio: 'string',
  aspectLocked: 'boolean',
  loras: 'array',
  refImages: 'array',
  hires: 'object',
};

const fits = (kind: (typeof kinds)[DrawKey], v: unknown) =>
  kind === 'string?' ? v === null || typeof v === 'string' : kind === 'array' ? Array.isArray(v) : kind === 'object' ? typeof v === 'object' && v !== null && !Array.isArray(v) : kind === 'number' ? typeof v === 'number' && Number.isFinite(v) : typeof v === kind;

/** Saved drawing settings read back: a key of the wrong kind is dropped; null when nothing usable is left. */
export function parseDraw(v: unknown): DrawSettings | undefined {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of DRAW_KEYS) if (k in o && fits(kinds[k], o[k])) out[k] = o[k];
  return Object.keys(out).length ? (out as DrawSettings) : undefined;
}

/** Whether two sets of drawing settings are the same (compared by value, so a copy of a list is the same). */
export const sameDraw = (a: DrawSettings, b: DrawSettings) => DRAW_KEYS.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));
