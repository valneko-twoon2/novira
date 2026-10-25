import { describe, expect, it } from 'vitest';
import { emptyPage } from './document';
import { frameOutlines, layoutFor, MAX_PANELS_PER_PAGE, PAGE_ASPECT, pageShapes, panelGeometry, panelPixels, type Box } from './layout';

const EPS = 1e-9;

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

describe('the automatic layout of a page', () => {
  it.each(Array.from({ length: MAX_PANELS_PER_PAGE }, (_, i) => i + 1))('gives %i panels, inside the page and clear of each other', (count) => {
    const boxes = layoutFor(count);
    expect(boxes).toHaveLength(count);
    for (const b of boxes) {
      expect(b.width).toBeGreaterThan(0);
      expect(b.height).toBeGreaterThan(0);
      expect(b.x).toBeGreaterThanOrEqual(0.04 - EPS);
      expect(b.x + b.width).toBeLessThanOrEqual(0.96 + EPS);
      expect(b.y * PAGE_ASPECT).toBeGreaterThanOrEqual(0.04 - EPS);
      expect((b.y + b.height) * PAGE_ASPECT).toBeLessThanOrEqual(PAGE_ASPECT - 0.04 + EPS);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i]!, boxes[j]!)).toBe(0);
    }
  });

  it('keeps a gutter between panels: no two boxes touch', () => {
    const boxes = layoutFor(4);
    const [a, b, c] = boxes as [Box, Box, Box];
    // Top-left and top-right are side by side: the gap between them is at least the gutter's share of the width.
    expect(b.x - (a.x + a.width)).toBeGreaterThan(0.015);
    expect(c.y - (a.y + a.height)).toBeGreaterThan(0.015 / PAGE_ASPECT);
  });

  it('puts the first panel at the top left, in reading order', () => {
    const boxes = layoutFor(3);
    expect(boxes[0]!.x).toBeLessThan(boxes[1]!.x + EPS);
    expect(boxes[0]!.y).toBeLessThan(boxes[1]!.y);
    expect(boxes[1]!.y).toBeCloseTo(boxes[2]!.y, 9);
  });

  it('makes a single panel the whole of the printable area', () => {
    const [only] = layoutFor(1);
    expect(only!.x).toBeCloseTo(0.04, 9);
    expect(only!.width).toBeCloseTo(0.92, 9);
  });

  it('clamps the count to the range of one to the most a page holds', () => {
    expect(layoutFor(0)).toHaveLength(1);
    expect(layoutFor(-3)).toHaveLength(1);
    expect(layoutFor(99)).toHaveLength(MAX_PANELS_PER_PAGE);
    expect(layoutFor(2.7)).toHaveLength(2);
  });

  it('gives an odd last panel of the grid the full width of its row', () => {
    const boxes = layoutFor(7);
    const last = boxes[6]!;
    expect(last.width).toBeCloseTo(0.92, 9);
  });
});

describe('the picture size of a panel', () => {
  it('draws about one megapixel, in steps of 64, in the shape of the panel', () => {
    const square = { x: 0, y: 0, width: 0.5, height: 0.5 / PAGE_ASPECT };
    const { width, height } = panelPixels(square);
    expect(width % 64).toBe(0);
    expect(height % 64).toBe(0);
    expect(Math.abs(width - height)).toBeLessThanOrEqual(64);
    expect(width * height).toBeGreaterThan(0.8 * 1024 * 1024);
  });

  it('keeps a tall panel tall and a wide one wide', () => {
    const tall = panelPixels({ x: 0, y: 0, width: 0.3, height: 0.8 });
    expect(tall.height).toBeGreaterThan(tall.width);
    const wide = panelPixels({ x: 0, y: 0, width: 0.9, height: 0.2 / PAGE_ASPECT });
    expect(wide.width).toBeGreaterThan(wide.height);
  });

  it('never goes below 256 or above 2048 on a side', () => {
    const thin = panelPixels({ x: 0, y: 0, width: 0.01, height: 1 });
    expect(thin.width).toBeGreaterThanOrEqual(256);
    expect(thin.height).toBeLessThanOrEqual(2048);
    const flat = panelPixels({ x: 0, y: 0, width: 1, height: 0.01 });
    expect(flat.width).toBeLessThanOrEqual(2048);
    expect(flat.height).toBeGreaterThanOrEqual(256);
  });
});

describe('the edge the frame of a panel is drawn along', () => {
  it('is the rectangle a panel of the automatic layout is drawn as, inside the gutter', () => {
    const page = emptyPage(3);
    frameOutlines(page).forEach((outline, i) => {
      const { box } = panelGeometry(page)[i]!;
      expect(outline).toEqual([
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y },
        { x: box.x + box.width, y: box.y + box.height },
        { x: box.x, y: box.y + box.height },
      ]);
    });
  });

  it('is the shape of a reshaped panel', () => {
    const page = emptyPage(3);
    const shaped = { ...page, shapes: pageShapes(page) };
    expect(frameOutlines(shaped)).toEqual(shaped.shapes);
  });
});
