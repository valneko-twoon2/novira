// Property tests for the canvas geometry: rectangle normalisation, bbox resizing and hit testing. In-process only.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check } from '@/propertyTest.testkit';
import { BBOX_HANDLES, classifyCoverage, handlePoint, hitBbox, normalizeRect, resizeRect, snap } from './geometry';

const n = fc.integer({ min: -4000, max: 4000 });
const rect = fc.record({ x: n, y: n, width: fc.integer({ min: 1, max: 4000 }), height: fc.integer({ min: 1, max: 4000 }) });
const handle = fc.constantFrom(...BBOX_HANDLES);

describe('geometry (properties)', () => {
  it('normalizeRect gives a non-negative size whichever corner comes first', () => {
    check(
      fc.property(n, n, n, n, (x0, y0, x1, y1) => {
        const r = normalizeRect(x0, y0, x1, y1);
        expect(r.width).toBeGreaterThanOrEqual(0);
        expect(r.height).toBeGreaterThanOrEqual(0);
        expect(normalizeRect(x1, y1, x0, y0)).toEqual(r);
      }),
    );
  });

  it('resizeRect keeps whole numbers, honours the minimum and snaps the size', () => {
    check(
      fc.property(rect, handle, n, n, fc.constantFrom(1, 8, 16, 64), fc.constantFrom(8, 64), (start, h, dx, dy, step, min) => {
        const r = resizeRect(start, h, dx, dy, { step, min });
        expect(Number.isInteger(r.x) && Number.isInteger(r.y)).toBe(true);
        expect(r.width).toBeGreaterThanOrEqual(min);
        expect(r.height).toBeGreaterThanOrEqual(min);
        for (const side of [r.width, r.height]) expect(side === min || side % step === 0 || Math.abs(side - snap(side, step)) < 1e-9).toBe(true);
      }),
    );
  });

  it('resizeRect with a ratio keeps the result finite and never below the minimum', () => {
    check(
      fc.property(rect, handle, n, n, fc.double({ min: 0.1, max: 10, noNaN: true }), (start, h, dx, dy, ratio) => {
        const r = resizeRect(start, h, dx, dy, { ratio });
        expect(Number.isFinite(r.width) && Number.isFinite(r.height) && Number.isFinite(r.x) && Number.isFinite(r.y)).toBe(true);
        expect(r.width).toBeGreaterThanOrEqual(64);
        expect(r.height).toBeGreaterThanOrEqual(64);
      }),
    );
  });

  it('a corner or edge handle point is found by hitBbox; the centre is inside', () => {
    check(
      fc.property(rect, handle, (r, h) => {
        const p = handlePoint(r, h);
        expect(hitBbox(p, r)).not.toBeNull();
        expect(hitBbox({ x: r.x + r.width / 2, y: r.y + r.height / 2 }, r, 0)).not.toBeNull();
        expect(hitBbox({ x: r.x - 1000, y: r.y - 1000 }, r)).toBeNull();
      }),
    );
  });

  it('classifyCoverage agrees with a direct count of covered alpha values', () => {
    check(
      fc.property(fc.array(fc.integer({ min: 0, max: 255 }), { maxLength: 64 }), fc.integer({ min: 0, max: 254 }), (alphas, threshold) => {
        const data = alphas.flatMap((a) => [0, 0, 0, a]);
        const covered = alphas.filter((a) => a > threshold).length;
        expect(classifyCoverage(data, threshold)).toBe(covered === 0 ? 'empty' : covered === alphas.length ? 'full' : 'partial');
      }),
    );
  });
});
