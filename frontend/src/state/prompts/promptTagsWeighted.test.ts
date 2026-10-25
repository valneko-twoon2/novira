import { describe, expect, it } from 'vitest';
import { joinWeightedTags, parseWeightedTags, removeTagAt, setTagWeightAt } from './promptTags';

describe('weighted tags', () => {
  it('reads plain and weighted entries', () => {
    expect(parseWeightedTags('1girl, (smile:1.3), (red eyes:0.8)')).toEqual([
      { text: '1girl', weight: 1 },
      { text: 'smile', weight: 1.3 },
      { text: 'red eyes', weight: 0.8 },
    ]);
  });

  it('keeps commas inside brackets and braces in one entry', () => {
    expect(parseWeightedTags('(a, b:1.2), {x|y, z}, c').map((t) => t.text)).toEqual(['a, b', '{x|y, z}', 'c']);
  });

  it('returns nothing for an empty prompt', () => {
    expect(parseWeightedTags('  , ')).toEqual([]);
  });

  it('writes strength 1 as plain words and others in brackets', () => {
    expect(setTagWeightAt('a, (b:1.4)', 1, 1)).toBe('a, b');
    expect(setTagWeightAt('a, b', 0, 1.2)).toBe('(a:1.2), b');
  });

  it('clamps and rounds the strength', () => {
    expect(setTagWeightAt('a', 0, 5)).toBe('(a:2)');
    expect(setTagWeightAt('a', 0, 1.2345)).toBe('(a:1.23)');
    expect(joinWeightedTags([{ text: 'a', weight: -1 }])).toBe('(a:0)');
  });

  it('ignores an index past the end and removes an entry by index', () => {
    expect(setTagWeightAt('a', 3, 1.5)).toBe('a');
    expect(removeTagAt('a, (b:1.2), c', 1)).toBe('a, c');
  });
});
