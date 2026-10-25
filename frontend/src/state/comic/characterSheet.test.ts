// The sheet of a character: which view a panel takes by its framing, the request that draws a view from the front picture,
// and the LoRA a panel gets through the Characters library.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ImageDTO, ModelConfig } from '@/backend';
import { useCharacters, type CharacterLora } from '@/state/characters';
import { useGallery } from '@/state/gallery';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { missingViews, referencePicture, sheetPictures, viewFor } from './characterSheet';
import { newProject, type ComicCharacter } from './document';
import { castLora, characterRefs, panelRequest, sheetRequest } from './request';
import { findPanel, useComic } from './store';

const model = (over: Partial<ModelConfig>): ModelConfig => ({ key: 'main', name: 'Main', base: 'sdxl', type: 'main', ...over }) as ModelConfig;
const IPA = model({ key: 'ipa', name: 'IP-Adapter SDXL', base: 'sdxl', type: 'ip_adapter', path: 'ip-adapter_sdxl_vit-h.safetensors' });
const LORA = model({ key: 'mina-lora', name: 'Mina LoRA', base: 'sdxl', type: 'lora' });
const picture = (name: string) => ({ name, url: `novira-image://${name}`, thumbnailUrl: `thumb://${name}` }) as ImageDTO;

const initial = { params: useParams.getState(), models: useModels.getState(), gallery: useGallery.getState(), characters: useCharacters.getState() };

const MINA: ComicCharacter = { id: 'mina', name: 'Mina', tags: '1girl', parts: { hair: 'red hair', eyes: 'green eyes', outfit: 'school uniform' }, imageName: 'front.png' };

/** A comic of one page whose first panel holds `cast` and has `prompt`; its character references are on. */
function seed(prompt: string, cast: ComicCharacter[] = [MINA]) {
  const project = newProject('Sheet');
  project.style = { positive: ',', negative: ',' };
  project.castReference = 0.4;
  project.cast = cast;
  project.pages[0]!.panels = [{ ...project.pages[0]!.panels[0]!, prompt, cast: cast.map((c) => c.id) }];
  useComic.getState().setProjects([project]);
  return findPanel(useComic.getState().projects, project.pages[0]!.panels[0]!.id)!;
}

beforeEach(() => {
  useParams.setState({ ...initial.params, modelKey: 'main', cfgScale: 7, shouldRandomizeSeed: false, seed: 1, loras: [], refImages: [] }, true);
  useModels.setState({ ...initial.models, models: [model({}), IPA, LORA] }, true);
  useGallery.setState({ ...initial.gallery, images: ['front.png', 'back.png', 'face.png', 'side.png'].map(picture) }, true);
});
afterEach(() => {
  useParams.setState(initial.params, true);
  useModels.setState(initial.models, true);
  useGallery.setState(initial.gallery, true);
  useCharacters.setState(initial.characters, true);
});

describe('the view a panel takes', () => {
  it('reads it from the prompt: from behind and close-ups by the framing, then side and three-quarter words', () => {
    expect(viewFor('1girl, from behind, walking away')).toBe('back');
    expect(viewFor('1girl, close-up, crying')).toBe('face');
    expect(viewFor('1girl, from side, running')).toBe('side');
    expect(viewFor('1girl, profile, looking at the sea')).toBe('side');
    expect(viewFor('1girl, upper body, looking to the side')).toBe('threeQuarter');
    expect(viewFor('1girl, standing, smiling')).toBe('front');
    // A close-up from the side is a close-up: the face fills the panel.
    expect(viewFor('1girl, close-up, from side')).toBe('face');
  });

  it('takes the view from the sheet, and the front when the sheet lacks it', () => {
    const mina = { ...MINA, sheet: { back: 'back.png' } };
    expect(referencePicture(mina, 'from behind')).toBe('back.png');
    expect(referencePicture(mina, 'close-up')).toBe('front.png');
    expect(referencePicture({ ...mina, imageName: null }, 'standing')).toBeNull();
  });

  it('lists the missing views in order, and the sheet pictures with the front first', () => {
    const mina = { ...MINA, sheet: { face: 'face.png', side: 'side.png' } };
    expect(missingViews(mina)).toEqual(['threeQuarter', 'back']);
    expect(sheetPictures(mina)).toEqual(['front.png', 'side.png', 'face.png']);
    expect(sheetPictures({ imageName: null })).toEqual([]);
  });
});

describe('the reference a panel is drawn with', () => {
  it('is the view of the sheet its framing needs, or the front when that picture is missing or gone', () => {
    const ref = seed('1girl, from behind, at the gate', [{ ...MINA, sheet: { back: 'back.png', face: 'gone.png' } }]);
    expect(characterRefs(ref.panel, ref.project).map((r) => r.imageUrl)).toEqual(['novira-image://back.png']);
    const close = seed('1girl, close-up', [{ ...MINA, sheet: { back: 'back.png', face: 'gone.png' } }]);
    expect(characterRefs(close.panel, close.project).map((r) => r.imageUrl)).toEqual(['novira-image://front.png']);
  });
});

