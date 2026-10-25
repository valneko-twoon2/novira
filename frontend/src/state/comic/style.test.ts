import { describe, expect, it } from 'vitest';
import { phrasesOf, promptStyleOf, TAG_WORDS_MAX } from './style';

describe('phrasesOf', () => {
  it(`names the terms longer than ${TAG_WORDS_MAX} words, without their weights`, () => {
    const prompt = '1boy, solo, sitting quietly at his usual table, (large window showing the rainy street:1.2), hand on own chest, (teacup:1.2)';
    expect(phrasesOf(prompt)).toEqual(['sitting quietly at his usual table', 'large window showing the rainy street']);
  });

  it('finds nothing in tags, or in words without spaces between them', () => {
    expect(phrasesOf('1girl, solo, upper body, looking at another, smile')).toEqual([]);
    expect(phrasesOf('雨上がりの窓の外に大きな虹が見える')).toEqual([]);
  });
});

describe('promptStyleOf', () => {
  it('reads tags for the SD family and with no model, sentences for the others', () => {
    expect(promptStyleOf('sdxl')).toBe('tags');
    expect(promptStyleOf(null)).toBe('tags');
    expect(promptStyleOf('flux')).toBe('sentences');
  });
});
