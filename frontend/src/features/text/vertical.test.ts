import { describe, expect, it } from 'vitest';
import { unitChar, verticalGlyph, verticalUnits } from './vertical';

describe('vertical writing', () => {
  it('turns the long vowel mark and brackets and moves punctuation to the upper right', () => {
    expect(verticalGlyph('ー').rotate).toBe(true);
    expect(verticalGlyph('「').rotate).toBe(true);
    const comma = verticalGlyph('、');
    expect(comma.rotate).toBe(false);
    expect(comma.dx).toBeGreaterThan(0);
    expect(comma.dy).toBeLessThan(0);
    expect(verticalGlyph('あ')).toMatchObject({ rotate: false, dx: 0, dy: 0 });
  });

  it('nudges small kana', () => {
    expect(verticalGlyph('ゃ').dx).toBeGreaterThan(0);
  });

  it('sets "!!", "?!" and two-digit numbers in one cell', () => {
    expect(verticalUnits('なに！？').map(unitChar)).toEqual(['な', 'に', '!?']);
    expect(verticalUnits('すごい!!').map(unitChar)).toEqual(['す', 'ご', 'い', '!!']);
    expect(verticalUnits('12月').map(unitChar)).toEqual(['12', '月']);
  });

  it('leaves longer numbers and single marks alone', () => {
    expect(verticalUnits('100').map(unitChar)).toEqual(['1', '0', '0']);
    expect(verticalUnits('！').map(unitChar)).toEqual(['！']);
  });
});
