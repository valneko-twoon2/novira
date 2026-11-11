// "Finish with AI": which model paints, the denoise of a strength and the request that is queued.
import { describe, expect, it } from 'vitest';
import type { BaseModel, ModelConfig, ModelType } from '@/backend';
import { buildRichRequest, richDenoise, richPlan, richPrompts } from './richRequest';

function model(key: string, base: BaseModel, type: ModelType = 'main', name = key): ModelConfig {
  return { key, name, base, type, format: 'checkpoint', description: '', path: `${name}.safetensors`, size: 1, source: '' };
}

const sdxl = model('wai', 'sdxl', 'main', 'waiIllustrious');
const anima = model('anima', 'anima', 'diffusion_model', 'nyanya');
const sd1 = model('sd1', 'sd-1', 'main', 'dream');
const lineXl = model('cn-xl', 'sdxl', 'controlnet', 'xinsir-union-promax');
const lineSd1 = model('cn-sd1', 'sd-1', 'controlnet', 'control_v11p_sd15_lineart');
const depthOnly = model('cn-depth', 'sdxl', 'controlnet', 'depth-sdxl');

describe('richPlan', () => {
  it('takes the chosen model with its line ControlNet', { tags: ['condition'] }, () => {
    const plan = richPlan([sdxl, lineXl, sd1], 'wai', null);
    expect(plan.model?.key).toBe('wai');
    expect(plan.control?.key).toBe('cn-xl');
  });

  it('takes the chosen model even when it has no ControlNet', { tags: ['condition'] }, () => {
    const plan = richPlan([sdxl, lineXl, anima], 'anima', 'wai');
    expect(plan.model?.key).toBe('anima');
    expect(plan.control).toBeNull();
  });

  it('auto: the Generate tab model when a line ControlNet exists for its family', { tags: ['decision-table'] }, () => {
    const plan = richPlan([sd1, sdxl, lineXl, lineSd1], null, 'sd1');
    expect(plan.model?.key).toBe('sd1');
    expect(plan.control?.key).toBe('cn-sd1');
  });

  it('auto: otherwise another model that has one, SDXL first', { tags: ['decision-table'] }, () => {
    const plan = richPlan([anima, sd1, sdxl, lineXl, lineSd1], null, 'anima');
    expect(plan.model?.key).toBe('wai');
    expect(plan.control?.key).toBe('cn-xl');
  });

  it('auto: otherwise the Generate tab model with no ControlNet', { tags: ['decision-table'] }, () => {
    const plan = richPlan([anima, sdxl, depthOnly], null, 'anima');
    expect(plan.model?.key).toBe('anima');
    expect(plan.control).toBeNull();
  });

  it('falls back to the first drawable model, and to none when nothing draws', { tags: ['decision-table'] }, () => {
    expect(richPlan([anima, sdxl], null, 'gone').model?.key).toBe('anima');
    expect(richPlan([lineXl], null, null)).toEqual({ model: null, control: null });
    expect(richPlan([], null, null)).toEqual({ model: null, control: null });
  });

  it('ignores a chosen key that is no longer installed', { tags: ['error-guessing'] }, () => {
    expect(richPlan([sdxl, lineXl], 'removed', null).model?.key).toBe('wai');
  });
});

describe('richDenoise', () => {
  it('maps 0..100 onto the plan range and clamps', { tags: ['boundary'] }, () => {
    expect(richDenoise(0, true)).toBeCloseTo(0.6);
    expect(richDenoise(50, true)).toBeCloseTo(0.8);
    expect(richDenoise(100, true)).toBeCloseTo(1);
    expect(richDenoise(0, false)).toBeCloseTo(0.35);
    expect(richDenoise(50, false)).toBeCloseTo(0.45);
    expect(richDenoise(100, false)).toBeCloseTo(0.55);
    expect(richDenoise(-20, true)).toBeCloseTo(0.6);
    expect(richDenoise(400, false)).toBeCloseTo(0.55);
  });
});

