// The box a picture covers once turned about its centre: it holds the picture, is no larger than width plus height on a
// side, repeats every half turn, does not depend on the direction of the turn, and swaps its sides at a quarter turn.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { blockExternalNetwork, check } from '@/propertyTest.testkit';
import { turnedBox } from './bakeRotation';

blockExternalNetwork();

const side = fc.double({ min: 0.5, max: 5000, noNaN: true });
const angle = fc.double({ min: -720, max: 720, noNaN: true });
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

describe('turnedBox', () => {
  it('covers the picture, and is within width + height on each side', () => {
    check(
      fc.property(side, side, angle, (w, h, r) => {
        const box = turnedBox(w, h, r);
        expect(box.width * box.height).toBeGreaterThanOrEqual(w * h * (1 - 1e-9));
        expect(box.width).toBeLessThanOrEqual(w + h + 1e-6);
        expect(box.height).toBeLessThanOrEqual(w + h + 1e-6);
        expect(box.width).toBeGreaterThanOrEqual(Math.min(w, h) - 1e-6);
        // The two sides together are (w + h) scaled by |cos| + |sin|.
        expect(box.width + box.height).toBeCloseTo((w + h) * (Math.abs(Math.cos((r * Math.PI) / 180)) + Math.abs(Math.sin((r * Math.PI) / 180))), 6);
      }),
    );
  });

  it('is the same after a half turn and for the opposite direction', () => {
    check(
      fc.property(side, side, angle, (w, h, r) => {
        const box = turnedBox(w, h, r);
        for (const other of [turnedBox(w, h, r + 180), turnedBox(w, h, -r)]) {
          expect(near(other.width, box.width)).toBe(true);
          expect(near(other.height, box.height)).toBe(true);
        }
      }),
    );
  });

  it('swaps the sides when the picture does, and at a quarter turn', () => {
    check(
      fc.property(side, side, angle, (w, h, r) => {
        const box = turnedBox(w, h, r);
        const swapped = turnedBox(h, w, r);
        expect(near(swapped.width, box.height)).toBe(true);
        expect(near(swapped.height, box.width)).toBe(true);
      }),
    );
    check(
      fc.property(side, side, fc.integer({ min: -8, max: 8 }), (w, h, quarters) => {
        const box = turnedBox(w, h, quarters * 90);
        const [x, y] = Math.abs(quarters) % 2 === 0 ? [w, h] : [h, w];
        expect(near(box.width, x)).toBe(true);
        expect(near(box.height, y)).toBe(true);
      }),
    );
  });
});
