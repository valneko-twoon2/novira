import { describe, expect, it } from 'vitest';
import { DEFAULT_LORA_WEIGHT, MAX_REFERENCE_IMAGES, migrateCharacters, referenceWeight, type CharacterData } from './characters';

describe('referenceWeight', () => {
  it('keeps one picture at the weight and shares it among several', () => {
    expect(referenceWeight(0.6, 1)).toBe(0.6);
    expect(referenceWeight(0.6, 4)).toBe(0.3);
    expect(referenceWeight(0.6, 2)).toBeLessThan(0.6);
    expect(referenceWeight(0.6, 2)).toBeGreaterThan(referenceWeight(0.6, 4));
  });

  it('treats no picture like one', () => {
    expect(referenceWeight(0.5, 0)).toBe(0.5);
  });
});

describe('migrateCharacters', () => {
  it('turns the single picture of an older character into a list, and leaves newer ones alone', () => {
    const migrated = migrateCharacters({
      presets: [
        { id: 'a', name: 'Old', data: { imageName: 'a.png', weight: 0.6, tags: 'x' } as never },
        { id: 'b', name: 'New', data: { imageNames: ['b.png', 'c.png'], weight: 0.5, tags: '' } },
      ],
    });
    expect(migrated.presets[0]!.data).toEqual({ imageNames: ['a.png'], weight: 0.6, tags: 'x' });
    expect(migrated.presets[1]!.data.imageNames).toEqual(['b.png', 'c.png']);
  });

  it('copes with a stored state that has no characters or a character without a picture', () => {
    type Stored = { presets?: { id: string; name: string; data: CharacterData }[] };
    expect(migrateCharacters<Stored>({}).presets).toEqual([]);
    const noPicture = { id: 'a', name: 'x', data: { weight: 1, tags: '' } as unknown as CharacterData };
    expect(migrateCharacters<Stored>({ presets: [noPicture] }).presets![0]!.data.imageNames).toEqual([]);
  });
});

describe('the LoRA of a character', () => {
  it('keeps a stored LoRA, fills a missing weight and drops a broken entry', () => {
    const migrated = migrateCharacters({
      presets: [
        { id: 'a', name: 'A', data: { imageNames: ['a.png'], weight: 0.6, tags: '', lora: { key: 'lora-1', weight: 0.7, trigger: 'mika', enabled: false } } },
        { id: 'b', name: 'B', data: { imageNames: ['b.png'], weight: 0.6, tags: '', lora: { key: 'lora-2', trigger: 'rin' } as never } },
        { id: 'c', name: 'C', data: { imageNames: ['c.png'], weight: 0.6, tags: '', lora: { weight: 1 } as never } },
      ],
    });
    expect(migrated.presets[0]!.data.lora).toEqual({ key: 'lora-1', weight: 0.7, trigger: 'mika', enabled: false });
    expect(migrated.presets[1]!.data.lora).toEqual({ key: 'lora-2', weight: DEFAULT_LORA_WEIGHT, trigger: 'rin', enabled: true });
    expect(migrated.presets[2]!.data).toEqual({ imageNames: ['c.png'], weight: 0.6, tags: '' });
  });
});

describe('the reference limit', () => {
  it('matches the backend limit of eight', () => {
    expect(MAX_REFERENCE_IMAGES).toBe(8);
  });
});
