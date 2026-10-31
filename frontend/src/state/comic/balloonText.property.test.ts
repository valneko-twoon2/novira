// The marks in a balloon's words (**bold**, 《《dots》》): reading any text gives runs with no empty run and plain text that is
// only the text without its marks, and toggling a mark twice on a selection gives the words back.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { blockExternalNetwork, check, junkText } from '@/propertyTest.testkit';
import { charMarks, plainText, textRuns, toggleMark, type TextMark } from './balloonText';

blockExternalNetwork();

const piece = fc.constantFrom('**', '《《', '》》', '*', '《', 'a', 'b', 'あ', ' ', '\n', '😀');
const marked = fc.oneof(junkText, fc.array(piece, { maxLength: 24 }).map((a) => a.join('')));
const unmarked = fc.string({ maxLength: 30 }).filter((s) => !s.includes('**') && !s.includes('《《') && !s.includes('》》'));
/** Words with no character a mark is made of: a lone * or 《 next to a mark would join it ("*" in bold is "*****", which reads as a bold that is closed at once). */
const plainWords = fc.string({ maxLength: 30 }).filter((x) => !/[*《》]/.test(x));
const mark = fc.constantFrom<TextMark>('bold', 'dots');

describe('textRuns, plainText and charMarks', () => {
  it('has no empty run, the plain text is the runs joined, and a mark is never part of a run of a text without one', () => {
    check(
      fc.property(marked, (text) => {
        const runs = textRuns(text);
        expect(runs.every((r) => r.text.length > 0)).toBe(true);
        expect(plainText(text)).toBe(runs.map((r) => r.text).join(''));
        expect(plainText(text).length).toBeLessThanOrEqual(text.length);
        expect(charMarks(text)).toHaveLength(plainText(text).length);
      }),
    );
  });

  it('leaves a text without marks as it is, in one plain run', () => {
    check(
      fc.property(unmarked, (text) => {
        expect(plainText(text)).toBe(text);
        expect(textRuns(text)).toEqual(text ? [{ text, bold: false, dots: false }] : []);
      }),
    );
  });

  it('takes out of the text only the marks: putting their characters back is a supersequence of the plain text', () => {
    check(
      fc.property(marked, (text) => {
        const plain = [...plainText(text)];
        let at = 0;
        for (const ch of text) if (at < plain.length && ch === plain[at]) at++;
        expect(at).toBe(plain.length);
      }),
    );
  });
});

describe('toggleMark', () => {
  it('marks the selection, leaves the words of a text without marks the same, and toggling again restores the text', () => {
    check(
      fc.property(plainWords, fc.nat(40), fc.nat(40), mark, (text, a, b, m) => {
        const on = toggleMark(text, a, b, m);
        expect(plainText(on.text)).toBe(text);
        expect(on.start).toBeLessThanOrEqual(on.end);
        const marks = charMarks(on.text);
        const [from, to] = [Math.min(a, b, text.length), Math.min(Math.max(a, b), text.length)];
        for (let i = from; i < to; i++) expect(marks[i]![m]).toBe(true);
        expect(toggleMark(on.text, on.start, on.end, m).text).toBe(text);
      }),
    );
  });
});
