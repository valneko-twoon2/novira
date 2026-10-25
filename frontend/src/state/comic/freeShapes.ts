// Panels placed freely: on a free page each panel is a polygon of its own. The panels need not tile the page, so one may lie
// over another or leave a gap, and each is moved, turned and reshaped alone. A panel may run off the page (what lies outside
// is cut off when the page is drawn, an effect the user may want), but its middle stays on the page, so it can always be found
// and grabbed again, and its corners stay within OFF_PAGE of the page. Every change returns null when it cannot stand.
import type { ComicPoint } from './document';
import { isValidShape, MAX_SHAPE_CORNERS, type Shape } from './shapes';

/** How far past the page's edge a corner may go, as a share of the page's width or height. */
export const OFF_PAGE = 1;

const EPS = 1e-9;

const replaceAt = (shapes: Shape[], index: number, shape: Shape): Shape[] => shapes.map((s, i) => (i === index ? shape : s.map((p) => ({ ...p }))));
const clamp = (v: number, low: number, high: number) => Math.min(high, Math.max(low, v));

/** The middle of a shape's corners. */
export function shapeCentre(shape: Shape): ComicPoint {
  return { x: shape.reduce((s, p) => s + p.x, 0) / shape.length, y: shape.reduce((s, p) => s + p.y, 0) / shape.length };
}

/**
 * The shape shifted, if need be, so that its middle lies on the page; null when a corner would then be too far off it. The
 * rest of it may run off the page.
 */
export function keepOnPage(shape: Shape): Shape | null {
  const c = shapeCentre(shape);
  const dx = clamp(c.x, 0, 1) - c.x;
  const dy = clamp(c.y, 0, 1) - c.y;
  const moved = dx || dy ? shape.map((p) => ({ x: p.x + dx, y: p.y + dy })) : shape.map((p) => ({ ...p }));
  return moved.every((p) => p.x >= -OFF_PAGE - EPS && p.x <= 1 + OFF_PAGE + EPS && p.y >= -OFF_PAGE - EPS && p.y <= 1 + OFF_PAGE + EPS) ? moved : null;
}

/** The shape as a free panel: its middle kept on the page, and valid. Null when it cannot be. */
function settle(shape: Shape): Shape | null {
  const kept = keepOnPage(shape);
  return kept && isValidShape(kept) ? kept : null;
}

/** The shape moved by `delta` (fractions of the page); its middle is stopped at the page's edge. */
export function translateShape(shape: Shape, delta: ComicPoint): Shape | null {
  return settle(shape.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y })));
}

/**
 * The shape turned by `angle` radians (clockwise on screen) about its middle. Distances are measured on the paper, so the
 * page's height over its width (`aspect`) is part of the turn: a square panel stays square. Its middle does not move, so it
 * stays on the page; null when a corner would go too far off the page.
 */
export function rotateShape(shape: Shape, angle: number, aspect: number): Shape | null {
  const c = shapeCentre(shape);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return settle(
    shape.map((p) => {
      const dx = p.x - c.x;
      const dy = (p.y - c.y) * aspect;
      return { x: c.x + dx * cos - dy * sin, y: c.y + (dx * sin + dy * cos) / aspect };
    }),
  );
}

/** How far a shape is turned from upright, in radians (within a quarter turn): the tilt of its first edge off the nearest axis. */
export function shapeTilt(shape: Shape, aspect: number): number {
  const a = shape[0];
  const b = shape[1];
  if (!a || !b) return 0;
  const angle = Math.atan2((b.y - a.y) * aspect, b.x - a.x);
  const quarter = Math.PI / 2;
  return angle - Math.round(angle / quarter) * quarter;
}

/** Corner `corner` of panel `panel` moved to `to`, the other panels untouched. */
export function moveCornerFree(shapes: Shape[], panel: number, corner: number, to: ComicPoint): Shape[] | null {
  const shape = shapes[panel];
  if (!shape?.[corner]) return null;
  const next = settle(shape.map((p, i) => (i === corner ? { x: clamp(to.x, -OFF_PAGE, 1 + OFF_PAGE), y: clamp(to.y, -OFF_PAGE, 1 + OFF_PAGE) } : p)));
  return next ? replaceAt(shapes, panel, next) : null;
}

/** The edge starting at corner `edge` of panel `panel` moved by `delta`, the other panels untouched. */
export function moveEdgeFree(shapes: Shape[], panel: number, edge: number, delta: ComicPoint): Shape[] | null {
  const shape = shapes[panel];
  if (!shape?.[edge]) return null;
  const to = (edge + 1) % shape.length;
  const next = settle(shape.map((p, i) => (i === edge || i === to ? { x: clamp(p.x + delta.x, -OFF_PAGE, 1 + OFF_PAGE), y: clamp(p.y + delta.y, -OFF_PAGE, 1 + OFF_PAGE) } : p)));
  return next ? replaceAt(shapes, panel, next) : null;
}

/** A corner added at `point` on the edge that starts at corner `edge` of panel `panel`. */
export function insertCornerFree(shapes: Shape[], panel: number, edge: number, point: ComicPoint): Shape[] | null {
  const shape = shapes[panel];
  if (!shape || shape.length >= MAX_SHAPE_CORNERS) return null;
  const next = shape.map((p) => ({ ...p }));
  next.splice(edge + 1, 0, { ...point });
  return isValidShape(next) ? replaceAt(shapes, panel, next) : null;
}

/** Corner `corner` of panel `panel` taken away (a panel keeps at least three corners). */
export function removeCornerFree(shapes: Shape[], panel: number, corner: number): Shape[] | null {
  const shape = shapes[panel];
  if (!shape?.[corner]) return null;
  const next = shape.filter((_, i) => i !== corner);
  return isValidShape(next) ? replaceAt(shapes, panel, next) : null;
}

/** A new panel, a rectangle a third of the page wide, set a little off the middle for each panel already there. */
export function addFreeShape(shapes: Shape[], aspect: number): Shape[] {
  const width = 1 / 3;
  const height = width / aspect;
  const step = 0.04 * (shapes.length % 6);
  const x = Math.min(1 - width, 0.5 - width / 2 + step);
  const y = Math.min(1 - height, 0.5 - height / 2 + step);
  const rect: Shape = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
  return [...shapes.map((s) => s.map((p) => ({ ...p }))), rect];
}

/** A shape given for a free page, checked: a valid panel as it is (no shifting), with its middle on the page and no corner too far off it. */
export function isFreeShape(shape: Shape): boolean {
  const c = shapeCentre(shape);
  return isValidShape(shape) && c.x >= 0 && c.x <= 1 && c.y >= 0 && c.y <= 1 && shape.every((p) => Math.abs(p.x - 0.5) <= 0.5 + OFF_PAGE && Math.abs(p.y - 0.5) <= 0.5 + OFF_PAGE);
}
