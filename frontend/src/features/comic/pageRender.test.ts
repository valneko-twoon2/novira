import { describe, expect, it } from 'vitest';
import { newBubble } from '@/state/comic/document';
import { bubbleFonts, wrapText } from './pageRender';

// A stand-in for measureText: every character is one unit wide.
const measure = (s: string) => [...s].length;

describe('wrapping the text of a balloon', () => {
  it('keeps a short line as it is', () => {
    expect(wrapText(measure, 'こんにちは', 10)).toEqual(['こんにちは']);
  });

  it('breaks Japanese, which has no spaces, between any two characters at the widest the balloon allows', () => {
    expect(wrapText(measure, 'あいうえおかきくけこ', 4)).toEqual(['あいうえ', 'おかきく', 'けこ']);
  });

  it('starts a new line at each line break of the text', () => {
    expect(wrapText(measure, 'one\ntwo', 10)).toEqual(['one', 'two']);
    expect(wrapText(measure, '', 10)).toEqual(['']);
  });

  it('counts a surrogate pair as one character', () => {
    expect(wrapText(measure, '𝒜𝒷', 1)).toEqual(['𝒜', '𝒷']);
  });

  it('breaks a line at a space, so a word is not cut', () => {
    expect(wrapText(measure, 'to be or not', 6)).toEqual(['to be', 'or not']);
  });

  it('moves a word that does not fit to the next line, and drops the spaces at the break', () => {
    expect(wrapText(measure, 'hello world again', 5)).toEqual(['hello', 'world', 'again']);
  });

  it('breaks a word wider than a line between its characters', () => {
    expect(wrapText(measure, 'abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('keeps a space before Japanese, and breaks the Japanese between its characters', () => {
    expect(wrapText(measure, 'a 日本', 3)).toEqual(['a 日', '本']);
  });

  it('drops a run of spaces at a break', () => {
    expect(wrapText(measure, 'a  b', 2)).toEqual(['a', 'b']);
  });
});

describe('the font of a balloon on the saved page', () => {
  it('is its own font, else the default font of the settings, else the standard one, with the fallbacks after it', () => {
    const bubble = newBubble('speech', 0, 0);
    expect(bubbleFonts({ ...bubble, font: 'Yu Mincho' }, 'Meiryo')).toMatch(/^"Yu Mincho", /);
    expect(bubbleFonts(bubble, 'Meiryo')).toMatch(/^"Meiryo", /);
    expect(bubbleFonts(bubble, '')).not.toMatch(/^"Meiryo", /);
    expect(bubbleFonts(bubble, '')).toContain('sans-serif');
  });
});
