// Property tests for the canvas colour conversions (RGBA objects, hex). In-process only (no network).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check, junkText } from '@/propertyTest.testkit';
import { fromHex, toHex } from './color';

const byte = fc.integer({ min: 0, max: 255 });

describe('canvas colours (properties)', () => {
  it('toHex(fromHex(x)) returns the same colour, in lower case', () => {
    check(
      fc.property(byte, byte, byte, fc.boolean(), (r, g, b, hash) => {
        const hex = `${hash ? '#' : ''}${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
        expect(toHex(fromHex(hex.toUpperCase()))).toBe(`#${hex.replace('#', '')}`);
      }),
    );
  });

  it('fromHex never throws, keeps the alpha and gives whole channels in 0..255 for any text', () => {
    check(
      fc.property(junkText, fc.double({ min: 0, max: 1, noNaN: true }), (text, a) => {
        const c = fromHex(text, a);
        expect(c.a).toBe(a);
        for (const n of [c.r, c.g, c.b]) expect(Number.isInteger(n) && n >= 0 && n <= 255).toBe(true);
      }),
    );
  });

  it('toHex clamps channels outside 0..255 and rounds fractions', () => {
    check(
      fc.property(fc.double({ min: -1000, max: 1000, noNaN: true }), (n) => {
        expect(toHex({ r: n, g: n, b: n, a: 1 })).toMatch(/^#[0-9a-f]{6}$/);
      }),
    );
  });
});
