import { describe, expect, it } from 'vitest';
import { buildItems, filterItems, purposesOf } from './extensionList';
import categories from './purposeData/categories.json';
import { PURPOSES, assignedPurposes, purposesFromText } from './purposes';

describe('purposes', () => {
  it('keeps one category list whose ids are the purposes of the rail, with a name in every language', () => {
    expect(categories.map((c) => c.id)).toEqual([...PURPOSES]);
    for (const c of categories) expect(Object.keys(c.names).sort()).toEqual(['de', 'en', 'es', 'fr', 'ja', 'ko', 'pt-BR', 'ru', 'zh-CN', 'zh-TW']);
  });

  it('files a pack by the words of its name and description, in more than one purpose when it fits', () => {
    expect(purposesFromText('Whisper speech to text node')).toContain('audio');
    expect(purposesFromText('Load GGUF quantized models')).toContain('model');
    expect(purposesFromText('Upscale video frames')).toEqual(expect.arrayContaining(['upscale', 'video']));
    expect(purposesFromText('zzz nothing here')).toEqual([]);
  });

  it('keeps the purposes a suggested pack was filed under, and files registry-only packs by words', () => {
    const items = buildItems(
      [],
      [{ id: 'x', name: 'Voice Tools', description: 'text to speech', publisher: 'p', repository: 'https://github.com/p/Voice-Tools', icon: null, downloads: 1, stars: 1, version: null, updated: null, license: null }],
    );
    const impact = items.find((i) => i.folder === 'ComfyUI-Impact-Pack')!;
    expect(purposesOf(impact)).toEqual(impact.catalog!.goals);
    expect(filterItems(items, 'audio', '').map((i) => i.folder)).toEqual(['Voice-Tools']);
  });

  it('uses the AI filing of a registry pack, an empty one for a pack it found no purpose for, and null for an unknown pack', () => {
    expect(assignedPurposes('ComfyUI-Impact-Pack')).toEqual(['face', 'upscale', 'detect']);
    expect(assignedPurposes('crt-nodes')).toEqual([]);
    expect(assignedPurposes('no-such-pack-zzz')).toBeNull();
  });
});
