// Renders one entity (its objects) into an offscreen canvas in entity-local space, with caching.
import type { CanvasEntity, CanvasObject, FilterPreview, MaskFill, RGBA, StrokeObject } from '@/state/canvas';
import { objectsBounds } from './bounds';
import { getImage, imageVersion } from './imageCache';
import { rgbaCss } from './rgbaCss';
import { drawPose } from '@/state/pose/pose';

export interface Rendered {
  canvas: HTMLCanvasElement;
  /** Local-space position and size of the canvas. */
  x: number;
  y: number;
  width: number;
  height: number;
}

const MAX_DIM = 8192;
const MAX_EFFECT_PIXELS = 4096 * 4096;

/** The canvas operation that draws a layer over the layers under it: its blend for a raster layer, else normal. */
export function blendOperation(e: CanvasEntity): GlobalCompositeOperation {
  if (e.type !== 'raster' || !e.blend || e.blend === 'normal') return 'source-over';
  return e.blend;
}

export function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/**
 * Pixelates what the entity has drawn so far under a mosaic stroke. The blocks sit on a grid anchored at the entity's
 * origin (not at the canvas edge), so a mosaic does not shift when later objects move the canvas.
 */
function drawMosaic(ctx: CanvasRenderingContext2D, o: StrokeObject) {
  const block = Math.max(2, Math.round(o.block ?? 16));
  const { e: tx, f: ty } = ctx.getTransform();
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  // Canvas pixel 0 is `-tx` in entity space; the grid line before it is `sx` pixels earlier.
  const sx = ((-tx % block) + block) % block;
  const sy = ((-ty % block) + block) % block;
  const gw = Math.ceil((w + sx) / block);
  const gh = Math.ceil((h + sy) / block);
  const grid = createCanvas(gw * block, gh * block);
  const gctx = grid.getContext('2d') as CanvasRenderingContext2D;
  gctx.drawImage(ctx.canvas, sx, sy);
  const small = createCanvas(gw, gh);
  const sctx = small.getContext('2d') as CanvasRenderingContext2D;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(grid, 0, 0, gw, gh);
  gctx.clearRect(0, 0, grid.width, grid.height);
  gctx.imageSmoothingEnabled = false;
  gctx.drawImage(small, 0, 0, gw * block, gh * block);
  // The stroke's shape, in the same pixels as the entity canvas.
  const shape = createCanvas(w, h);
  const mctx = shape.getContext('2d') as CanvasRenderingContext2D;
  mctx.setTransform(ctx.getTransform());
  if (o.clip) {
    mctx.beginPath();
    mctx.rect(o.clip.x, o.clip.y, o.clip.width, o.clip.height);
    mctx.clip();
  }
  drawStrokeShape(mctx, o);
  const pixelated = createCanvas(w, h);
  const pctx = pixelated.getContext('2d') as CanvasRenderingContext2D;
  pctx.drawImage(grid, -sx, -sy);
  pctx.globalCompositeOperation = 'destination-in';
  pctx.drawImage(shape, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(shape, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(pixelated, 0, 0);
}

/** The round-capped path of a stroke, in opaque white. */
function drawStrokeShape(ctx: CanvasRenderingContext2D, o: StrokeObject) {
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = o.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const pts = o.points;
  ctx.beginPath();
  if (pts.length <= 2 || (pts.length === 4 && pts[0] === pts[2] && pts[1] === pts[3])) {
    ctx.arc(pts[0] as number, pts[1] as number, o.width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.moveTo(pts[0] as number, pts[1] as number);
  for (let i = 2; i + 1 < pts.length; i += 2) ctx.lineTo(pts[i] as number, pts[i + 1] as number);
  ctx.stroke();
}

/** Draw raw objects. In mask mode everything is drawn opaque white so it can be tinted afterwards. */
function drawObjects(ctx: CanvasRenderingContext2D, objects: CanvasObject[], maskMode: boolean) {
  for (const o of objects) {
    ctx.save();
    if (o.kind === 'stroke' && o.tool === 'mosaic') {
      drawMosaic(ctx, o);
    } else if (o.kind === 'stroke') {
      if (o.clip) {
        ctx.beginPath();
        ctx.rect(o.clip.x, o.clip.y, o.clip.width, o.clip.height);
        ctx.clip();
      }
      ctx.globalCompositeOperation = o.tool === 'eraser' ? 'destination-out' : 'source-over';
      const color = maskMode || o.tool === 'eraser' ? '#ffffff' : rgbaCss(o.color);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = o.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const pts = o.points;
      if (pts.length <= 2 || (pts.length === 4 && pts[0] === pts[2] && pts[1] === pts[3])) {
        ctx.beginPath();
        ctx.arc(pts[0] as number, pts[1] as number, o.width / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(pts[0] as number, pts[1] as number);
        for (let i = 2; i + 1 < pts.length; i += 2) ctx.lineTo(pts[i] as number, pts[i + 1] as number);
        ctx.stroke();
      }
    } else if (o.kind === 'rect') {
      ctx.fillStyle = maskMode ? '#ffffff' : rgbaCss(o.color);
      ctx.fillRect(o.x, o.y, o.width, o.height);
    } else if (o.kind === 'pose') {
      drawPose(ctx, o, maskMode);
    } else {
      const img = getImage(o.url);
      if (img && (o.flipX || o.flipY)) {
        ctx.translate(o.x + (o.flipX ? o.width : 0), o.y + (o.flipY ? o.height : 0));
        ctx.scale(o.flipX ? -1 : 1, o.flipY ? -1 : 1);
        ctx.drawImage(img, 0, 0, o.width, o.height);
      } else if (img) {
        ctx.drawImage(img, o.x, o.y, o.width, o.height);
      }
    }
    ctx.restore();
  }
}

const patternCache = new Map<string, HTMLCanvasElement>();

function patternTile(color: RGBA, fill: MaskFill): HTMLCanvasElement {
  const key = `${color.r},${color.g},${color.b}|${fill}`;
  let tile = patternCache.get(key);
  if (tile) return tile;
  tile = createCanvas(16, 16);
  const ctx = tile.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = rgbaCss(color, 0.3);
  ctx.fillRect(0, 0, 16, 16);
  ctx.strokeStyle = rgbaCss(color, 1);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  if (fill === 'diagonal' || fill === 'crosshatch') {
    ctx.moveTo(-4, 20);
    ctx.lineTo(20, -4);
    ctx.moveTo(-4, 4);
    ctx.lineTo(4, -4);
    ctx.moveTo(12, 20);
    ctx.lineTo(20, 12);
  }
  if (fill === 'crosshatch') {
    ctx.moveTo(-4, -4);
    ctx.lineTo(20, 20);
    ctx.moveTo(12, -4);
    ctx.lineTo(20, 4);
    ctx.moveTo(-4, 12);
    ctx.lineTo(4, 20);
  }
  if (fill === 'grid' || fill === 'horizontal') {
    ctx.moveTo(0, 8);
    ctx.lineTo(16, 8);
  }
  if (fill === 'grid' || fill === 'vertical') {
    ctx.moveTo(8, 0);
    ctx.lineTo(8, 16);
  }
  ctx.stroke();
  patternCache.set(key, tile);
  return tile;
}

/** Fill style for a mask: solid color or a line pattern in the mask color. */
function maskFillStyle(ctx: CanvasRenderingContext2D, color: RGBA, fill: MaskFill): string | CanvasPattern {
  if (fill === 'solid') return rgbaCss(color, 1);
  return ctx.createPattern(patternTile(color, fill), 'repeat') ?? rgbaCss(color, 1);
}

/** Dark pixels become transparent (InvokeAI control layer "transparency effect"). */
function applyTransparencyEffect(ctx: CanvasRenderingContext2D, w: number, h: number) {
  if (w * h > MAX_EFFECT_PIXELS) return;
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * (d[i] as number) + 0.587 * (d[i + 1] as number) + 0.114 * (d[i + 2] as number);
    d[i + 3] = Math.round(((d[i + 3] as number) * lum) / 255);
  }
  ctx.putImageData(data, 0, 0);
}

interface CacheEntry {
  key: string;
  out: Rendered | null;
}
const cache = new WeakMap<CanvasObject[], CacheEntry>();

function styleKey(e: CanvasEntity, preview: FilterPreview | undefined): string {
  if (e.type === 'inpaint' || e.type === 'regional') return `${e.color.r},${e.color.g},${e.color.b}|${e.fill}`;
  if (e.type === 'control') return `${e.withTransparencyEffect}|${preview?.url ?? ''}`;
  return '';
}

/** Raw render without tint or effects (used by filters, export and thumbnails of masks as shapes). */
function renderObjects(objects: CanvasObject[], maskMode = false): Rendered | null {
  const b = objectsBounds(objects);
  if (!b) return null;
  const x = Math.floor(b.x);
  const y = Math.floor(b.y);
  const width = Math.min(MAX_DIM, Math.ceil(b.x + b.width) - x);
  const height = Math.min(MAX_DIM, Math.ceil(b.y + b.height) - y);
  if (width <= 0 || height <= 0) return null;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.translate(-x, -y);
  drawObjects(ctx, objects, maskMode);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return { canvas, x, y, width, height };
}

/** A mask layer's shape in one opaque grey (the generation mask), not cached. */
export function renderMaskShape(e: CanvasEntity, grey: number): Rendered | null {
  const out = renderObjects(e.objects, true);
  if (!out) return null;
  const ctx = out.canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = `rgb(${grey}, ${grey}, ${grey})`;
  ctx.fillRect(0, 0, out.canvas.width, out.canvas.height);
  return out;
}

/** A control layer as ControlNet sees it: its filter preview, else its pixels, without the display effect. */
export function renderControlImage(e: CanvasEntity, preview?: FilterPreview): Rendered | null {
  if (preview) {
    const img = getImage(preview.url);
    const canvas = createCanvas(preview.width, preview.height);
    if (img) (canvas.getContext('2d') as CanvasRenderingContext2D).drawImage(img, 0, 0, preview.width, preview.height);
    return { canvas, x: preview.x, y: preview.y, width: preview.width, height: preview.height };
  }
  return renderObjects(e.objects);
}

/** Render an entity for display. `extra` is an in-progress object drawn on top (not cached). */
export function renderEntity(e: CanvasEntity, opts: { extra?: CanvasObject | null; preview?: FilterPreview } = {}): Rendered | null {
  const { extra, preview } = opts;
  const key = `${imageVersion()}|${styleKey(e, preview)}`;
  if (!extra) {
    const hit = cache.get(e.objects);
    if (hit && hit.key === key) return hit.out;
  }
  let out: Rendered | null;
  const isMask = e.type === 'inpaint' || e.type === 'regional';
  if (e.type === 'control' && preview) {
    const img = getImage(preview.url);
    const canvas = createCanvas(preview.width, preview.height);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    if (img) ctx.drawImage(img, 0, 0, preview.width, preview.height);
    out = { canvas, x: preview.x, y: preview.y, width: preview.width, height: preview.height };
  } else {
    out = renderObjects(extra ? [...e.objects, extra] : e.objects, isMask);
  }
  if (out) {
    const ctx = out.canvas.getContext('2d') as CanvasRenderingContext2D;
    if (isMask) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = maskFillStyle(ctx, e.color, e.fill);
      ctx.fillRect(0, 0, out.canvas.width, out.canvas.height);
      ctx.restore();
    } else if (e.type === 'control' && e.withTransparencyEffect) {
      applyTransparencyEffect(ctx, out.canvas.width, out.canvas.height);
    }
  }
  if (!extra) cache.set(e.objects, { key, out });
  return out;
}
