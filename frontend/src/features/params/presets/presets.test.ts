// Tests for image-generation presets, prompt presets, the prompt book store and tag helpers.
import { beforeEach, describe, expect, it } from 'vitest';
import { applyPresetData, snapshotPresetData, useImagePresets } from '@/state/presets/imagePresets';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { usePromptBook } from '@/state/prompts/promptBook';
import { addTag, hasTag, removeTag, withTagsFirst } from '@/state/prompts/promptTags';
import { summarizeImagePreset } from './GenerationPresetBar';

describe('generation presets', () => {
  beforeEach(() => useParams.setState({ steps: 30, cfgScale: 7, seed: 5, iterations: 3, positivePrompt: 'cat' }));

  it('snapshots settings but never the seed or iterations', () => {
    const data = snapshotPresetData();
    expect(data).toMatchObject({ steps: 30, positivePrompt: 'cat' });
    expect(data).not.toHaveProperty('seed');
    expect(data).not.toHaveProperty('iterations');
  });

  it('saves, applies, renames and deletes', () => {
    const id = useImagePresets.getState().add('mine', snapshotPresetData());
    useParams.setState({ steps: 10, positivePrompt: '' });
    applyPresetData(useImagePresets.getState().presets.find((p) => p.id === id)!.data);
    expect(useParams.getState()).toMatchObject({ steps: 30, positivePrompt: 'cat', seed: 5 });
    useImagePresets.getState().rename(id, 'renamed');
    expect(useImagePresets.getState().presets.find((p) => p.id === id)?.name).toBe('renamed');
    useImagePresets.getState().remove(id);
    expect(useImagePresets.getState().selectedId).toBeNull();
  });

  it('does not apply a model that is no longer installed', () => {
    useModels.setState({ models: [] });
    useParams.setState({ modelKey: 'kept' });
    applyPresetData({ modelKey: 'gone', steps: 12 });
    expect(useParams.getState()).toMatchObject({ modelKey: 'kept', steps: 12 });
  });

  it('keeps the high-resolution fix, the upscale and the inpaint settings, but not the picture to upscale', () => {
    useModels.setState({ models: [{ key: 'esrgan', name: '4x', base: 'any', type: 'spandrel_image_to_image', path: '4x.pth' }] as never });
    const p = useParams.getState();
    const picture = { name: 'big.png' } as never;
    useParams.setState({
      hires: { ...p.hires, enabled: true, scale: 2, upscaleModelKey: 'esrgan' },
      upscale: { ...p.upscale, initialImage: picture, scale: 4, creativity: 3, upscaleModelKey: 'esrgan' },
      maskBlur: 24,
      infillMethod: 'tile',
      dynamicPromptMode: 'random',
    });
    const data = snapshotPresetData();
    expect(data.upscale).not.toHaveProperty('initialImage');
    const other = { name: 'other.png' } as never;
    useParams.setState({ hires: { ...p.hires, enabled: false }, upscale: { ...p.upscale, initialImage: other, scale: 2 }, maskBlur: 4, infillMethod: 'color', dynamicPromptMode: 'combinatorial' });
    applyPresetData(data);
    const now = useParams.getState();
    expect(now.hires).toMatchObject({ enabled: true, scale: 2, upscaleModelKey: 'esrgan' });
    expect(now.upscale).toMatchObject({ initialImage: other, scale: 4, creativity: 3, upscaleModelKey: 'esrgan' });
    expect(now).toMatchObject({ maskBlur: 24, infillMethod: 'tile', dynamicPromptMode: 'random' });
  });

  it('keeps the current upscale models when the preset names removed ones', () => {
    useModels.setState({ models: [] });
    const p = useParams.getState();
    useParams.setState({ hires: { ...p.hires, upscaleModelKey: 'kept' }, upscale: { ...p.upscale, upscaleModelKey: 'kept' } });
    applyPresetData({ hires: { ...p.hires, upscaleModelKey: 'gone', scale: 1.75 }, upscale: { ...p.upscale, upscaleModelKey: 'gone' } });
    expect(useParams.getState().hires).toMatchObject({ upscaleModelKey: 'kept', scale: 1.75 });
    expect(useParams.getState().upscale.upscaleModelKey).toBe('kept');
  });

  it('ships built-in presets and summarises size and steps', () => {
    const builtin = useImagePresets.getState().presets.find((p) => p.id === 'seed-standard');
    expect(builtin?.builtin).toBe(true);
    expect(summarizeImagePreset(builtin!.data)).toBe('1024×1024 · 30 ステップ');
  });
});

describe('prompt book', () => {
  it('registers, updates and removes entries', () => {
    const id = usePromptBook.getState().add({ tag: 'x', meaning: '', category: '', note: '' });
    usePromptBook.getState().update(id, { tag: 'y', meaning: 'm', category: 'c', note: '' });
    expect(usePromptBook.getState().entries.find((e) => e.id === id)?.tag).toBe('y');
    usePromptBook.getState().remove(id);
    expect(usePromptBook.getState().entries.some((e) => e.id === id)).toBe(false);
  });

  it('adds and removes tags in a comma separated prompt', () => {
    expect(addTag('a, b', 'c')).toBe('a, b, c');
    expect(addTag('a, b', 'B')).toBe('a, b');
    expect(hasTag('a, Blue sky', 'blue sky')).toBe(true);
    expect(removeTag('a, b, c', 'b')).toBe('a, c');
    expect(withTagsFirst('x, masterpiece', 'masterpiece, best quality')).toBe('best quality, x, masterpiece');
  });
});
