// @vitest-environment jsdom
// Using a saved character: its picture becomes one reference image, its words go in front of the prompt, and neither
// is added twice. The reference model starts as the plain IP-Adapter, not the face one.
import { beforeEach, describe, expect, it } from 'vitest';
import type { ImageDTO, ModelConfig } from '@/backend';
import { useCharacters } from '@/state/characters';
import { useGallery } from '@/state/gallery';
import { defaultRefModelKey, useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { useToasts } from '@/state/toasts';
import { applyCharacter } from './applyCharacter';

const adapter = (key: string, name: string): ModelConfig => ({ key, name, base: 'sdxl', type: 'ip_adapter', format: 'checkpoint', description: '', path: '', size: 0, source: '' });
const main: ModelConfig = { ...adapter('main-xl', 'main-xl'), type: 'main' };
const picture = { name: 'girl.png', url: 'blob:girl', thumbnailUrl: 'blob:girl', width: 8, height: 8, mediaType: 'image', category: 'general' } as unknown as ImageDTO;

describe('applying a character', () => {
  beforeEach(() => {
    useModels.getState().setModels([main, adapter('face', 'ip-adapter-plus-face_sdxl_vit-h'), adapter('plain', 'ip-adapter_sdxl_vit-h')]);
    useGallery.getState().setImages([picture]);
    useParams.setState({ modelKey: 'main-xl', refImages: [], positivePrompt: 'sitting in a cafe', cfgScale: 7 });
    useCharacters.setState({ presets: [], selectedId: null });
    useToasts.setState({ toasts: [] });
  });

  it('chooses the plain adapter before a face adapter', () => {
    expect(defaultRefModelKey('main-xl')).toBe('plain');
    useModels.getState().setModels([main, adapter('face', 'ip-adapter-plus-face_sdxl_vit-h')]);
    expect(defaultRefModelKey('main-xl')).toBe('face');
    useModels.getState().setModels([main]);
    expect(defaultRefModelKey('main-xl')).toBeNull();
  });

  it('adds the picture as a reference image with the saved weight and puts the words first', () => {
    const id = useCharacters.getState().add('Mia', { imageNames: ['girl.png'], weight: 0.55, tags: 'brown hair, blue skirt' });
    expect(applyCharacter(id)).toEqual({ cfgLowered: true, used: 1, capped: 0, missing: 0, lora: 'none' });
    const { refImages, positivePrompt } = useParams.getState();
    expect(refImages).toHaveLength(1);
    expect(refImages[0]).toMatchObject({ imageName: 'girl.png', imageUrl: 'blob:girl', weight: 0.55, modelKey: 'plain', isEnabled: true });
    expect(positivePrompt).toBe('brown hair, blue skirt, sitting in a cafe');
    expect(useCharacters.getState().selectedId).toBe(id);
  });

  it('does not add the picture or the words a second time, and turns a disabled reference back on', () => {
    const id = useCharacters.getState().add('Mia', { imageNames: ['girl.png'], weight: 0.5, tags: 'brown hair' });
    applyCharacter(id);
    useParams.getState().updateRefImage(useParams.getState().refImages[0]!.id, { isEnabled: false, weight: 1 });
    applyCharacter(id);
    const { refImages, positivePrompt } = useParams.getState();
    expect(refImages).toHaveLength(1);
    expect(refImages[0]).toMatchObject({ isEnabled: true, weight: 0.5 });
    expect(positivePrompt).toBe('brown hair, sitting in a cafe');
  });

  it('lowers a high CFG scale to the one references need, and leaves a low one alone', () => {
    const id = useCharacters.getState().add('Mia', { imageNames: ['girl.png'], weight: 0.6, tags: '' });
    expect(applyCharacter(id)).toMatchObject({ cfgLowered: true });
    expect(useParams.getState().cfgScale).toBe(4.5);
    useParams.setState({ cfgScale: 3 });
    expect(applyCharacter(id)).toMatchObject({ cfgLowered: false });
    expect(useParams.getState().cfgScale).toBe(3);
  });

  it('leaves the prompt alone when the character has no words', () => {
    const id = useCharacters.getState().add('Mia', { imageNames: ['girl.png'], weight: 0.6, tags: '  ' });
    applyCharacter(id);
    expect(useParams.getState().positivePrompt).toBe('sitting in a cafe');
  });

  it('changes nothing and says so when the picture was deleted, or the character is unknown', () => {
    const id = useCharacters.getState().add('Gone', { imageNames: ['deleted.png'], weight: 0.6, tags: 'x' });
    expect(applyCharacter(id)).toBeNull();
    expect(useParams.getState().refImages).toEqual([]);
    expect(useParams.getState().positivePrompt).toBe('sitting in a cafe');
    expect(useToasts.getState().toasts[0]?.status).toBe('error');
    expect(applyCharacter('nope')).toBeNull();
  });
});

describe('a character with several pictures', () => {
  const pic = (n: number) => ({ ...picture, name: `p${n}.png`, url: `blob:p${n}` }) as ImageDTO;
  beforeEach(() => {
    useModels.getState().setModels([main, adapter('plain', 'ip-adapter_sdxl_vit-h')]);
    useGallery.getState().setImages(Array.from({ length: 10 }, (_, i) => pic(i + 1)));
    useParams.setState({ modelKey: 'main-xl', refImages: [], positivePrompt: '', cfgScale: 4 });
    useCharacters.setState({ presets: [], selectedId: null });
    useToasts.setState({ toasts: [] });
  });
  const names = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}.png`);

  it('adds every picture as a reference image and shares the weight among them', () => {
    const id = useCharacters.getState().add('Mia', { imageNames: names(4), weight: 0.6, tags: '' });
    expect(applyCharacter(id)).toEqual({ cfgLowered: false, used: 4, capped: 0, missing: 0, lora: 'none' });
    const refs = useParams.getState().refImages;
    expect(refs.map((r) => r.imageName)).toEqual(names(4));
    expect(refs.every((r) => r.weight === 0.3)).toBe(true);
  });

  it('uses the first pictures when there are more than the reference images allow, and says how many were left out', () => {
    const id = useCharacters.getState().add('Mia', { imageNames: names(10), weight: 0.6, tags: '' });
    expect(applyCharacter(id)).toMatchObject({ used: 8, capped: 2 });
    expect(useParams.getState().refImages).toHaveLength(8);
  });

  it('leaves room for the reference images the character does not own', () => {
    useParams.getState().addRefImage({ imageName: 'other.png', imageUrl: 'blob:other', modelKey: 'plain' });
    const id = useCharacters.getState().add('Mia', { imageNames: names(8), weight: 0.6, tags: '' });
    expect(applyCharacter(id)).toMatchObject({ used: 7, capped: 1 });
    expect(useParams.getState().refImages).toHaveLength(8);
  });

  it('refuses when the other reference images already fill the limit', () => {
    for (let i = 0; i < 8; i++) useParams.getState().addRefImage({ imageName: `o${i}.png`, imageUrl: `blob:o${i}`, modelKey: 'plain' });
    const id = useCharacters.getState().add('Mia', { imageNames: names(2), weight: 0.6, tags: '' });
    expect(applyCharacter(id)).toBeNull();
    expect(useParams.getState().refImages).toHaveLength(8);
    expect(useToasts.getState().toasts[0]?.status).toBe('error');
  });

  it('uses the pictures that are still there and counts the ones that are gone', () => {
    const id = useCharacters.getState().add('Mia', { imageNames: ['p1.png', 'gone.png', 'p2.png'], weight: 0.6, tags: '' });
    expect(applyCharacter(id)).toMatchObject({ used: 2, missing: 1 });
    expect(useParams.getState().refImages.map((r) => r.imageName)).toEqual(['p1.png', 'p2.png']);
  });
});

describe('a character with a LoRA', () => {
  const lora: ModelConfig = { ...adapter('lora-mia', 'Mia'), type: 'lora' };
  beforeEach(() => {
    useModels.getState().setModels([main, adapter('plain', 'ip-adapter_sdxl_vit-h'), lora]);
    useGallery.getState().setImages([picture]);
    useParams.setState({ modelKey: 'main-xl', refImages: [], loras: [], positivePrompt: 'sitting in a cafe', cfgScale: 4 });
    useCharacters.setState({ presets: [], selectedId: null });
  });

  it('adds the LoRA at its weight and the trigger word in front, next to the reference pictures', () => {
    const id = useCharacters.getState().add('Mia', { imageNames: ['girl.png'], weight: 0.6, tags: 'brown hair', lora: { key: 'lora-mia', weight: 0.8, trigger: 'mia_chr', enabled: true } });
    expect(applyCharacter(id)).toMatchObject({ used: 1, lora: 'used' });
    const { loras, refImages, positivePrompt } = useParams.getState();
    expect(loras).toEqual([{ key: 'lora-mia', weight: 0.8, isEnabled: true }]);
    expect(refImages).toHaveLength(1);
    expect(positivePrompt).toBe('mia_chr, brown hair, sitting in a cafe');
    applyCharacter(id);
    expect(useParams.getState().loras).toHaveLength(1);
    expect(useParams.getState().positivePrompt).toBe('mia_chr, brown hair, sitting in a cafe');
  });

  it('leaves the LoRA out when it is switched off or no longer installed', () => {
    const off = useCharacters.getState().add('Off', { imageNames: ['girl.png'], weight: 0.6, tags: '', lora: { key: 'lora-mia', weight: 0.8, trigger: 'mia_chr', enabled: false } });
    expect(applyCharacter(off)).toMatchObject({ lora: 'off' });
    const gone = useCharacters.getState().add('Gone', { imageNames: ['girl.png'], weight: 0.6, tags: '', lora: { key: 'lora-deleted', weight: 0.8, trigger: 'gone_chr', enabled: true } });
    expect(applyCharacter(gone)).toMatchObject({ lora: 'gone' });
    expect(useParams.getState().loras).toEqual([]);
    expect(useParams.getState().positivePrompt).toBe('sitting in a cafe');
  });
});
