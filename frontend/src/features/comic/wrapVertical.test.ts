import { describe, expect, it } from 'vitest';
import { wrapVertical } from './pageRender';

describe('wrapVertical', () => {
  it('makes one column per line of the text, and breaks a long line into columns', () => {
    expect(wrapVertical('ab\ncd', 5)).toEqual(['ab', 'cd']);
    expect(wrapVertical('abcdefg', 3)).toEqual(['abc', 'def', 'g']);
  });

  it('keeps a blank line as an empty column', () => {
    expect(wrapVertical('a\n\nb', 5)).toEqual(['a', '', 'b']);
  });
});
