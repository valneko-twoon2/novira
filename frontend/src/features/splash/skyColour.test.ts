import { describe, expect, it } from 'vitest';
import { parseHex } from './skyColour';

describe('parseHex', () => {
  it('reads token colours in hex and falls back on anything else', () => {
    const fallback = { r: 1, g: 2, b: 3 };
    expect(parseHex(' #2f6feb ', fallback)).toEqual({ r: 47, g: 111, b: 235 });
    expect(parseHex('#fff', fallback)).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('rgb(1 2 3)', fallback)).toBe(fallback);
    expect(parseHex('', fallback)).toBe(fallback);
  });
});
