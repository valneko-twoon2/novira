// Offscreen compositing of canvas layers: flatten them inside a rect, their content bounds, export to blobs and URLs.
import type { CanvasEntity, FilterPreview, Rect } from '@/state/canvas';
import { objectsBounds } from './bounds';
import { blendOperation, createCanvas, renderEntity } from './entityRender';
import { preloadImages } from './imageCache';

export function imageUrlsOf(entities: CanvasEntity[]): string[] {
  const urls: string[] = [];
  for (const e of entities) for (const o of e.objects) if (o.kind === 'image') urls.push(o.url);
  return urls;
}

/** Draw entities into a canvas covering `rect` (document space), scaled by `scale`. */
export async function compositeRect(entities: CanvasEntity[], rect: Rect, scale = 1, previews: Record<string, FilterPreview> = {}): Promise<HTMLCanvasElement> {
  await preloadImages([...imageUrlsOf(entities), ...Object.values(previews).map((p) => p.url)]);
  const canvas = createCanvas(Math.max(1, Math.round(rect.width * scale)), Math.max(1, Math.round(rect.height * scale)));
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.scale(scale, scale);
  ctx.translate(-rect.x, -rect.y);
  for (const e of entities) {
    const r = renderEntity(e, { preview: previews[e.id] });
    if (!r) continue;
    ctx.globalAlpha = e.type === 'raster' || e.type === 'control' ? e.opacity : 1;
    ctx.globalCompositeOperation = blendOperation(e);
    ctx.drawImage(r.canvas, e.x + r.x, e.y + r.y, r.width, r.height);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}

/** Document-space bounds of the visible content of entities. */
export function contentBounds(entities: CanvasEntity[]): Rect | null {
  let out: Rect | null = null;
  for (const e of entities) {
    const b = objectsBounds(e.objects);
    if (!b) continue;
    const r = { x: b.x + e.x, y: b.y + e.y, width: b.width, height: b.height };
    if (!out) out = r;
    else {
      const x = Math.min(out.x, r.x);
      const y = Math.min(out.y, r.y);
      out = { x, y, width: Math.max(out.x + out.width, r.x + r.width) - x, height: Math.max(out.y + out.height, r.y + r.height) - y };
    }
  }
  return out;
}

/** True when the entity has drawn (non-eraser) content. */
export function hasContent(e: CanvasEntity): boolean {
  return objectsBounds(e.objects) !== null;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}

export async function canvasToUrl(canvas: HTMLCanvasElement): Promise<string> {
  return URL.createObjectURL(await canvasToBlob(canvas));
}
