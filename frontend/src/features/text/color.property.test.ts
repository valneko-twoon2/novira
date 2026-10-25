// Property tests for the text editor's colour strings. In-process only (no network).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check, junkText } from '@/propertyTest.testkit';
import { formatColor, parseColor } from './color';

const byte = fc.integer({ min: 0, max: 255 });
const hex = fc.tuple(byte, byte, byte).map(([r, g, b]) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`);

describe('parseColor / formatColor (properties)', () => {
  it('parseColor never throws and gives #rrggbb with an alpha in 0..1 for arbitrary text', () => {
    check(
      fc.property(fc.oneof(junkText, hex, fc.string({ unit: 'binary-ascii', maxLength: 30 })), (css) => {
        const c = parseColor(css);
        expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
        expect(c.alpha).toBeGreaterThanOrEqual(0);
        expect(c.alpha).toBeLessThanOrEqual(1);
      }),
    );
  });

  it('formatColor then parseColor returns the same colour (alpha to two decimals)', () => {
    check(
      fc.property(hex, fc.integer({ min: 0, max: 100 }), (h, percent) => {
        const alpha = percent / 100;
        const back = parseColor(formatColor({ hex: h, alpha }));
        expect(back.hex).toBe(h);
        expect(back.alpha).toBeCloseTo(alpha, 2);
      }),
    );
  });

  it('rgb() values outside 0..255 are clamped and 3-digit hex expands', () => {
    check(
      fc.property(fc.integer({ min: 0, max: 999 }), fc.integer({ min: 0, max: 999 }), fc.integer({ min: 0, max: 999 }), (r, g, b) => {
        const c = parseColor(`rgb(${r}, ${g}, ${b})`);
        expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
        expect(parseInt(c.hex.slice(1, 3), 16)).toBe(Math.min(255, r));
      }),
    );
    expect(parseColor('#abc').hex).toBe('#aabbcc');
  });

  // Regression: a malformed alpha ("1.2.3") is not a colour, so the documented fallback (opaque black) applies; it used to give a NaN alpha.
  it('falls back to opaque black for a malformed alpha, never NaN', () => {
    expect(parseColor('rgba(0,0,0,1.2.3)')).toEqual({ hex: '#000000', alpha: 1 });
    expect(parseColor('rgba(9,9,9,..5)')).toEqual({ hex: '#000000', alpha: 1 });
    expect(parseColor('rgba(9,9,9,.5)').alpha).toBe(0.5);
  });
});
