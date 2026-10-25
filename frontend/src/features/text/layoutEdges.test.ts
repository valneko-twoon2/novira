import { describe, expect, it } from 'vitest';
import { DEFAULT_TEXT_STYLE, type TextStyle } from '@/state/text/textModel';
import { layoutHorizontal, layoutVertical } from './layout';

/** Every character is 0.5 em wide. */
const measure = (text: string, size: number) => [...text].length * size * 0.5;
const style = (patch: Partial<TextStyle> = {}): TextStyle => ({ ...DEFAULT_TEXT_STYLE, fontSize: 20, lineHeight: 1.5, letterSpacing: 0, ...patch });

describe('horizontal layout: edge cases', () => {
  it('never breaks when there is no width and keeps empty paragraphs', () => {
    const b = layoutHorizontal('ab\n\ncd', style(), null, measure);
    expect(b.lines.map((l) => l.text)).toEqual(['ab', '', 'cd']);
  });

  it('breaks a word that is wider than the box between characters', () => {
    const b = layoutHorizontal('abcdefgh', style(), 20, measure);
    expect(b.lines.map((l) => l.text)).toEqual(['ab', 'cd', 'ef', 'gh']);
  });

  it('drops the spaces at a wrap point instead of starting a line with them', () => {
    const b = layoutHorizontal('aaaa     bbbb', style(), 40, measure);
    expect(b.lines.map((l) => l.text)).toEqual(['aaaa', 'bbbb']);
  });

  it('moves an opening bracket to the next line with the character after it', () => {
    // Four characters fit; the bracket would end the first line, so it travels to the next one.
    const b = layoutHorizontal('abc(def', style(), 50, measure);
    expect(b.lines.map((l) => l.text)).toEqual(['abc', '(def']);
  });

  it('keeps one empty line for an empty text and counts letter spacing in the width', () => {
    expect(layoutHorizontal('', style(), 100, measure).lines).toHaveLength(1);
    expect(layoutHorizontal('ab', style({ letterSpacing: 5 }), null, measure).width).toBe(20 + 5);
  });
});

describe('vertical layout: edge cases', () => {
  it('moves an opening bracket that would end a column to the next column', () => {
    // Two rows per column: the bracket would be the last cell of the first column.
    const b = layoutVertical('あ(いう', style({ vertical: true }), 40);
    expect(b.columns.map((c) => c.length)).toEqual([1, 2, 1]);
  });

  it('lets closing punctuation hang at the end of a full column', () => {
    const b = layoutVertical('あい、う', style({ vertical: true }), 40);
    expect(b.columns.map((c) => c.length)).toEqual([3, 1]);
  });

  it('does not break an opening bracket away when it is the only other cell', () => {
    const b = layoutVertical('(あい', style({ vertical: true }), 20);
    expect(b.columns.length).toBeGreaterThan(1);
    expect(b.columns.flat()).toHaveLength(3);
  });

  it('has no size for an empty text without a limit', () => {
    const b = layoutVertical('', style({ vertical: true }), null);
    expect(b.height).toBe(0);
    expect(b.columns.flat()).toHaveLength(0);
  });
});
