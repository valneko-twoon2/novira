// Property tests for the transparent-margin trim: the box is the tight bounds of the opaque pixels. In-process only.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check } from '@/propertyTest.testkit';
import { ALPHA_THRESHOLD, opaqueBounds } from './trim';

const picture = fc
  .record({ width: fc.integer({ min: 1, max: 12 }), height: fc.integer({ min: 1, max: 12 }) })
  .chain(({ width, height }) =>
    fc.array(fc.oneof(fc.constant(0), fc.integer({ min: 0, max: 255 })), { minLength: width * height, maxLength: width * height }).map((alphas) => ({
      width,
      height,
      alphas,
      data: alphas.flatMap((a) => [10, 20, 30, a]),
    })),
  );

describe('opaqueBounds (properties)', () => {
  it('is null exactly when no pixel is above the threshold, otherwise the tight box of those pixels', () => {
    check(
      fc.property(picture, fc.integer({ min: 0, max: 40 }), ({ width, height, alphas, data }, threshold) => {
        const box = opaqueBounds({ width, height, data }, threshold);
        const opaque = alphas.flatMap((a, i) => (a > threshold ? [{ x: i % width, y: Math.floor(i / width) }] : []));
        if (opaque.length === 0) {
          expect(box).toBeNull();
          return;
        }
        expect(box).toEqual({
          left: Math.min(...opaque.map((p) => p.x)),
          top: Math.min(...opaque.map((p) => p.y)),
          width: Math.max(...opaque.map((p) => p.x)) - Math.min(...opaque.map((p) => p.x)) + 1,
          height: Math.max(...opaque.map((p) => p.y)) - Math.min(...opaque.map((p) => p.y)) + 1,
        });
        expect(box!.left + box!.width).toBeLessThanOrEqual(width);
        expect(box!.top + box!.height).toBeLessThanOrEqual(height);
      }),
    );
  });

  it('uses the default threshold when none is given', () => {
    check(fc.property(picture, ({ width, height, data }) => JSON.stringify(opaqueBounds({ width, height, data })) === JSON.stringify(opaqueBounds({ width, height, data }, ALPHA_THRESHOLD))));
  });
});
