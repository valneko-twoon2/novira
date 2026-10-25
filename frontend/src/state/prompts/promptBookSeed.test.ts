import { describe, expect, it } from 'vitest';
import seed from './seed/promptBook.json';
import { usePromptBook, withNewSeedEntries } from './promptBook';

describe('the prompt book seed', () => {
  it('has no empty field and no tag twice within a category', () => {
    const keys = new Set<string>();
    for (const e of seed) {
      expect(e.tag.trim()).not.toBe('');
      expect(e.meaning.trim()).not.toBe('');
      expect(e.category.trim()).not.toBe('');
      const key = `${e.category}\n${e.tag.toLowerCase()}`;
      expect(keys.has(key), key).toBe(false);
      keys.add(key);
    }
  });

  it('covers poses, motions, expressions, relations and composition', () => {
    const count = (c: string) => seed.filter((e) => e.category === c).length;
    for (const c of ['ポーズ', '動き', '表情', '人物の関係・やりとり', '構図']) expect(count(c), c).toBeGreaterThanOrEqual(60);
  });

  it('gives every entry a distinct id', () => {
    const ids = usePromptBook.getState().entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('bringing new seed words to a saved book', () => {
  it('keeps what is saved, adds the missing seed words once and does not duplicate a held one', () => {
    const saved = [
      { id: 'pb-1', tag: 'my word', meaning: 'mine', category: '自作', note: '' },
      { id: 'seed-0', tag: 'LONG HAIR', meaning: 'edited', category: '髪型', note: '' },
    ];
    const merged = withNewSeedEntries(saved);
    expect(merged.slice(0, 2)).toEqual(saved);
    expect(merged.filter((e) => e.tag.toLowerCase() === 'long hair' && e.category === '髪型')).toHaveLength(1);
    expect(merged.length).toBe(2 + seed.length - 1);
    expect(withNewSeedEntries(merged)).toEqual(merged);
  });

  it('returns the whole seed for an empty book', () => {
    expect(withNewSeedEntries([])).toHaveLength(seed.length);
  });
});
