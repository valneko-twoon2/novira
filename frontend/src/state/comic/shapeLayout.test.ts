import { describe, expect, it } from 'vitest';
import { DEFAULT_IMAGE_VIEW, newComicId, type ComicPage, type ComicPoint } from './document';
import { defaultPageCanvas } from './pageCanvasDoc';
import { autoShapes, clampToPage, panelGeometry, pageAspect, templateShapes, toPage } from './layout';
import { isValidShape, shapeArea, shapeBox, type Shape } from './shapes';
import { BUILTIN_SHAPE_LAYOUTS } from './templates';

const aspect = pageAspect('A4');
/** The area of the page inside its margin, in page fractions (the panels fill it when they tile the page). */
const SHAPE_MARGIN = 0.03;
const inner = (1 - 2 * SHAPE_MARGIN) * (1 - (2 * SHAPE_MARGIN) / aspect);

const page = (shapes: Shape[] | null, panels = shapes?.length ?? 2): ComicPage => ({
  id: newComicId('page'),
  panels: Array.from({ length: panels }, () => ({
    id: newComicId('panel'),
    prompt: '',
    negativePrompt: '',
    note: '',
    imageName: null,
    imageView: { ...DEFAULT_IMAGE_VIEW },
    takes: [],
    poses: [],
    poseImageName: null,
    cast: [],
    figures: [],
    bubbles: [],
  })),
  columns: 2,
  direction: 'ltr',
  size: 'A4',
  shapes,
  free: false,
  backdrop: null,
  effect: null,
  frameMm: 0.6,
  insetMm: 0,
  marginMm: 0,
  frameColor: '#000000',
  canvas: defaultPageCanvas('A4'),
});

describe('the shape templates', () => {
  for (const layout of BUILTIN_SHAPE_LAYOUTS) {
    it(`${layout.id} fills the page with valid panels, with no gap and no overlap`, () => {
      const shapes = templateShapes(layout.shapes, aspect, 'ltr');
      expect(shapes.length).toBe(layout.shapes.length);
      for (const s of shapes) {
        expect(isValidShape(s)).toBe(true);
        for (const p of s) {
          expect(p.x).toBeGreaterThanOrEqual(SHAPE_MARGIN - 1e-9);
          expect(p.x).toBeLessThanOrEqual(1 - SHAPE_MARGIN + 1e-9);
          expect(p.y).toBeGreaterThanOrEqual(SHAPE_MARGIN / aspect - 1e-9);
          expect(p.y).toBeLessThanOrEqual(1 - SHAPE_MARGIN / aspect + 1e-9);
        }
      }
      // Panels that overlap would add up to more than the page, and a gap to less.
      expect(shapes.reduce((total, s) => total + shapeArea(s), 0)).toBeCloseTo(inner, 6);
    });
  }

  it('flips a template for a page read from the right', () => {
    const bigLeft = BUILTIN_SHAPE_LAYOUTS.find((l) => l.id === 'bigleft')!;
    const ltr = templateShapes(bigLeft.shapes, aspect, 'ltr');
    const rtl = templateShapes(bigLeft.shapes, aspect, 'rtl');
    expect(shapeBox(ltr[0]!).x).toBeCloseTo(SHAPE_MARGIN);
    expect(shapeBox(rtl[0]!).x + shapeBox(rtl[0]!).width).toBeCloseTo(1 - SHAPE_MARGIN);
  });
});

describe('the automatic layout as shapes', () => {
  it('gives one rectangle for each panel, filling the page', () => {
    const shapes = autoShapes(4, 2, 'ltr', aspect);
    expect(shapes).toHaveLength(4);
    expect(shapes.every((s) => s.length === 4)).toBe(true);
    expect(shapes.reduce((total, s) => total + shapeArea(s), 0)).toBeCloseTo(inner, 6);
  });
});

describe('the geometry of a page', () => {
  it('gives the automatic boxes for a page without shapes, and the shapes\' own boxes for a reshaped page', () => {
    const plain = panelGeometry(page(null, 3));
    expect(plain.every((g) => g.shape === null)).toBe(true);
    expect(plain).toHaveLength(3);

    const shapes = templateShapes(BUILTIN_SHAPE_LAYOUTS.find((l) => l.id === 'strips')!.shapes, aspect, 'ltr');
    const reshaped = panelGeometry(page(shapes));
    expect(reshaped.map((g) => g.shape)).toEqual(shapes);
    expect(reshaped[1]!.box.x).toBeCloseTo(shapeBox(shapes[1]!).x);
  });

  it('falls back to the automatic layout when the shapes are not one for each panel', () => {
    const shapes = templateShapes(BUILTIN_SHAPE_LAYOUTS[0]!.shapes, aspect, 'ltr');
    const geometry = panelGeometry(page(shapes, 5));
    expect(geometry.every((g) => g.shape === null)).toBe(true);
    expect(geometry).toHaveLength(5);
  });
});

describe('moving points onto a page', () => {
  it('keeps a point inside the margin all round', () => {
    expect(clampToPage({ x: -1, y: 2 }, aspect)).toEqual({ x: SHAPE_MARGIN, y: 1 - SHAPE_MARGIN / aspect });
    expect(clampToPage({ x: 0.5, y: 0.5 }, aspect)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('maps the corners of the unit page onto the margin', () => {
    const corner: ComicPoint = toPage(0, 0, aspect);
    expect(corner.x).toBeCloseTo(SHAPE_MARGIN);
    expect(corner.y).toBeCloseTo(SHAPE_MARGIN / aspect);
    expect(toPage(1, 1, aspect).y).toBeCloseTo(1 - SHAPE_MARGIN / aspect);
  });
});
