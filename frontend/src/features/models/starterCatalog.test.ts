// How the Starter Models tab sorts its entries by purpose and family.
import { describe, expect, it } from 'vitest';
import type { StarterModel } from '@/backend';
import { familiesIn, familiesOf, filterEntries, purposeOf, starterEntries, STARTER_PURPOSES } from './starterCatalog';

const s = (id: string, base: StarterModel['base'], type: StarterModel['type'], name = id, dependencies?: string[]): StarterModel => ({
  id,
  name,
  base,
  type,
  description: '',
  source: id,
  ...(dependencies ? { dependencies } : {}),
});

describe('purposeOf', () => {
  it('tells pictures, edit models and video apart among the models that draw', () => {
    expect(purposeOf(s('a', 'anima', 'diffusion_model'))).toBe('picture');
    expect(purposeOf(s('x', 'sdxl', 'main'))).toBe('picture');
    expect(purposeOf(s('k', 'flux', 'diffusion_model', 'FLUX.1 Kontext dev (fp8)'))).toBe('edit');
    expect(purposeOf(s('f', 'flux', 'diffusion_model', 'FLUX.1 dev'))).toBe('picture');
    expect(purposeOf(s('q', 'qwen-image', 'diffusion_model', 'Qwen-Image-Edit 2509 (fp8)'))).toBe('edit');
    expect(purposeOf(s('w', 'wan', 'diffusion_model'))).toBe('video');
    expect(purposeOf(s('l', 'ltx2', 'main'))).toBe('video');
  });

  it('puts the helpers by what they do', () => {
    expect(purposeOf(s('u', 'any', 'spandrel_image_to_image'))).toBe('upscale');
    expect(purposeOf(s('c', 'sdxl', 'controlnet'))).toBe('control');
    expect(purposeOf(s('p', 'anima', 'model_patch'))).toBe('control');
    expect(purposeOf(s('i', 'sdxl', 'ip_adapter'))).toBe('reference');
    for (const type of ['vae', 'text_encoder', 'clip_vision'] as const) expect(purposeOf(s('v', 'any', type))).toBe('parts');
  });
});

describe('familiesOf', () => {
  const all = [
    s('anima', 'anima', 'diffusion_model', 'Anima', ['qwen3']),
    s('zimage', 'z-image', 'diffusion_model', 'Z-Image', ['qwen3']),
    s('qwen3', 'any', 'text_encoder'),
    s('ipa', 'sdxl', 'ip_adapter', 'IP-Adapter', ['vith']),
    s('vith', 'any', 'clip_vision'),
    s('up', 'any', 'spandrel_image_to_image'),
  ];

  it('gives a shared part the families of the models that need it, through a part of a part too', () => {
    expect(familiesOf(all[0]!, all)).toEqual(['anima']);
    expect(familiesOf(all[2]!, all)).toEqual(['z-image', 'anima']);
    expect(familiesOf(all[4]!, all)).toEqual(['sdxl']);
    expect(familiesOf(all[5]!, all)).toEqual([]);
  });

  it('lists the families present, and filters by purpose and family in the order of the purposes', () => {
    const entries = starterEntries(all);
    expect(familiesIn(entries)).toEqual(['z-image', 'anima', 'sdxl', 'wan']);
    const shown = filterEntries(entries, null, 'anima');
    expect(shown.map((e) => (e.kind === 'model' ? e.model.id : e.pack))).toEqual(['anima', 'qwen3']);
    const purposes = filterEntries(entries, null, null).map((e) => STARTER_PURPOSES.indexOf(e.purpose));
    expect(purposes).toEqual([...purposes].sort((a, b) => a - b));
    expect(filterEntries(entries, 'logo', null).map((e) => e.kind === 'pack' && e.pack)).toEqual(['logo']);
    expect(filterEntries(entries, 'video', 'wan').map((e) => e.kind === 'pack' && e.pack)).toEqual(['video', 'turbo']);
  });
});
