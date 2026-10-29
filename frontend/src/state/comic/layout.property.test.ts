// The automatic panel layout of a page: for any panel count, column count, reading direction and paper, the boxes number as
// many as the panels (within the limit), stay inside the page, do not overlap, are mirrored for a page read from the right,
// and the picture size a panel gets is a multiple of 64 within the models' range.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { blockExternalNetwork, check } from '@/propertyTest.testkit';
import { PAGE_SIZES } from './document';
import { layoutFor, MAX_PANELS_PER_PAGE, pageAspect, panelPixels, type Box } from './layout';

blockExternalNetwork();

const EPS = 1e-9;
const count = fc.integer({ min: 1, max: MAX_PANELS_PER_PAGE });
const columns = fc.integer({ min: 1, max: 3 });
const direction = fc.constantFrom('ltr', 'rtl' as const);
const aspect = fc.constantFrom(...PAGE_SIZES).map((size) => pageAspect(size));

const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

describe('layoutFor', () => {
  it('gives one box per panel (at most the limit), whatever the count and columns', () => {
    check(
      fc.property(fc.integer({ min: -5, max: 60 }), fc.integer({ min: -2, max: 6 }), direction, aspect, (n, c, d, a) => {
        const boxes = layoutFor(n, c, d, a);
        expect(boxes).toHaveLength(Math.min(MAX_PANELS_PER_PAGE, Math.max(1, n)));
      }),
    );
  });

  it('keeps every box inside the page with a real size, and no two boxes overlap', () => {
    check(
      fc.property(count, columns, direction, aspect, (n, c, d, a) => {
        const boxes = layoutFor(n, c, d, a);
        for (const b of boxes) {
          expect(b.width).toBeGreaterThan(0);
          expect(b.height).toBeGreaterThan(0);
          expect(b.x).toBeGreaterThanOrEqual(-EPS);
          expect(b.y).toBeGreaterThanOrEqual(-EPS);
          expect(b.x + b.width).toBeLessThanOrEqual(1 + EPS);
          expect(b.y + b.height).toBeLessThanOrEqual(1 + EPS);
        }
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i]!, boxes[j]!)).toBeLessThanOrEqual(EPS);
      }),
    );
  });

  it('mirrors the whole layout for a page read from the right, leaving the heights alone', () => {
    check(
      fc.property(count, columns, aspect, (n, c, a) => {
        const ltr = layoutFor(n, c, 'ltr', a);
        const rtl = layoutFor(n, c, 'rtl', a);
        ltr.forEach((b, i) => {
          const m = rtl[i]!;
          expect(m.width).toBeCloseTo(b.width, 9);
          expect(m.y).toBeCloseTo(b.y, 9);
          expect(m.height).toBeCloseTo(b.height, 9);
          expect(m.x + m.width / 2).toBeCloseTo(1 - (b.x + b.width / 2), 9);
        });
      }),
    );
  });
});

describe('panelPixels', () => {
  it('gives sides that are multiples of 64 between 256 and 2048', () => {
    check(
      fc.property(
        fc.record({ x: fc.double({ min: 0, max: 1, noNaN: true }), y: fc.double({ min: 0, max: 1, noNaN: true }), width: fc.double({ min: 0.01, max: 1, noNaN: true }), height: fc.double({ min: 0.01, max: 1, noNaN: true }) }),
        aspect,
        fc.integer({ min: 64 * 64, max: 4096 * 4096 }),
        (box, a, area) => {
          const { width, height } = panelPixels(box, a, area);
          for (const side of [width, height]) {
            expect(side % 64).toBe(0);
            expect(side).toBeGreaterThanOrEqual(256);
            expect(side).toBeLessThanOrEqual(2048);
          }
        },
      ),
    );
  });
});
