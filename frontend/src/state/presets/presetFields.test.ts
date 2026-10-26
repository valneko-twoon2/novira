// What each kind of preset keeps. Every field of a form says whether a preset saves it (`true`) or why not, and the tables
// are typed over the form, so a field added to a form does not compile until it is placed (the video presets once
// forgot the installed model: a preset made with Wan came back on the standard model).
import { describe, expect, it } from 'vitest';
import type { LogoForm } from '../media/logo';
import type { MusicForm } from '../media/music';
import type { VideoForm } from '../media/video';
import type { VoiceForm } from '../media/voice';
import type { ParamsFields } from '../params';
import { PRESET_FIELDS } from './imagePresets';
import { LOGO_PRESET_FIELDS } from './logoPresets';
import { MUSIC_PRESET_FIELDS } from './musicPresets';
import { VIDEO_PRESET_FIELDS } from './videoPresets';
import { VOICE_PRESET_FIELDS } from './voicePresets';

const SEED = 'each run draws its own seed';

const IMAGE: Record<keyof ParamsFields, true | string> = {
  positivePrompt: true,
  negativePrompt: true,
  modelKey: true,
  vaeKey: true,
  vaePrecision: true,
  scheduler: true,
  steps: true,
  cfgScale: true,
  cfgRescale: true,
  clipSkip: true,
  seed: SEED,
  shouldRandomizeSeed: SEED,
  width: true,
  height: true,
  aspectRatio: true,
  aspectLocked: true,
  seamlessX: true,
  seamlessY: true,
  loras: true,
  iterations: 'how many pictures belongs to the press, not to the look',
  dynamicPromptMode: true,
  strength: true,
  initImage: 'the picture to draw over belongs to one picture, as the video source does',
  refImages: true,
  maskBlur: true,
  coherenceMode: true,
  coherenceEdgeSize: true,
  coherenceMinDenoise: true,
  infillMethod: true,
  infillTileSize: true,
  infillColor: true,
  upscale: true,
  hires: true,
};

const VIDEO: Record<keyof VideoForm, true | string> = {
  mode: true,
  model: true,
  modelKey: true,
  positivePrompt: true,
  negativePrompt: true,
  sourceImageName: 'the picture to animate belongs to the clip',
  width: true,
  height: true,
  seconds: true,
  fps: true,
  steps: true,
  cfgScale: true,
  seed: SEED,
  randomizeSeed: SEED,
  fp8: true,
  tiledDecode: true,
};

const MUSIC: Record<keyof MusicForm, true | string> = {
  tags: true,
  lyrics: 'the words belong to each song',
  instrumental: true,
  language: true,
  seconds: true,
  bpm: true,
  key: true,
  timeSignature: true,
  steps: true,
  cfgScale: true,
  seed: SEED,
  randomizeSeed: SEED,
};

const VOICE: Record<keyof VoiceForm, true | string> = {
  text: 'the words belong to each reading',
  language: true,
  mode: true,
  speaker: true,
  instruct: true,
};

const LOGO: Record<keyof LogoForm, true | string> = {
  text: 'the lettering belongs to each logo',
  style: true,
  size: true,
  count: true,
  seed: SEED,
  randomizeSeed: SEED,
};

const kept = (table: Record<string, true | string>) => Object.keys(table).filter((k) => table[k] === true).sort();

describe('what a preset keeps', () => {
  it.each([
    ['image', IMAGE, PRESET_FIELDS],
    ['video', VIDEO, VIDEO_PRESET_FIELDS],
    ['music', MUSIC, MUSIC_PRESET_FIELDS],
    ['voice', VOICE, VOICE_PRESET_FIELDS],
    ['logo', LOGO, LOGO_PRESET_FIELDS],
  ] as const)('%s: saves exactly the fields marked true', (_kind, table, fields) => {
    expect([...fields].sort()).toEqual(kept(table));
  });
});
