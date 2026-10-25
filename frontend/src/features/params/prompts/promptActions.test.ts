// The recommended prompts written into the two prompts: always something in the positive, nothing twice.
import { beforeEach, describe, expect, it } from 'vitest';
import type { BaseModel, ModelConfig } from '@/backend';
import { useParams } from '@/state/params';
import { applyRecommendedPrompts } from './promptActions';

const model = (base: BaseModel, name = 'model'): ModelConfig => ({
  key: 'k',
  name,
  base,
  type: 'main',
  format: 'checkpoint',
  description: '',
  path: '',
  size: 0,
  source: '',
});

const prompts = () => {
  const s = useParams.getState();
  return { positive: s.positivePrompt, negative: s.negativePrompt };
};

describe('apply recommended prompts', () => {
  beforeEach(() => useParams.getState().set({ positivePrompt: '', negativePrompt: '' }));

  it('fills the positive for FLUX.1 too, and leaves its unused negative alone', () => {
    useParams.getState().set({ positivePrompt: 'a cat on a sofa', negativePrompt: 'dog' });
    applyRecommendedPrompts(model('flux'));
    expect(prompts()).toEqual({ positive: 'a cat on a sofa, high quality, highly detailed, sharp focus', negative: 'dog' });
  });

  it('fills both prompts without a model', () => {
    applyRecommendedPrompts(undefined);
    const { positive, negative } = prompts();
    expect(positive).toContain('best quality');
    expect(negative).toContain('worst quality');
  });

  it('puts tag-model quality words in front, once, however often it is pressed', () => {
    useParams.getState().set({ positivePrompt: '1girl, best quality', negativePrompt: 'blurry' });
    const anima = model('anima', 'NyaNya Harem Anima 2.9B');
    applyRecommendedPrompts(anima);
    applyRecommendedPrompts(anima);
    const { positive, negative } = prompts();
    expect(positive).toBe('masterpiece, score_7, 1girl, best quality');
    expect(negative.split(', ').filter((w) => w === 'blurry')).toHaveLength(1);
    expect(negative).toMatch(/^blurry, worst quality/);
  });
});
