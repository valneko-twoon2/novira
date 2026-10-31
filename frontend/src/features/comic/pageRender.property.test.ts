// Breaking a balloon's words into lines (horizontal) and columns (vertical): no line is wider than the balloon unless it is
// one character that cannot be narrower, no word is lost or invented (only the breaks and the spaces at them change),
// and every text gives lines, whatever it holds.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { blockExternalNetwork, check, junkText } from '@/propertyTest.testkit';
import { wrapText, wrapVertical } from './pageRender';

blockExternalNetwork();

/** Text of Latin words, kana and kanji, spaces and line breaks: what balloons hold. */
const text = fc.oneof(
  fc.array(fc.constantFrom('a', 'b', 'W', 'hello', 'extraordinarily', 'あ', 'い', '漢', '字', 'ー', ' ', '  ', '\n', '\t', '。'), { maxLength: 40 }).map((a) => a.join('')),
  junkText,
);
/** An additive width: wide characters (full-width forms and kanji) count 2, the rest 1 to 3 by code. */
const measure = (line: string) => [...line].reduce((n, ch) => n + (ch.charCodeAt(0) >= 0x2e80 ? 2 : (ch.charCodeAt(0) % 3) + 1), 0);
const strip = (s: string) => s.replace(/\s+/g, '');

describe('wrapText', () => {
  it('keeps every line within the width, except a line of one character that is wider by itself', () => {
    check(
      fc.property(text, fc.integer({ min: 0, max: 60 }), (t, width) => {
        for (const line of wrapText(measure, t, width)) {
          if ([...line].length > 1) expect(measure(line)).toBeLessThanOrEqual(width);
        }
      }),
    );
  });

  it('gives back the text apart from the breaks and the spaces at them', () => {
    check(
      fc.property(text, fc.integer({ min: 0, max: 60 }), (t, width) => {
        const lines = wrapText(measure, t, width);
        expect(strip(lines.join(''))).toBe(strip(t));
        for (const line of lines) {
          expect(line).not.toContain('\n');
          expect(line).toBe(line.trimEnd());
        }
      }),
    );
  });

  it('gives at least one line per paragraph, and the lines of a text that fits in one line are the paragraphs', () => {
    check(
      fc.property(text, (t) => {
        expect(wrapText(measure, t, 1e9).length).toBe(t.split('\n').length);
        expect(wrapText(measure, t, 3).length).toBeGreaterThanOrEqual(t.split('\n').length);
      }),
    );
    expect(wrapText(measure, '', 10)).toEqual(['']);
  });

  it('never makes more lines than the text has characters and paragraphs', () => {
    check(
      fc.property(text, fc.integer({ min: 0, max: 60 }), (t, width) => {
        expect(wrapText(measure, t, width).length).toBeLessThanOrEqual([...strip(t)].length + t.split('\n').length);
      }),
    );
  });
});

describe('wrapVertical', () => {
  it('has columns of at most maxChars characters that join to the text without its line breaks', () => {
    check(
      fc.property(text, fc.integer({ min: 1, max: 12 }), (t, maxChars) => {
        const columns = wrapVertical(t, maxChars);
        for (const column of columns) {
          expect([...column].length).toBeLessThanOrEqual(maxChars);
          expect(column).not.toContain('\n');
        }
        expect(columns.join('')).toBe(t.split('\n').join(''));
        expect(columns.length).toBeGreaterThanOrEqual(t.split('\n').length);
      }),
    );
  });

  it('keeps each line of the text in its own column when the columns are long enough', () => {
    check(
      fc.property(text, (t) => {
        expect(wrapVertical(t, 1000)).toEqual(t.split('\n'));
      }),
    );
  });

  it('is only wider where it must: a column but the last of its line is full', () => {
    check(
      fc.property(fc.string({ minLength: 1, maxLength: 40 }), fc.integer({ min: 1, max: 8 }), (t, maxChars) => {
        const columns = wrapVertical(t.replace(/\n/g, ''), maxChars);
        for (const column of columns.slice(0, -1)) expect([...column].length).toBe(maxChars);
      }),
    );
  });
});
