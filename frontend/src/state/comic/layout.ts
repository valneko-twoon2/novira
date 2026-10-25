// Panel layout: where each panel of a page sits. A page without shapes has the automatic layout, decided by how many
// panels it has and how many columns. A page whose panels were reshaped (see shapes.ts) has a polygon per panel instead.
// Positions are fractions of the page, so the same layout draws at any size.

import { PAGE_SIZE_MM, type ComicPage, type ComicPoint, type PageSize, type ReadingDirection } from './document';
import { mirrorShapes, shapeBox, stitch, type Shape } from './shapes';

/** A rectangle as fractions of the page's width and height. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The page's height over its width for a paper size, to three decimals (the proportions of the paper). */
export function pageAspect(size: PageSize = 'A4'): number {
  const paper = PAGE_SIZE_MM[size];
  return Math.round((paper.height / paper.width) * 1000) / 1000;
}

/** The page's height over its width for the default paper, A4 (an A4-like portrait page). */
export const PAGE_ASPECT = pageAspect('A4');
/** Empty space around the panels, as a fraction of the page's width. */
const MARGIN = 0.04;
/** Space between two panels, as a fraction of the page's width. */
export const GUTTER = 0.02;
/**
 * The margin of a reshaped page's panel edges. Their gutter is drawn as a stroke of GUTTER width centred on each edge, so
 * the edges stop half a gutter inside the margin: the picture then ends where it does in the automatic layout.
 */
const SHAPE_MARGIN = MARGIN - GUTTER / 2;

/** The most panels one page holds. A page of 24 is still drawn large enough to read in its rows. */
export const MAX_PANELS_PER_PAGE = 24;

