// Property tests for text layout without a canvas: wrapping, vertical columns and fitting a font size to a box.
// The measure function is a deterministic stand-in (width grows with the character count and the size). In-process only.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check } from '@/propertyTest.testkit';
import { DEFAULT_TEXT_STYLE, type TextStyle } from '@/state/text/textModel';
import { fitFontSize, layoutHorizontal, layoutText, layoutVertical, type Measure } from './layout';
import { unitChar, verticalUnits } from './vertical';

const measure: Measure = (text, size) => [...text].length * size * 0.6;
const style: fc.Arbitrary<TextStyle> = fc
  .record({
    fontSize: fc.integer({ min: 4, max: 300 }),
    letterSpacing: fc.integer({ min: -3, max: 40 }),
    lineHeight: fc.double({ min: 0.5, max: 3, noNaN: true }),
    vertical: fc.boolean(),
  })
  .map((s) => ({ ...DEFAULT_TEXT_STYLE, ...s }));
// Text without line-breaking-rule characters (those may legally overflow a line), with newlines and spaces.
const plain = fc.stringMatching(/^[A-Za-z0-9 \nあア漢字]{0,80}$/);
// Anything at all, including the characters the rules treat specially.
const anything = fc.oneof(plain, fc.string({ unit: 'binary', maxLength: 60 }), fc.stringMatching(/^[、。（「()!?ー a\n]{0,40}$/));
const width = fc.integer({ min: 1, max: 2000 });
const stripped = (s: string) => s.replace(/\s/g, '');

describe('text layout (properties)', () => {
  it('layoutText never throws and gives finite, non-negative sizes for any text and box', () => {
    check(
      fc.property(anything, style, fc.option(width, { nil: null }), (text, st, extent) => {
        const b = layoutText(text, st, extent, measure);
        for (const n of [b.width, b.height, b.step]) {
          expect(Number.isFinite(n)).toBe(true);
          expect(n).toBeGreaterThanOrEqual(0);
        }
      }),
    );
  });

  it('wrapping keeps every visible character, in order', () => {
    check(
      fc.property(anything, style, fc.option(width, { nil: null }), (text, st, extent) => {
        const h = layoutHorizontal(text, { ...st, vertical: false }, extent, measure);
        expect(stripped(h.lines.map((l) => l.text).join(''))).toBe(stripped(text));
        const v = layoutVertical(text, { ...st, vertical: true }, extent);
        const norm = (s: string) => stripped(s).replace(/！/g, '!').replace(/？/g, '?');
        expect(norm(v.columns.flat().map(unitChar).join(''))).toBe(norm(text));
      }),
    );
  });

  it('without a width limit, every paragraph is one line / one column', () => {
    check(
      fc.property(anything, style, (text, st) => {
        expect(layoutHorizontal(text, st, null, measure).lines.length).toBe(text.split('\n').length);
        expect(layoutVertical(text, st, null).columns.length).toBe(text.split('\n').length);
      }),
    );
  });

  it('each wrapped line fits the box unless a single character is wider than it', () => {
    check(
      fc.property(plain, style, width, (text, st, extent) => {
        const h = layoutHorizontal(text, { ...st, vertical: false }, extent, measure);
        for (const l of h.lines) expect(l.width <= extent || [...l.text.trim()].length <= 1).toBe(true);
        const v = layoutVertical(text, { ...st, vertical: true }, extent);
        const rows = Math.max(1, Math.floor(extent / v.cell));
        for (const c of v.columns) expect(c.length).toBeLessThanOrEqual(rows);
      }),
    );
  });

  // Regression: a word wider than the box is broken between characters wherever it stands, not only at the start of a line:
  // layoutHorizontal('a bbbbbb', 10px, maxWidth 20) used to leave 'bbbbbb' whole on its own line.
  it('breaks a too-wide word that follows other text', () => {
    const h = layoutHorizontal('a bbbbbb', { ...DEFAULT_TEXT_STYLE, fontSize: 10, letterSpacing: 0, vertical: false }, 20, measure);
    expect(h.lines.every((l) => l.width <= 20)).toBe(true);
  });

  it('the block size is that of its lines', () => {
    check(
      fc.property(anything, style, fc.option(width, { nil: null }), (text, st, extent) => {
        const h = layoutHorizontal(text, st, extent, measure);
        expect(h.width).toBe(Math.max(0, ...h.lines.map((l) => l.width)));
        expect(h.height).toBe(h.lines.length === 0 ? 0 : st.fontSize + h.step * (h.lines.length - 1));
      }),
    );
  });

  it('verticalUnits never makes more units than characters', () => {
    check(fc.property(anything, (text) => verticalUnits(text.replace(/\n/g, '')).length <= [...text.replace(/\n/g, '')].length));
  });

  it('fitFontSize stays between the minimum and the current size, fits unless at the minimum, and is the largest that fits', () => {
    check(
      fc.property(plain, style, fc.record({ width: fc.integer({ min: 20, max: 2000 }), height: fc.integer({ min: 20, max: 2000 }) }), fc.integer({ min: 4, max: 12 }), (text, st, box, min) => {
        const size = fitFontSize(text, st, box, measure, min);
        expect(size).toBeGreaterThanOrEqual(min);
        expect(size).toBeLessThanOrEqual(Math.max(min, Math.round(st.fontSize)));
        const fits = (s: number) => {
          const scaled = { ...st, fontSize: s, letterSpacing: (st.letterSpacing * s) / st.fontSize };
          const b = layoutText(text, scaled, scaled.vertical ? box.height : box.width, measure);
          return b.width <= box.width + 0.5 && b.height <= box.height + 0.5;
        };
        if (size > min) expect(fits(size)).toBe(true);
        if (size < Math.max(min, Math.round(st.fontSize))) expect(fits(size + 1)).toBe(false);
      }),
    );
  });
});
