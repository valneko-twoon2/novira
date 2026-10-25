import { describe, expect, it } from 'vitest';
import { fitOf, formatVram, recommendedIndex } from './modelFit';

const GIB = 1024 ** 3;
const need = { minGb: 8, goodGb: 12 };

describe('fitOf', () => {
  it('calls a card comfortable, tight or short by its memory', () => {
    expect(fitOf(16 * GIB, need)).toBe('comfortable');
    expect(fitOf(10 * GIB, need)).toBe('tight');
    expect(fitOf(6 * GIB, need)).toBe('short');
  });

  it('treats the memory a "12 GB" card reports (a little under 12 GiB) as 12 GB', () => {
    expect(fitOf(12282 * 1024 * 1024, need)).toBe('comfortable');
    expect(formatVram(12282 * 1024 * 1024)).toBe('12 GB');
  });

  it('is unknown when the memory could not be read', () => {
    expect(fitOf(null, need)).toBe('unknown');
  });
});

describe('recommendedIndex', () => {
  it('prefers the first comfortable candidate, then the first tight one', () => {
    expect(recommendedIndex(['tight', 'comfortable', 'comfortable'])).toBe(1);
    expect(recommendedIndex(['short', 'tight', 'tight'])).toBe(1);
  });

  it('recommends nothing when none fits or the card is unknown', () => {
    expect(recommendedIndex(['short', 'short'])).toBe(-1);
    expect(recommendedIndex(['unknown', 'unknown'])).toBe(-1);
  });
});
