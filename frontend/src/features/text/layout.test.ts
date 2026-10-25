import { describe, expect, it } from 'vitest';
import { fitFontSize, layoutHorizontal, layoutText, layoutVertical } from './layout';
import { DEFAULT_TEXT_STYLE, type TextStyle } from '@/state/text/textModel';

/** Every character is 0.5 em wide. */
const measure = (text: string, size: number) => [...text].length * size * 0.5;
const style = (patch: Partial<TextStyle> = {}): TextStyle => ({ ...DEFAULT_TEXT_STYLE, fontSize: 20, lineHeight: 1.5, letterSpacing: 0, ...patch });

describe('horizontal layout', () => {
  it('keeps explicit line breaks and measures the block', () => {
    const b = layoutHorizontal('ab\ncdef', style(), null, measure);
    expect(b.lines.map((l) => l.text)).toEqual(['ab', 'cdef']);
    expect(b.width).toBe(40);
    expect(b.height).toBe(20 + 30);
  });

  it('wraps at the box width and keeps English words whole', () => {
    const b = layoutHorizontal('hello world again', style(), 100, measure);
    expect(b.lines.map((l) => l.text)).toEqual(['hello', 'world', 'again']);
  });

  it('does not start a line with closing punctuation', () => {
    // Five characters fit per line; the sixth is a full stop that must stay on the first line.
    const b = layoutHorizontal('あいうえおかきく。', style(), 50, measure);
    expect(b.lines[0]!.text.endsWith('。')).toBe(false);
    expect(b.lines.every((l) => !l.text.startsWith('。'))).toBe(true);
  });

  it('does not end a line with an opening bracket', () => {
    const b = layoutHorizontal('あいうえ「おかき」', style(), 50, measure);
    expect(b.lines[0]!.text.endsWith('「')).toBe(false);
  });

  it('adds letter spacing between characters', () => {
    expect(layoutHorizontal('abcd', style({ letterSpacing: 4 }), null, measure).width).toBe(40 + 12);
  });
});

describe('vertical layout', () => {
  it('puts the first column on the right and wraps by rows', () => {
    const b = layoutVertical('あいうえお', style({ vertical: true }), 40);
    // 20 px cells, 40 px of height: two rows per column.
    expect(b.columns.map((c) => c.length)).toEqual([2, 2, 1]);
    expect(b.width).toBe(20 + 30 * 2);
    expect(b.height).toBe(40);
  });

  it('starts a new column at a line break', () => {
    expect(layoutVertical('あ\nい', style({ vertical: true }), null).columns).toHaveLength(2);
  });

  it('keeps closing punctuation at the end of a column', () => {
    const b = layoutVertical('あい。', style({ vertical: true }), 40);
    expect(b.columns).toHaveLength(1);
    expect(b.columns[0]).toHaveLength(3);
  });
});

describe('fitting', () => {
  const box = { width: 100, height: 100 };

  it('keeps the size when the text already fits', () => {
    expect(fitFontSize('abc', style({ fontSize: 20 }), box, measure)).toBe(20);
  });

  it('shrinks long text until it fits', () => {
    const text = 'あ'.repeat(60);
    const size = fitFontSize(text, style({ fontSize: 40 }), box, measure);
    expect(size).toBeLessThan(40);
    const block = layoutText(text, style({ fontSize: size }), box.width, measure);
    expect(block.height).toBeLessThanOrEqual(100.5);
    // One more pixel would no longer fit.
    const bigger = layoutText(text, style({ fontSize: size + 1 }), box.width, measure);
    expect(bigger.height > 100.5 || bigger.width > 100.5).toBe(true);
  });

  it('fits vertical text into the box height', () => {
    const size = fitFontSize('あ'.repeat(40), style({ fontSize: 40, vertical: true }), box, measure);
    const block = layoutText('あ'.repeat(40), style({ fontSize: size, vertical: true }), box.height, measure);
    expect(block.width).toBeLessThanOrEqual(100.5);
  });
});
