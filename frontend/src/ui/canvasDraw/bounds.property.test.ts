// Property tests for the bounds of drawn canvas content and the union of rectangles. In-process only.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check } from '@/propertyTest.testkit';
import { objectsBounds, unionRect } from './bounds';

const n = fc.integer({ min: -4000, max: 4000 });
const rect = fc.record({ x: n, y: n, width: fc.integer({ min: 1, max: 4000 }), height: fc.integer({ min: 1, max: 4000 }) });

describe('bounds (properties)', () => {
  it('unionRect contains both rects and is commutative; null is the identity', () => {
    check(
      fc.property(rect, rect, (a, b) => {
        const u = unionRect(a, b)!;
        for (const r of [a, b]) {
          expect(u.x).toBeLessThanOrEqual(r.x);
          expect(u.y).toBeLessThanOrEqual(r.y);
          expect(u.x + u.width).toBeGreaterThanOrEqual(r.x + r.width);
          expect(u.y + u.height).toBeGreaterThanOrEqual(r.y + r.height);
        }
        expect(unionRect(b, a)).toEqual(u);
        expect(unionRect(a, null)).toBe(a);
        expect(unionRect(null, b)).toBe(b);
      }),
    );
  });

  it('objectsBounds ignores empty input and contains every brush stroke point', () => {
    expect(objectsBounds([])).toBeNull();
    check(
      fc.property(fc.array(fc.tuple(n, n), { minLength: 1, maxLength: 20 }), fc.integer({ min: 1, max: 200 }), (pts, width) => {
        const stroke = { kind: 'stroke', tool: 'brush', points: pts.flat(), width, id: 's' } as unknown as Parameters<typeof objectsBounds>[0][number];
        const b = objectsBounds([stroke]);
        if (pts.length < 1 || pts.flat().length < 2) return;
        expect(b).not.toBeNull();
        for (const [x, y] of pts) {
          expect(x).toBeGreaterThanOrEqual(b!.x);
          expect(x).toBeLessThanOrEqual(b!.x + b!.width);
          expect(y).toBeGreaterThanOrEqual(b!.y);
          expect(y).toBeLessThanOrEqual(b!.y + b!.height);
        }
      }),
    );
  });
});