describe('the request that draws a view of the sheet', () => {
  it('turns the character with the view words, from its front picture as the reference', () => {
    const back = sheetRequest(MINA, 'back')!;
    expect(back.params.positivePrompt).toMatch(/^1girl, red hair, school uniform, solo, standing, full body, from behind/);
    // A view from behind names no eyes, and keeps a face out.
    expect(back.params.positivePrompt).not.toContain('green eyes');
    expect(back.params.negativePrompt).toContain('looking at viewer');
    expect(back.refImages).toEqual([expect.objectContaining({ imageUrl: 'novira-image://front.png', modelKey: 'ipa', weight: 0.6 })]);
    expect(back.params.cfgScale).toBe(4.5);
    expect(back.params).toMatchObject({ width: 1024, height: 1024 });
    const face = sheetRequest(MINA, 'face')!;
    expect(face.params.positivePrompt).toContain('green eyes');
    expect(face.params.positivePrompt).toContain('close-up');
    expect(face.params.positivePrompt).not.toContain('school uniform');
    expect(sheetRequest({ ...MINA, nonHuman: true, tags: '1dog' }, 'side')!.params.positivePrompt).toContain('no humans');
  });

  it('draws nothing without a front picture in the gallery or words, and from the words alone without an IP-Adapter', () => {
    expect(sheetRequest({ ...MINA, imageName: null }, 'back')).toBeNull();
    expect(sheetRequest({ ...MINA, imageName: 'gone.png' }, 'back')).toBeNull();
    expect(sheetRequest({ ...MINA, tags: '', parts: undefined }, 'back')).toBeNull();
    useModels.setState({ models: [model({})] });
    expect(sheetRequest(MINA, 'back')!.refImages).toBeUndefined();
  });
});

describe('the LoRA of a character in a panel', () => {
  const lora = (over: Partial<CharacterLora> = {}): CharacterLora => ({ key: 'mina-lora', weight: 0.8, trigger: 'minachan', enabled: true, ...over });
  /** A library character holding the LoRA; returns its id. */
  const library = (l: CharacterLora | undefined, name = 'Mina') => useCharacters.getState().add(name, { imageNames: ['front.png'], weight: 0.6, tags: '1girl', ...(l ? { lora: l } : {}) });

  it('draws the panel with the LoRA of its one character and puts the trigger before its words', () => {
    const ref = seed('1girl, smiling', [{ ...MINA, libraryId: library(lora()) }]);
    useParams.setState({ loras: [{ key: 'style', weight: 0.5, isEnabled: true }] });
    const req = panelRequest(ref, false);
    expect(req.params.loras).toEqual([
      { key: 'style', weight: 0.5, isEnabled: true },
      { key: 'mina-lora', weight: 0.8, isEnabled: true },
    ]);
    expect(req.params.positivePrompt).toMatch(/^minachan, 1girl/);
  });

  it('uses none when it is off, gone, of another model family, or when two characters of the panel have one', () => {
    expect(castLora(seed('x', [{ ...MINA, libraryId: library(lora({ enabled: false })) }]).panel, useComic.getState().projects[0]!)).toBeNull();
    expect(castLora(seed('x', [{ ...MINA, libraryId: library(lora({ key: 'gone' })) }]).panel, useComic.getState().projects[0]!)).toBeNull();
    useModels.setState({ models: [model({}), IPA, { ...LORA, base: 'sd-1' }] });
    expect(castLora(seed('x', [{ ...MINA, libraryId: library(lora()) }]).panel, useComic.getState().projects[0]!)).toBeNull();
    useModels.setState({ models: [model({}), IPA, LORA] });
    const two = seed('x', [
      { ...MINA, libraryId: library(lora()) },
      { ...MINA, id: 'jin', name: 'Jin', libraryId: library(lora(), 'Jin') },
    ]);
    expect(castLora(two.panel, two.project)).toBeNull();
    expect(panelRequest(two, false).params.loras).toEqual([]);
    // A character without a library link, or linked to one that is gone, has none.
    expect(castLora(seed('x', [{ ...MINA, libraryId: 'deleted' }]).panel, useComic.getState().projects[0]!)).toBeNull();
  });
});

describe('a model that takes pictures in itself (FLUX.2)', () => {
  const FLUX2 = model({ key: 'flux2', name: 'FLUX.2 klein', base: 'flux2' });

  it('gets the characters\' pictures directly, by framing, and no IP-Adapter reference or lowered guidance', () => {
    useModels.setState({ models: [FLUX2, IPA] });
    useParams.setState({ modelKey: 'flux2', cfgScale: 7 });
    const ref = seed('1girl, from behind', [{ ...MINA, sheet: { back: 'back.png' } }]);
    const req = panelRequest(ref, false);
    expect(req.referencePictures).toEqual(['novira-image://back.png']);
    expect(req.refImages).toBeUndefined();
    expect(req.params.cfgScale).toBe(7);
    const view = sheetRequest(MINA, 'side')!;
    expect(view.referencePictures).toEqual(['novira-image://front.png']);
    expect(view.refImages).toBeUndefined();
  });

  it('gives at most four, and none for a panel without characters', () => {
    useModels.setState({ models: [FLUX2] });
    useParams.setState({ modelKey: 'flux2' });
    const cast = Array.from({ length: 6 }, (_, i) => ({ ...MINA, id: `c${i}`, name: `C${i}` }));
    expect(panelRequest(seed('a crowd', cast), false).referencePictures).toHaveLength(4);
    expect(panelRequest(seed('a street', []), false).referencePictures).toBeUndefined();
  });
});
