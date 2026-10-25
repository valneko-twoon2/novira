import { describe, expect, it } from 'vitest';
import { layoutFor, MAX_PANELS_PER_PAGE, pageBoxes, type Box } from './layout';

const EPS = 1e-9;

/** Two boxes overlap only when they share some area. */
function disjoint(a: Box, b: Box): boolean {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w <= EPS || h <= EPS;
}

describe('the layout of a page with columns and a reading direction', () => {
  it('allows up to 24 panels on a page', () => {
    expect(MAX_PANELS_PER_PAGE).toBe(24);
    expect(layoutFor(40)).toHaveLength(24);
  });

  it('lays one column out as a single stack of panels of the same width', () => {
    const boxes = layoutFor(4, 1);
    expect(boxes).toHaveLength(4);
    for (const b of boxes) {
      expect(b.width).toBeCloseTo(boxes[0]!.width, 9);
      expect(b.x).toBeCloseTo(boxes[0]!.x, 9);
    }
  });

  it('shares the width of an unfinished row between its panels, with three columns', () => {
    const boxes = layoutFor(5, 3);
    // The first row has three panels; the second has two, which are wider than those of the first row.
    expect(boxes[3]!.width).toBeCloseTo(boxes[4]!.width, 9);
    expect(boxes[3]!.width).toBeGreaterThan(boxes[0]!.width);
  });

  it('reads from the right: the first panel of a row sits at the right edge', () => {
    // Four panels in two columns: the first panel is the top left one, and it moves to the top right.
    const ltr = layoutFor(4, 2, 'ltr');
    const rtl = layoutFor(4, 2, 'rtl');
    expect(rtl[0]!.x).toBeGreaterThan(ltr[0]!.x);
    expect(rtl[1]!.x).toBeLessThan(rtl[0]!.x);
    expect(rtl[0]!.width).toBeCloseTo(ltr[0]!.width, 9);
  });

  it('keeps every panel inside the page and apart from the others, for every column count and direction', () => {
    for (const columns of [1, 2, 3]) {
      for (const direction of ['ltr', 'rtl'] as const) {
        for (let n = 1; n <= MAX_PANELS_PER_PAGE; n++) {
          const boxes = layoutFor(n, columns, direction);
          expect(boxes).toHaveLength(n);
          for (const b of boxes) {
            expect(b.x).toBeGreaterThanOrEqual(-EPS);
            expect(b.x + b.width).toBeLessThanOrEqual(1 + EPS);
            expect(b.y).toBeGreaterThanOrEqual(-EPS);
            expect(b.y + b.height).toBeLessThanOrEqual(1 + EPS);
          }
          for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(disjoint(boxes[i]!, boxes[j]!)).toBe(true);
        }
      }
    }
  });

  it('lays out a page of the default settings as two columns read left to right', () => {
    expect(pageBoxes({ panels: [1, 2, 3], columns: 2, direction: 'ltr' })).toEqual(layoutFor(3));
  });
});
