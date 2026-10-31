// The start of a balloon's words that names its layer in a PSD: one line, without marks, never longer than the limit plus
// the ellipsis, the whole words when they are short, and always the start of them.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { blockExternalNetwork, check, junkText } from '@/propertyTest.testkit';
import { plainText } from '@/state/comic/balloonText';
import { firstWords } from './pagePsd';

blockExternalNetwork();

const words = fc.oneof(
  junkText,
  fc.array(fc.constantFrom('**', '《《', '》》', 'あ', 'abc', ' ', '\n', '\t', '😀'), { maxLength: 30 }).map((a) => a.join('')),
);
const collapsed = (text: string) => plainText(text).replace(/\s+/g, ' ').trim();

describe('firstWords', () => {
  it('is one line of at most 16 characters plus an ellipsis, with no space at either end', () => {
    check(
      fc.property(words, (text) => {
        const name = firstWords(text);
        expect(/[\r\n\t]|\s\s/.test(name)).toBe(false);
        expect(name).toBe(name.trim());
        expect([...name].length).toBeLessThanOrEqual(17);
      }),
    );
  });

  it('is the whole words when they are short, and otherwise their start followed by an ellipsis', () => {
    check(
      fc.property(words, (text) => {
        const whole = collapsed(text);
        const name = firstWords(text);
        if ([...whole].length <= 16) {
          expect(name).toBe(whole);
        } else {
          expect(name.endsWith('…')).toBe(true);
          expect(whole.startsWith(name.slice(0, -1))).toBe(true);
        }
      }),
    );
  });

  it('shows the marks of the words as nothing', () => {
    expect(firstWords('**bold**')).toBe('bold');
    expect(firstWords('《《dots》》')).toBe('dots');
  });
});
