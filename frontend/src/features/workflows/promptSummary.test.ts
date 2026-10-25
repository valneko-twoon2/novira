import { describe, expect, it } from 'vitest';
import type { ComfyPromptNode } from '@/backend';
import { summarizePrompt } from './promptSummary';

const node = (class_type: string, inputs: Record<string, unknown>): ComfyPromptNode => ({ class_type, inputs });

describe('what a prompt of ComfyUI nodes tells the gallery', () => {
  it('reads the first sampler, the text behind its conditioning, the model it loads and the size of its latent', () => {
    const s = summarizePrompt({
      unet: node('UNETLoader', { unet_name: 'wan.safetensors' }),
      pos: node('CLIPTextEncode', { text: 'a puppy' }),
      neg: node('CLIPTextEncode', { text: 'blurry' }),
      latent: node('Wan22ImageToVideoLatent', { width: 832, height: 480, length: 49 }),
      ks: node('KSampler', { seed: 7, steps: 20, cfg: 5, positive: ['pos', 0], negative: ['neg', 0], latent_image: ['latent', 0] }),
      video: node('CreateVideo', { fps: 24 }),
    });
    expect(s).toEqual({ positive: 'a puppy', negative: 'blurry', model: 'wan.safetensors', seed: 7, steps: 20, cfg: 5, width: 832, height: 480, length: 49, fps: 24 });
  });

  it('follows conditioning through the nodes that only pass it on, and finds the tags of a song', () => {
    const s = summarizePrompt({
      song: node('TextEncodeAceStepAudio1.5', { tags: 'city pop', lyrics: 'la la', seconds: undefined }),
      zero: node('ConditioningZeroOut', { conditioning: ['song', 0] }),
      latent: node('EmptyAceStep1.5LatentAudio', { seconds: 60 }),
      ks: node('KSampler', { steps: 8, positive: ['song', 0], negative: ['zero', 0], latent_image: ['latent', 0] }),
    });
    expect(s).toMatchObject({ positive: 'city pop', negative: 'city pop', length: 60, steps: 8 });
    expect(s.width).toBeUndefined();
  });

  it('leaves out what it cannot read: a seed the backend fills in, a checkpoint the library names, links that lead nowhere or in circles', () => {
    const s = summarizePrompt({
      ckpt: node('CheckpointLoaderSimple', { ckpt_name: { $model: 'key' } }),
      a: node('ConditioningZeroOut', { conditioning: ['b', 0] }),
      b: node('ConditioningZeroOut', { conditioning: ['a', 0] }),
      ks: node('KSampler', { seed: { $seed: true }, positive: ['a', 0], negative: ['missing', 0], latent_image: ['gone', 0] }),
    });
    expect(s).toEqual({ positive: '', negative: '', model: '', seed: undefined, steps: undefined, cfg: undefined, fps: undefined });
  });

  it('is empty for a prompt with no sampler', () => {
    expect(summarizePrompt({ save: node('SaveImage', {}) })).toMatchObject({ positive: '', negative: '', model: '' });
  });
});
