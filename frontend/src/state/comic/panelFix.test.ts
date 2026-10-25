import { describe, expect, it } from 'vitest';
import { DEFAULT_IMAGE_VIEW } from './document';
import { applyMatrix, extendFix, FIX_LIMITS, hasFix, panelToPicture, readFixBoxes } from './panelFix';

const near = (p: { x: number; y: number }, x: number, y: number) => {
  expect(p.x).toBeCloseTo(x, 6);
  expect(p.y).toBeCloseTo(y, 6);
};

describe('panelToPicture', () => {
  it('maps the panel onto a picture of its own shape that covers it, corner to corner', () => {
    const m = panelToPicture(DEFAULT_IMAGE_VIEW, { width: 800, height: 1200 }, { width: 2, height: 3 });
    near(applyMatrix(m, 0, 0), 0, 0);
    near(applyMatrix(m, 1, 1.5), 400, 600);
    near(applyMatrix(m, 2, 3), 800, 1200);
  });

  it('crops a wider picture at its sides, as covering the panel does', () => {
    // A 2:1 picture in a square panel shows its middle half: the panel's left edge is a quarter into the picture.
    const m = panelToPicture(DEFAULT_IMAGE_VIEW, { width: 2000, height: 1000 }, { width: 1, height: 1 });
    near(applyMatrix(m, 0, 0), 500, 0);
    near(applyMatrix(m, 1, 1), 1500, 1000);
  });

  it('follows a picture moved and enlarged in its panel', () => {
    // Twice as big, its centre at the panel's top-left corner: that corner is the picture's centre.
    const m = panelToPicture({ ...DEFAULT_IMAGE_VIEW, cx: 0, cy: 0, scale: 2 }, { width: 100, height: 100 }, { width: 1, height: 1 });
    near(applyMatrix(m, 0, 0), 50, 50);
    near(applyMatrix(m, 0.5, 0.5), 75, 75);
  });

  it('turns a point back by the picture turn: a quarter turn clockwise sends the panel top to the picture left', () => {
    const m = panelToPicture({ ...DEFAULT_IMAGE_VIEW, rotation: 90 }, { width: 100, height: 100 }, { width: 1, height: 1 });
    // The top middle of the panel shows the left middle of the turned picture.
    near(applyMatrix(m, 0.5, 0), 0, 50);
  });

  it('mirrors a point for a mirrored picture', () => {
    const m = panelToPicture({ ...DEFAULT_IMAGE_VIEW, flipX: true }, { width: 100, height: 100 }, { width: 1, height: 1 });
    near(applyMatrix(m, 0, 0.5), 100, 50);
    const v = panelToPicture({ ...DEFAULT_IMAGE_VIEW, flipY: true }, { width: 100, height: 100 }, { width: 1, height: 1 });
    near(applyMatrix(v, 0.5, 0), 50, 100);
  });

  it('gives the same pixels whatever unit the panel is measured in', () => {
    const view = { ...DEFAULT_IMAGE_VIEW, cx: 0.4, scale: 1.3, rotation: 20 };
    const a = panelToPicture(view, { width: 640, height: 960 }, { width: 1, height: 1.25 });
    const b = panelToPicture(view, { width: 640, height: 960 }, { width: 1000, height: 1250 });
    const pa = applyMatrix(a, 0.3, 0.9);
    const pb = applyMatrix(b, 300, 900);
    near(pa, pb.x, pb.y);
  });
});

describe('extendFix', () => {
  it('keeps the points inside the panel and skips points too close to the last one', () => {
    let s = extendFix({ points: [], width: 0.05 }, -0.2, 1.4, 1);
    expect(s.points).toEqual([0, 1]);
    s = extendFix(s, 0.001, 1, 1);
    expect(s.points).toHaveLength(2);
    s = extendFix(s, 0.1, 0.9, 1);
    expect(s.points).toEqual([0, 1, 0.1, 0.9]);
  });

  it('stops growing at the most points a stroke keeps', () => {
    const full = { points: Array.from({ length: FIX_LIMITS.points * 2 }, (_, i) => (i % 2 ? 0.5 : (i / 2) / FIX_LIMITS.points)), width: 0.05 };
    expect(extendFix(full, 0.9, 0.1, 1)).toBe(full);
  });
});

describe('readFixBoxes', () => {
  it('reads boxes in fractions of the panel and keeps them inside it', () => {
    expect(readFixBoxes([{ x: 0.8, y: -0.1, w: 0.5, h: 0.3 }])).toEqual([{ x: 0.8, y: 0, w: expect.closeTo(0.2, 9), h: 0.3 }]);
  });

  it('takes one box given alone, and leaves out what is not four numbers or is too small to redraw', () => {
    expect(readFixBoxes({ x: 0.1, y: 0.1, w: 0.2, h: 0.2 })).toHaveLength(1);
    expect(readFixBoxes([{ x: 0.1, y: 0.1, w: 0.01, h: 0.5 }, { x: '0', y: 0, w: 1, h: 1 }, null, 'box'])).toEqual([]);
    expect(readFixBoxes(undefined)).toEqual([]);
  });

  it('keeps at most the boxes a mask holds', () => {
    expect(readFixBoxes(Array.from({ length: 20 }, () => ({ x: 0, y: 0, w: 0.5, h: 0.5 })))).toHaveLength(FIX_LIMITS.boxes);
  });
});

describe('hasFix', () => {
  it('asks for a redraw only with a box or a stroke of at least one point', () => {
    expect(hasFix({ strokes: [], boxes: [] })).toBe(false);
    expect(hasFix({ strokes: [{ points: [], width: 0.1 }], boxes: [] })).toBe(false);
    expect(hasFix({ strokes: [{ points: [0.5, 0.5], width: 0.1 }], boxes: [] })).toBe(true);
    expect(hasFix({ strokes: [], boxes: [{ x: 0, y: 0, w: 0.5, h: 0.5 }] })).toBe(true);
  });
});
