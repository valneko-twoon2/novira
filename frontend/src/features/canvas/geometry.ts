// Pure math for the canvas: bbox handles and resizing, coverage. Bounds of drawn content are in ui/canvasDraw/bounds.
// Zoom and coordinate transforms come from the shared ui/zoomMath (also used by the image viewer) and are re-exported here.
import type { Rect } from '@/state/canvas';
import type { Point } from '@/ui/zoomMath';

export type { Point } from '@/ui/zoomMath';
export { containIn, docToScreen, fitRect, screenToDoc, stepZoom, zoomAt } from '@/ui/zoomMath';

export const snap = (v: number, step: number) => Math.round(v / step) * step;

export function normalizeRect(x0: number, y0: number, x1: number, y1: number): Rect {
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };
}

export type BboxHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const BBOX_HANDLES: BboxHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** Screen position of a handle on a screen-space rect. */
export function handlePoint(r: Rect, h: BboxHandle): Point {
  const x = h.includes('w') ? r.x : h.includes('e') ? r.x + r.width : r.x + r.width / 2;
  const y = h.includes('n') ? r.y : h.includes('s') ? r.y + r.height : r.y + r.height / 2;
  return { x, y };
}

/** Which handle (or the inside) of a screen-space rect is under the point. */
export function hitBbox(p: Point, r: Rect, tolerance = 8): BboxHandle | 'inside' | null {
  for (const h of BBOX_HANDLES) {
    const hp = handlePoint(r, h);
    if (Math.abs(p.x - hp.x) <= tolerance && Math.abs(p.y - hp.y) <= tolerance) return h;
  }
  if (p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height) return 'inside';
  return null;
}

export const HANDLE_CURSORS: Record<BboxHandle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

/** Resize a document-space rect by dragging a handle by (dx, dy). Sizes snap to `step`. */
export function resizeRect(start: Rect, handle: BboxHandle, dx: number, dy: number, opts: { step?: number; min?: number; ratio?: number | null } = {}): Rect {
  const step = opts.step ?? 8;
  const min = opts.min ?? 64;
  let { x, y, width, height } = start;
  const right = x + width;
  const bottom = y + height;
  if (handle.includes('e')) width = start.width + dx;
  if (handle.includes('w')) width = start.width - dx;
  if (handle.includes('s')) height = start.height + dy;
  if (handle.includes('n')) height = start.height - dy;
  width = Math.max(min, snap(width, step));
  height = Math.max(min, snap(height, step));
  if (opts.ratio) {
    const horizontalOnly = handle === 'e' || handle === 'w';
    const verticalOnly = handle === 'n' || handle === 's';
    if (verticalOnly) width = Math.max(min, snap(height * opts.ratio, step));
    else if (horizontalOnly) height = Math.max(min, snap(width / opts.ratio, step));
    else if (width / opts.ratio >= height) height = Math.max(min, snap(width / opts.ratio, step));
    else width = Math.max(min, snap(height * opts.ratio, step));
  }
  if (handle.includes('w')) x = right - width;
  if (handle.includes('n')) y = bottom - height;
  if (handle === 'n' || handle === 's') x = start.x + (start.width - width) / 2;
  if (handle === 'e' || handle === 'w') y = start.y + (start.height - height) / 2;
  return { x: Math.round(x), y: Math.round(y), width, height };
}

export type Coverage = 'empty' | 'full' | 'partial';

/** Classify RGBA pixel data by alpha: no pixels, all pixels, or some pixels covered. */
export function classifyCoverage(data: ArrayLike<number>, threshold = 0): Coverage {
  let covered = 0;
  let total = 0;
  for (let i = 3; i < data.length; i += 4) {
    total++;
    if ((data[i] as number) > threshold) covered++;
  }
  if (covered === 0) return 'empty';
  return covered === total ? 'full' : 'partial';
}

/** A one-step change to a layer's picture: a quarter turn, or twice / half the size, around the picture's centre. */
export type LayerTransform = 'rotateRight' | 'rotateLeft' | 'scaleUp' | 'scaleDown';

/** Where the picture of `r` lands after `op`: the same centre, a quarter turn swaps width and height, scaling is by 2 or 1/2. */
export function transformedRect(r: Rect, op: LayerTransform): Rect {
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const turned = op === 'rotateRight' || op === 'rotateLeft';
  const k = op === 'scaleUp' ? 2 : op === 'scaleDown' ? 0.5 : 1;
  const width = (turned ? r.height : r.width) * k;
  const height = (turned ? r.width : r.height) * k;
  return { x: Math.round(cx - width / 2), y: Math.round(cy - height / 2), width, height };
}