describe('richPrompts', () => {
  it('puts the quality words in front for a tag model, then the user words', { tags: ['decision-table'] }, () => {
    const { positive, negative } = richPrompts(sdxl, 'dragon scales, , sparkles');
    expect(positive.startsWith('masterpiece')).toBe(true);
    expect(positive.endsWith('dragon scales, sparkles')).toBe(true);
    expect(negative).toContain('photo frame');
    expect(negative).toContain('mirror image');
  });

  it('does not repeat a negative word the family already has', { tags: ['decision-table'] }, () => {
    const words = richPrompts(sdxl, '').negative.split(', ');
    expect(new Set(words.map((w) => w.toLowerCase())).size).toBe(words.length);
  });

  it('puts the quality words after the description for a model that reads sentences', { tags: ['decision-table'] }, () => {
    const flux = model('flux', 'flux', 'main', 'flux-dev');
    const { positive } = richPrompts(flux, 'blue');
    expect(positive.startsWith('blue')).toBe(true);
    expect(positive.indexOf('blue')).toBeLessThan(positive.length - 1);
  });

  it('gives no negative to a family that reads none', { tags: ['decision-table'] }, () => {
    const flux = model('flux', 'flux', 'main', 'flux-dev');
    expect(richPrompts(flux, '', 'blurry').negative).toBe('');
  });

  it('adds the user\'s negative words, each once', { tags: ['decision-table'] }, () => {
    const words = richPrompts(sdxl, '', 'blurry, text').negative.split(', ');
    expect(words).toContain('blurry');
    expect(words.filter((w) => w === 'text')).toHaveLength(1);
  });

  it('works with no words', { tags: ['boundary'] }, () => {
    expect(richPrompts(sdxl, '').positive.length).toBeGreaterThan(0);
  });
});

describe('buildRichRequest', () => {
  const base = { model: sdxl, words: '', negative: '', iterations: 3, prepend: true, strength: 50, seed: 7, sourceUrl: 'img://base', lineUrl: 'img://line', width: 1024, height: 576 };

  it('queues an image-to-image run kept as an intermediate, with the line ControlNet', { tags: ['decision-table'] }, () => {
    const r = buildRichRequest({ ...base, control: lineXl });
    expect(r.origin).toBe('generate');
    expect(r.destination).toBe('intermediate');
    expect(r.iterations).toBe(3);
    expect(r.prepend).toBe(true);
    expect(r.randomizeSeed).toBe(false);
    expect(r.initImageUrl).toBe('img://base');
    expect(r.params.generationMode).toBe('img2img');
    expect(r.params.strength).toBeCloseTo(0.8);
    expect(r.params.width).toBe(1024);
    expect(r.params.height).toBe(576);
    expect(r.params.loras).toEqual([]);
    expect(r.params.vaeKey).toBeNull();
    expect(r.params.controlLayerCount).toBe(1);
    expect(r.controlLayers).toEqual([{ imageUrl: 'img://line', modelKey: 'cn-xl', weight: 1, beginEnd: [0, 1], controlMode: 'balanced', controlType: 'lineart' }]);
  });

  it('with no ControlNet it stays gentle and has no control layer', { tags: ['decision-table'] }, () => {
    const r = buildRichRequest({ ...base, control: null, lineUrl: null });
    expect(r.params.strength).toBeCloseTo(0.45);
    expect(r.params.controlLayerCount).toBeUndefined();
    expect(r.controlLayers).toBeUndefined();
  });

  it('takes steps, CFG and scheduler from the model profile', { tags: ['decision-table'] }, () => {
    const r = buildRichRequest({ ...base, control: null, lineUrl: null });
    expect(r.params.steps).toBeGreaterThan(0);
    expect(r.params.cfgScale).toBeGreaterThan(0);
    expect(r.params.modelKey).toBe('wai');
  });
});
