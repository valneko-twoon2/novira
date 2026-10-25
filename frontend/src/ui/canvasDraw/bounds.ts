// Bounds of drawn canvas content: the union of rectangles and the local-space extent of a layer's objects.
import type { CanvasObject, Rect } from '@/state/canvas';

export function unionRect(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}

function intersectRect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.width, b.x + b.width);
  const btm = Math.min(a.y + a.height, b.y + b.height);
  if (r <= x || btm <= y) return null;
  return { x, y, width: r - x, height: btm - y };
}

/** Local-space bounds of a single object (strokes include their width). */
function objectBounds(o: CanvasObject): Rect | null {
  if (o.kind === 'stroke') {
    if (o.points.length < 2) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i + 1 < o.points.length; i += 2) {
      const px = o.points[i] as number;
      const py = o.points[i + 1] as number;
      x0 = Math.min(x0, px);
      y0 = Math.min(y0, py);
      x1 = Math.max(x1, px);
      y1 = Math.max(y1, py);
    }
    const r = o.width / 2 + 1;
    const b = { x: x0 - r, y: y0 - r, width: x1 - x0 + r * 2, height: y1 - y0 + r * 2 };
    return o.clip ? intersectRect(b, o.clip) : b;
  }
  if (o.kind === 'pose') {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i + 1 < o.points.length; i += 2) {
      if (o.hidden.includes(i / 2)) continue;
      x0 = Math.min(x0, o.points[i] as number);
      y0 = Math.min(y0, o.points[i + 1] as number);
      x1 = Math.max(x1, o.points[i] as number);
      y1 = Math.max(y1, o.points[i + 1] as number);
    }
    if (x0 === Infinity) return null;
    const r = o.width + 1;
    return { x: x0 - r, y: y0 - r, width: x1 - x0 + r * 2, height: y1 - y0 + r * 2 };
  }
  if (o.width <= 0 || o.height <= 0) return null;
  return { x: o.x, y: o.y, width: o.width, height: o.height };
}

/** Bounds of drawn content. Eraser and mosaic strokes only change what is already there, so they never grow the bounds. */
export function objectsBounds(objects: CanvasObject[]): Rect | null {
  let r: Rect | null = null;
  for (const o of objects) {
    if (o.kind === 'stroke' && o.tool !== 'brush') continue;
    r = unionRect(r, objectBounds(o));
  }
  return r;
}
