import { describe, expect, it } from 'vitest';
import { charMarks, plainText, textRuns, toggleMark } from './balloonText';

describe('textRuns', () => {
  it('reads bold and emphasis dots, nested, and leaves plain words alone', () => {
    expect(textRuns('それは**本当**に《《大事》》な**《《話》》**だ')).toEqual([
      { text: 'それは', bold: false, dots: false },
      { text: '本当', bold: true, dots: false },
      { text: 'に', bold: false, dots: false },
      { text: '大事', bold: false, dots: true },
      { text: 'な', bold: false, dots: false },
      { text: '話', bold: true, dots: true },
      { text: 'だ', bold: false, dots: false },
    ]);
    expect(textRuns('ただの言葉')).toEqual([{ text: 'ただの言葉', bold: false, dots: false }]);
    expect(textRuns('')).toEqual([]);
  });

  it('runs a mark left open to the end, and keeps a closing mark with no opening one as words', () => {
    expect(textRuns('**まだ')).toEqual([{ text: 'まだ', bold: true, dots: false }]);
    expect(textRuns('《《まだ')).toEqual([{ text: 'まだ', bold: false, dots: true }]);
    expect(textRuns('a》》b')).toEqual([{ text: 'a》》b', bold: false, dots: false }]);
  });

  it('gives the plain text and one mark entry per character of it', () => {
    expect(plainText('a**b**《《c》》')).toBe('abc');
    expect(charMarks('a**b**《《c》》')).toEqual([
      { bold: false, dots: false },
      { bold: true, dots: false },
      { bold: false, dots: true },
    ]);
  });
});

describe('toggleMark', () => {
  it('wraps the selection and keeps the same words selected', () => {
    expect(toggleMark('ここが大事', 2, 5, 'dots')).toEqual({ text: 'ここ《《が大事》》', start: 4, end: 7 });
    expect(toggleMark('ここが大事', 5, 2, 'bold')).toEqual({ text: 'ここ**が大事**', start: 4, end: 7 });
  });

  it('takes the mark off a selection already wrapped in it', () => {
    expect(toggleMark('ここ《《が大事》》', 4, 7, 'dots')).toEqual({ text: 'ここが大事', start: 2, end: 5 });
    expect(toggleMark('**a**', 2, 3, 'bold')).toEqual({ text: 'a', start: 0, end: 1 });
  });

  it('wraps an empty selection (ready for typing) and keeps positions inside the text', () => {
    expect(toggleMark('ab', 1, 1, 'bold')).toEqual({ text: 'a****b', start: 3, end: 3 });
    expect(toggleMark('ab', -4, 99, 'bold')).toEqual({ text: '**ab**', start: 2, end: 4 });
  });
});
