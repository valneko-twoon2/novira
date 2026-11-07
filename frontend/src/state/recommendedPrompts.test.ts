// The recommended prompts: every family gives quality words, tag models are told apart by name and file name.
import { describe, expect, it } from 'vitest';
import type { BaseModel, ModelConfig } from '@/backend';
import { recommendedPrompts } from './recommendedPrompts';

const model = (base: BaseModel, name = 'model', path = ''): ModelConfig => ({
  key: 'k',
  name,
  base,
  type: 'main',
  format: 'checkpoint',
  description: '',
  path,
  size: 0,
  source: '',
});

const BASES: BaseModel[] = [
  'sd-1',
  'sd-2',
  'sdxl',
  'sd-3',
  'flux',
  'flux2',
  'anima',
  'chroma',
  'qwen-image',
  'z-image',
  'hidream',
  'auraflow',
  'hunyuan-image',
  'hunyuan-dit',
  'wan',
  'hunyuan-video',
  'hunyuan-video-15',
  'ltx-video',
  'ltx2',
  'any',
];

describe('recommended prompts', () => {
  it.each(BASES)('gives quality words for %s', (base) => {
    expect(recommendedPrompts(model(base)).positive.trim()).not.toBe('');
  });

  it('gives quality words and a negative without a model', () => {
    const r = recommendedPrompts(undefined);
    expect(r.positive).toContain('best quality');
    expect(r.negative).toContain('worst quality');
  });

  it('uses the Anima card prompts for an Anima checkpoint', () => {
    const r = recommendedPrompts(model('anima', 'NyaNya Harem Anima 2.9B'));
    expect(r).toMatchObject({ place: 'first', positive: 'masterpiece, best quality, score_7' });
    expect(r.negative).toContain('score_1');
    expect(r.positive).not.toContain('safe');
  });

  it('tells the anime SDXL families apart by name or file name', () => {
    expect(recommendedPrompts(model('sdxl', 'waiIllustriousSDXL_v170')).positive).toContain('very aesthetic');
    expect(recommendedPrompts(model('sdxl', 'My model', 'C:\\m\\wai-nsfw-illustrious-v14.safetensors')).positive).toContain('amazing quality');
    expect(recommendedPrompts(model('sdxl', 'NoobAI-XL v1.1')).negative).toContain('old, early');
    expect(recommendedPrompts(model('sdxl', 'Pony Diffusion V6 XL')).positive).toMatch(/^score_9, score_8_up/);
    expect(recommendedPrompts(model('sdxl', 'Juggernaut XL')).negative).toContain('cartoon');
    expect(recommendedPrompts(model('sdxl', 'some sdxl')).positive).toBe('masterpiece, best quality, highly detailed, sharp focus');
  });

  it('puts sentence-model words after the description, and gives FLUX.1 no negative', () => {
    expect(recommendedPrompts(model('flux'))).toMatchObject({ place: 'last', negative: '' });
    expect(recommendedPrompts(model('qwen-image'))).toMatchObject({ place: 'last', positive: 'Ultra HD, 4K, cinematic composition' });
    expect(recommendedPrompts(model('chroma')).negative).toContain('restricted palette');
    expect(recommendedPrompts(model('z-image')).negative).not.toBe('');
  });
});