/** The fixed templates for the first few panel counts, in unit boxes (the whole page is 0 to 1). */
const TEMPLATES: Record<number, Box[]> = {
  1: [{ x: 0, y: 0, width: 1, height: 1 }],
  2: [
    { x: 0, y: 0, width: 1, height: 0.5 },
    { x: 0, y: 0.5, width: 1, height: 0.5 },
  ],
  3: [
    { x: 0, y: 0, width: 1, height: 0.5 },
    { x: 0, y: 0.5, width: 0.5, height: 0.5 },
    { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
  ],
  4: [
    { x: 0, y: 0, width: 0.5, height: 0.5 },
    { x: 0.5, y: 0, width: 0.5, height: 0.5 },
    { x: 0, y: 0.5, width: 0.5, height: 0.5 },
    { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
  ],
  // A wide top panel and a wide bottom one, two in each row between them: the usual "establishing" page.
  5: [
    { x: 0, y: 0, width: 0.5, height: 0.36 },
    { x: 0.5, y: 0, width: 0.5, height: 0.36 },
    { x: 0, y: 0.36, width: 1, height: 0.28 },
    { x: 0, y: 0.64, width: 0.5, height: 0.36 },
    { x: 0.5, y: 0.64, width: 0.5, height: 0.36 },
  ],
  6: [
    { x: 0, y: 0, width: 0.5, height: 1 / 3 },
    { x: 0.5, y: 0, width: 0.5, height: 1 / 3 },
    { x: 0, y: 1 / 3, width: 0.5, height: 1 / 3 },
    { x: 0.5, y: 1 / 3, width: 0.5, height: 1 / 3 },
    { x: 0, y: 2 / 3, width: 0.5, height: 1 / 3 },
    { x: 0.5, y: 2 / 3, width: 0.5, height: 1 / 3 },
  ],
};

/**
 * The columns of a page, rows filled left to right. A row that is not full (the last one) shares the page's width
 * between its panels, so an odd last panel of two columns takes the full width.
 */
function gridTemplate(count: number, columns: number): Box[] {
  const rows = Math.ceil(count / columns);
  const boxes: Box[] = [];
  for (let row = 0; row < rows; row++) {
    const inRow = Math.min(columns, count - row * columns);
    for (let j = 0; j < inRow; j++) boxes.push({ x: j / inRow, y: row / rows, width: 1 / inRow, height: 1 / rows });
  }
  return boxes;
}

/** Mirrored for a page read from the right: the first panel of each row sits at the right edge. */
function mirrored(boxes: Box[]): Box[] {
  return boxes.map((b) => ({ ...b, x: 1 - b.x - b.width }));
}

/**
 * Maps a unit box onto the page: the margin all round, and a gutter between two panels but never at the page's edge.
 * Everything is measured in page widths (the margin and the gutter are the same on every side), then divided by the
 * page's height to give the fractions the page uses.
 */
function inset(box: Box, aspect: number): Box {
  const eps = 1e-9;
  const inner = 1 - 2 * MARGIN;
  const innerHeight = aspect - 2 * MARGIN;
  const x1 = box.x + box.width;
  const y1 = box.y + box.height;
  const left = MARGIN + box.x * inner + (box.x > eps ? GUTTER / 2 : 0);
  const right = MARGIN + x1 * inner - (x1 < 1 - eps ? GUTTER / 2 : 0);
  const top = MARGIN + box.y * innerHeight + (box.y > eps ? GUTTER / 2 : 0);
  const bottom = MARGIN + y1 * innerHeight - (y1 < 1 - eps ? GUTTER / 2 : 0);
  return { x: left, y: top / aspect, width: right - left, height: (bottom - top) / aspect };
}

/** The unit boxes of the automatic layout: the template for the count, or the grid, mirrored for a page read from the right. */
function unitBoxes(count: number, columns: number, direction: ReadingDirection): Box[] {
  const n = Math.min(MAX_PANELS_PER_PAGE, Math.max(1, Math.floor(count)));
  const c = Math.min(3, Math.max(1, Math.floor(columns)));
  const unit = c === 2 && TEMPLATES[n] ? TEMPLATES[n]! : gridTemplate(n, c);
  return direction === 'rtl' ? mirrored(unit) : unit;
}

/** Where each panel of a page sits, in the page's own columns and reading direction. */
export function pageBoxes(page: { panels: unknown[]; columns: number; direction: ReadingDirection; size?: PageSize }): Box[] {
  return layoutFor(page.panels.length, page.columns, page.direction, pageAspect(page.size));
}

/**
 * Where each of `count` panels sits on the page, in reading order. The fixed templates are for two columns; other column
 * counts use the grid. A page read from the right mirrors the whole layout.
 */
export function layoutFor(count: number, columns = 2, direction: ReadingDirection = 'ltr', aspect = PAGE_ASPECT): Box[] {
  return unitBoxes(count, columns, direction).map((b) => inset(b, aspect));
}

/** A unit point (0 to 1 across the whole page) as a point of the page, with the margin of reshaped panels. */
export function toPage(u: number, v: number, aspect: number): ComicPoint {
  return { x: SHAPE_MARGIN + u * (1 - 2 * SHAPE_MARGIN), y: (SHAPE_MARGIN + v * (aspect - 2 * SHAPE_MARGIN)) / aspect };
}

/** A point of the page as a unit point (the inverse of toPage), so a shape can be read back in the units it is given in. */
export function fromPage(p: ComicPoint, aspect: number): ComicPoint {
  return { x: (p.x - SHAPE_MARGIN) / (1 - 2 * SHAPE_MARGIN), y: (p.y * aspect - SHAPE_MARGIN) / (aspect - 2 * SHAPE_MARGIN) };
}

/** A point moved to where a corner of a reshaped page may stand: inside the margin all round. */
export function clampToPage(p: ComicPoint, aspect: number): ComicPoint {
  const clamp = (v: number, low: number, high: number) => Math.min(high, Math.max(low, v));
  return { x: clamp(p.x, SHAPE_MARGIN, 1 - SHAPE_MARGIN), y: clamp(p.y, SHAPE_MARGIN / aspect, 1 - SHAPE_MARGIN / aspect) };
}

/**
 * A shape template (unit points) on a page: the points moved onto the page, its shared edges stitched, and flipped for a
 * page read from the right.
 */
export function templateShapes(unit: ComicPoint[][], aspect: number, direction: ReadingDirection): Shape[] {
  const shapes = stitch(unit.map((s) => s.map((p) => toPage(p.x, p.y, aspect))));
  return direction === 'rtl' ? mirrorShapes(shapes) : shapes;
}

/** The panels of the automatic layout as shapes: the rectangles of the unit boxes, on the page with the shape margin. */
export function autoShapes(count: number, columns = 2, direction: ReadingDirection = 'ltr', aspect = PAGE_ASPECT): Shape[] {
  return unitBoxes(count, columns, direction).map((b) =>
    [
      toPage(b.x, b.y, aspect),
      toPage(b.x + b.width, b.y, aspect),
      toPage(b.x + b.width, b.y + b.height, aspect),
      toPage(b.x, b.y + b.height, aspect),
    ],
  );
}

/** The shapes of a page's panels, reshaped or automatic. */
export function pageShapes(page: ComicPage): Shape[] {
  return page.shapes ?? autoShapes(page.panels.length, page.columns, page.direction, pageAspect(page.size));
}

/**
 * The edge each panel's frame is drawn along: its shape, or in the automatic layout the rectangle it is drawn as (the
 * automatic shapes tile the page, while the drawn rectangles keep a gutter between them, so a frame along the shape would
 * fall outside the panel).
 */
export function frameOutlines(page: ComicPage): Shape[] {
  return panelGeometry(page).map(
    ({ box, shape }) =>
      shape ?? [
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y },
        { x: box.x + box.width, y: box.y + box.height },
        { x: box.x, y: box.y + box.height },
      ],
  );
}

/**
 * Where each panel of a page is drawn: its box, and its shape when the page is reshaped (null for the automatic layout,
 * which is drawn as its rectangle).
 */
export function panelGeometry(page: ComicPage): { box: Box; shape: Shape | null }[] {
  if (page.shapes && page.shapes.length === page.panels.length) return page.shapes.map((shape) => ({ box: shapeBox(shape), shape }));
  return pageBoxes(page).map((box) => ({ box, shape: null }));
}

/**
 * The picture size a panel is drawn at: about one megapixel, in the panel's shape, with each side a multiple of 64
 * (the size the models draw best). A panel that is very wide or very tall gets the largest side at 2048 at most.
 */
export function panelPixels(box: Box, pageHeightOverWidth = PAGE_ASPECT, area = 1024 * 1024): { width: number; height: number } {
  const aspect = (box.width / (box.height * pageHeightOverWidth)) || 1;
  const snap = (v: number) => Math.min(2048, Math.max(256, Math.round(v / 64) * 64));
  return { width: snap(Math.sqrt(area * aspect)), height: snap(Math.sqrt(area / aspect)) };
}
