// Pure zoom / pan math shared by the canvas stage and the image viewer: a view maps document (image) pixels to screen
// pixels as `screen = doc * scale + offset`. Same limits, wheel speed and zoom presets everywhere.

export interface Point {
  x: number;
  y: number;
}

/** Screen offset of the document origin plus the document-to-screen scale. */
export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export const MIN_SCALE = 0.05;
export const MAX_SCALE = 20;
const ZOOM_STEPS = [0.05, 0.1, 0.125, 0.25, 0.333, 0.5, 0.667, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8, 12, 16, 20];
/** Zoom presets offered in the percentage menus. */
export const ZOOM_PRESETS = [0.25, 0.5, 1, 2, 4];
/** From this scale up, pixels are drawn without smoothing (pixelated). */
export const PIXELATED_SCALE = 2;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const clampScale = (scale: number) => clamp(scale, MIN_SCALE, MAX_SCALE);

export function screenToDoc(p: Point, v: ViewTransform): Point {
  return { x: (p.x - v.x) / v.scale, y: (p.y - v.y) / v.scale };
}

export function docToScreen(p: Point, v: ViewTransform): Point {
  return { x: p.x * v.scale + v.x, y: p.y * v.scale + v.y };
}

/** Screen rect of a document-space rect. */
export function boxToScreen(b: Box, v: ViewTransform): Box {
  const p = docToScreen(b, v);
  return { x: p.x, y: p.y, width: b.width * v.scale, height: b.height * v.scale };
}

/** Zoom to `scale` (clamped) keeping the document point under `anchor` (screen) fixed. */
export function zoomAt(v: ViewTransform, anchor: Point, scale: number): ViewTransform {
  const s = clampScale(scale);
  const doc = screenToDoc(anchor, v);
  return { scale: s, x: anchor.x - doc.x * s, y: anchor.y - doc.y * s };
}

/** Next zoom preset in a direction (+1 in, -1 out). */
export function stepZoom(scale: number, dir: 1 | -1): number {
  if (dir > 0) return ZOOM_STEPS.find((z) => z > scale + 1e-3) ?? MAX_SCALE;
  return [...ZOOM_STEPS].reverse().find((z) => z < scale - 1e-3) ?? MIN_SCALE;
}

/** Scale multiplier for one wheel event (mouse wheel, Ctrl+wheel and trackpad pinch alike). */
export function wheelZoomFactor(e: Pick<WheelEvent, 'deltaY' | 'deltaMode'>): number {
  return Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
}

/** View that fits (contains) `rect` into a stage of the given size, centered, with padding. */
export function fitRect(rect: Box, stageW: number, stageH: number, padding = 48): ViewTransform {
  const w = Math.max(1, stageW - padding * 2);
  const h = Math.max(1, stageH - padding * 2);
  const scale = clampScale(Math.min(w / Math.max(1, rect.width), h / Math.max(1, rect.height)));
  return {
    scale,
    x: stageW / 2 - (rect.x + rect.width / 2) * scale,
    y: stageH / 2 - (rect.y + rect.height / 2) * scale,
  };
}

/**
 * Keep content of `content` size (document origin at 0,0) reachable: along an axis where it is smaller than the stage
 * it is centered, otherwise its edges may not move inside the stage.
 */
export function clampPan(v: ViewTransform, content: Size, stage: Size): ViewTransform {
  const axis = (pos: number, length: number, stageLength: number) =>
    length <= stageLength ? (stageLength - length) / 2 : clamp(pos, stageLength - length, 0);
  return { scale: v.scale, x: axis(v.x, content.width * v.scale, stage.width), y: axis(v.y, content.height * v.scale, stage.height) };
}

/** Whether the content overflows the stage, so dragging can move it. */
export function canPan(v: ViewTransform, content: Size, stage: Size): boolean {
  return content.width * v.scale > stage.width + 0.5 || content.height * v.scale > stage.height + 0.5;
}

/** Fit (contain) a w×h box into a rect, centered, in whole pixels. */
export function containIn(w: number, h: number, r: Box): Box {
  const s = Math.min(r.width / Math.max(1, w), r.height / Math.max(1, h));
  const width = Math.round(w * s);
  const height = Math.round(h * s);
  return { x: Math.round(r.x + (r.width - width) / 2), y: Math.round(r.y + (r.height - height) / 2), width, height };
}
