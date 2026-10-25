import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { newBubble } from './document';
import { estimateBox } from './balloonPlace';
import { DEFAULT_STAMP_ID, findStamp, searchStamps, STAMP_STYLES, STAMPS, stampById, stampUrl, stampWords } from './stamps';

describe('the stamp list', () => {
  it('has 38 words in each of the three hands, each with a picture in src/assets/onomatopoeia', () => {
    for (const style of STAMP_STYLES) expect(STAMPS.filter((s) => s.style === style)).toHaveLength(38);
    const files = new Set(readdirSync(join(__dirname, '../../../src/assets/onomatopoeia')));
    expect(files.size).toBe(STAMPS.length);
    for (const s of STAMPS) expect(files.has(`${s.id}.webp`), s.id).toBe(true);
  });

  it('has unique ids that start with their hand, sizes that fit a picture and an intensity from 1 to 5', () => {
    expect(new Set(STAMPS.map((s) => s.id)).size).toBe(STAMPS.length);
    for (const s of STAMPS) {
      expect(s.id.startsWith(`${s.style}-`), s.id).toBe(true);
      expect(s.width).toBeGreaterThan(0);
      expect(s.height).toBeGreaterThan(0);
      expect(s.intensity).toBeGreaterThanOrEqual(1);
      expect(s.intensity).toBeLessThanOrEqual(5);
    }
    expect(stampById(DEFAULT_STAMP_ID)).toBeDefined();
    expect(stampUrl('block-doon')).toMatch(/block-doon.*.webp$/);
  });
});

describe('searching and naming stamps', () => {
  it('finds a word by its lettering or its reading, hiragana and katakana alike, in one hand or all', () => {
    expect(searchStamps('どん').some((s) => s.id === 'block-don')).toBe(true);
    expect(searchStamps('ドン', 'burst').every((s) => s.style === 'burst')).toBe(true);
    expect(searchStamps('ドン', 'burst').map((s) => s.id)).toContain('burst-don');
  });

  it('finds by what a sound is for, and finds nothing for a word that is not there', () => {
    expect(searchStamps('緊張').length).toBeGreaterThan(0);
    expect(searchStamps('zzzz-no-such')).toEqual([]);
    expect(searchStamps('')).toHaveLength(STAMPS.length);
  });

  it('names a stamp by its id, or by a word with the first hand (or the hand asked for)', () => {
    expect(findStamp('burst-doon')?.id).toBe('burst-doon');
    expect(findStamp('ザワ')?.id).toBe('block-zawa');
    expect(findStamp('ざわ', 'drybrush')?.id).toBe('drybrush-zawa');
    expect(findStamp(' ドーン！ ')?.id).toBe('block-doon');
    expect(findStamp('')).toBeUndefined();
    expect(findStamp('nothing')).toBeUndefined();
  });

  it('takes a word written a little differently, and the nearest count of one sound said again and again', () => {
    expect(findStamp('ドォン')?.id).toBe('block-doon');
    expect(findStamp('どーーん')?.id).toBe('block-doon');
    expect(findStamp('ドン')?.id).toBe('block-don');
    expect(findStamp('ゴゴゴ')?.id).toBe('block-go-4');
    expect(findStamp('ゴゴゴゴゴゴゴゴゴ', 'burst')?.id).toBe('burst-go-7');
    expect(findStamp('ズオオオ')).toBeUndefined();
    expect(stampWords()).toContain('ザワ');
    expect(stampWords()).toHaveLength(38);
  });
});

describe('a new stamp balloon', () => {
  it('starts as the default picture, large, with no tail, and its box follows the picture', () => {
    const bubble = newBubble('stamp', 0.1, 0.1);
    expect(bubble).toMatchObject({ kind: 'stamp', text: DEFAULT_STAMP_ID, tail: null, scale: 2.2 });
    const wide = estimateBox({ ...bubble, scale: 1 }, 1);
    const stamp = stampById('block-doon')!;
    expect(wide.w / wide.h).toBeCloseTo(stamp.width / stamp.height, 2);
    // Twice the size is twice the box, until it reaches the panel's edge; the start size leaves room on the panel.
    expect(estimateBox({ ...bubble, scale: 2 }, 1).h).toBeCloseTo(wide.h * 2, 6);
    expect(estimateBox(bubble, 1).w).toBeLessThan(0.6);
  });
});
