// @vitest-environment jsdom
// The Generate form is kept across starts: what is saved comes back, and what storage holds is read field by field.
import { afterEach, describe, expect, it } from 'vitest';
import { newProject } from './comic/document';
import { startComicPromptSync } from './comic/promptSync';
import { useComic } from './comic/store';
import { restoreParams, useParams } from './params';
import { useUi } from './ui';

const initial = useParams.getState();
const saved = () => JSON.parse(localStorage.getItem('novira.params') ?? 'null') as { state: Record<string, unknown> } | null;

afterEach(() => {
  localStorage.clear();
  useParams.setState(initial, true);
  useUi.getState().setTab('generate');
});

describe('the Generate form across starts', () => {
  it('comes back as it was left: prompts, model, settings, LoRAs and reference images', async () => {
    const p = useParams.getState();
    p.set({ positivePrompt: 'a cat', negativePrompt: 'blurry', modelKey: 'm1', steps: 12, shouldRandomizeSeed: false, seed: 42 });
    p.addLora('l1');
    const ref = p.addRefImage({ imageUrl: 'novira-image://a.png', modelKey: 'ip' });
    p.setHires({ enabled: true, strength: 0.6 });
    p.setUpscale({ scale: 2 });
    // A new start: the store opens at its defaults and reads what storage kept.
    const kept = localStorage.getItem('novira.params')!;
    useParams.setState(initial, true);
    localStorage.setItem('novira.params', kept);
    await useParams.persist.rehydrate();
    const s = useParams.getState();
    expect(s).toMatchObject({ positivePrompt: 'a cat', negativePrompt: 'blurry', modelKey: 'm1', steps: 12, shouldRandomizeSeed: false, seed: 42 });
    expect(s.loras).toEqual([{ key: 'l1', weight: 0.75, isEnabled: true }]);
    expect(s.refImages.map((r) => [r.id, r.imageUrl, r.modelKey])).toEqual([[ref, 'novira-image://a.png', 'ip']]);
    expect(s.hires).toMatchObject({ enabled: true, strength: 0.6 });
    expect(s.upscale.scale).toBe(2);
    expect(typeof s.set).toBe('function');
  });

  it('gives a new reference image an id no restored one has', async () => {
    localStorage.setItem('novira.params', JSON.stringify({ state: { refImages: [{ id: 'ref-40' }] }, version: 1 }));
    await useParams.persist.rehydrate();
    const id = useParams.getState().addRefImage();
    expect(useParams.getState().refImages.map((r) => r.id)).toEqual(['ref-40', id]);
    expect(id).not.toBe('ref-40');
  });

  it('saves the Generate tab prompts, not the comic panel shown in the boxes, while the comic screen is open', () => {
    const project = newProject('P');
    project.pages[0]!.panels[0] = { ...project.pages[0]!.panels[0]!, prompt: 'panel prompt', negativePrompt: 'panel negative' };
    useComic.getState().setProjects([project]);
    useParams.getState().set({ positivePrompt: 'generate text', negativePrompt: 'generate negative' });
    const stop = startComicPromptSync();
    try {
      useUi.getState().setTab('comic');
      expect(useParams.getState().positivePrompt).toBe('panel prompt');
      useParams.getState().set({ steps: 9 });
      expect(saved()?.state).toMatchObject({ positivePrompt: 'generate text', negativePrompt: 'generate negative', steps: 9 });
      useUi.getState().setTab('generate');
      useParams.getState().set({ positivePrompt: 'typed later' });
      expect(saved()?.state.positivePrompt).toBe('typed later');
    } finally {
      stop();
    }
  });
});

describe('restoreParams', () => {
  it('takes only the fields of the right kind and leaves the rest at the defaults', () => {
    const s = restoreParams(
      {
        steps: 'many',
        cfgScale: 5,
        width: null,
        modelKey: 3,
        vaeKey: 'vae',
        seed: Number.NaN,
        loras: [{ key: 'a', weight: 0.5, isEnabled: false }, { weight: 1 }, 'b'],
        refImages: 'x',
        hires: { enabled: true, scale: 'big' },
        upscale: { initialImage: { name: 'a.png' }, scale: 8 },
        unknown: 1,
      },
      initial,
    );
    expect(s).toMatchObject({ steps: initial.steps, cfgScale: 5, width: initial.width, modelKey: initial.modelKey, vaeKey: 'vae', seed: initial.seed });
    expect(s.loras).toEqual([{ key: 'a', weight: 0.5, isEnabled: false }]);
    expect(s.refImages).toEqual([]);
    expect(s.hires).toEqual({ ...initial.hires, enabled: true });
    expect(s.upscale).toEqual({ ...initial.upscale, scale: 8 });
    expect('unknown' in s).toBe(false);
  });

  it('keeps the picture to draw over only when it names an image and its address', () => {
    const image = { name: 'a.png', url: 'u/full/a.png', thumbnailUrl: 't', width: 512, height: 768 };
    expect(restoreParams({ initImage: image }, initial).initImage).toEqual(image);
    expect(restoreParams({ initImage: { name: 'a.png' } }, initial).initImage).toBeNull();
    expect(restoreParams({ initImage: 'a.png' }, initial).initImage).toBeNull();
  });

  it('ignores the manga finish an older version stored with the form', () => {
    const s = restoreParams({ cfgScale: 5, manga: { enabled: true, screenLines: 240 } }, initial);
    expect(s.cfgScale).toBe(5);
    expect('manga' in s).toBe(false);
  });

  it('numbers a new reference image after the restored ones, so no two share an id', () => {
    const s = restoreParams({ refImages: [{ id: 'ref-900' }] }, initial);
    useParams.setState(s, true);
    expect(useParams.getState().addRefImage({})).toBe('ref-901');
  });

  it('keeps the defaults for something that is not a saved form', () => {
    expect(restoreParams(null, initial)).toBe(initial);
    expect(restoreParams([1], initial)).toBe(initial);
  });
});
