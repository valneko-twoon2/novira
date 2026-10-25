// The pictures a canvas invocation sends besides the prompt: the raster layers inside the bbox (transparent parts
// filled for outpaint), the mask of what to redraw, and each control layer's picture. All are bbox-sized PNG URLs.
import type { CanvasEntity, CanvasState } from '@/state/canvas';
import type { InfillMethod } from '@/state/params';
import type { Coverage } from '../geometry';
import { canvasToUrl, compositeRect, imageUrlsOf } from '@/ui/canvasDraw/composite';
import { createCanvas, renderControlImage, renderMaskShape, type Rendered } from '@/ui/canvasDraw/entityRender';
import { preloadImages } from '@/ui/canvasDraw/imageCache';
import { rasterCoverage, visibleEntities } from './composite';
import { addTransparentArea, maskGrey, maskIsEmpty, pullPushFill } from './maskPixels';

type Doc = Pick<CanvasState, 'entities' | 'groupHidden' | 'bbox' | 'filterPreviews'>;

export interface Infill {
  method: InfillMethod;
  /** CSS colour for the `color` method. */
  color: string;
}

export interface SourceAndMask {
  initImageUrl: string;
  /** Null when nothing is to be redrawn. */
  maskImageUrl: string | null;
}

/** What the request builder needs from the canvas pixels (replaced by a fake in tests). */
export interface CanvasRenderer {
  coverage(s: Doc): Promise<Coverage>;
  /** The source and the mask: inpaint layers, plus the transparent area when `outpaint`. */
  sourceAndMask(s: Doc, opts: { outpaint: boolean; infill: Infill }): Promise<SourceAndMask>;
  controlImage(s: Doc, e: CanvasEntity): Promise<string>;
  /** A regional guidance layer's region: white on black, the size of the bbox. */
  regionMask(s: Doc, e: CanvasEntity): Promise<string>;
}

/** The fill is computed at most this large and scaled up: it is blurry by nature. */
const FILL_MAX_SIDE = 512;

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  return c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
}

function drawAt(ctx: CanvasRenderingContext2D, e: CanvasEntity, r: Rendered, s: Doc) {
  ctx.drawImage(r.canvas, e.x + r.x - s.bbox.x, e.y + r.y - s.bbox.y, r.width, r.height);
}

/** The composite with its transparent pixels filled: a solid colour, or the surrounding colours (pull-push). */
function fillTransparent(source: HTMLCanvasElement, infill: Infill): HTMLCanvasElement {
  const out = createCanvas(source.width, source.height);
  const ctx = ctx2d(out);
  if (infill.method === 'color') {
    ctx.fillStyle = infill.color;
    ctx.fillRect(0, 0, out.width, out.height);
  } else {
    // The other methods (LaMa, PatchMatch, tiles) need an engine of their own; pull-push stands in for them.
    const scale = Math.min(1, FILL_MAX_SIDE / Math.max(source.width, source.height));
    const small = createCanvas(Math.max(1, Math.round(source.width * scale)), Math.max(1, Math.round(source.height * scale)));
    const sctx = ctx2d(small);
    sctx.drawImage(source, 0, 0, small.width, small.height);
    const data = sctx.getImageData(0, 0, small.width, small.height);
    data.data.set(pullPushFill(data.data, small.width, small.height));
    sctx.putImageData(data, 0, 0);
    ctx.drawImage(small, 0, 0, out.width, out.height);
  }
  ctx.drawImage(source, 0, 0);
  return out;
}

async function sourceAndMask(s: Doc, opts: { outpaint: boolean; infill: Infill }): Promise<SourceAndMask> {
  const composite = await compositeRect(visibleEntities(s, ['raster']), s.bbox);
  const masks = visibleEntities(s, ['inpaint']);
  await preloadImages(imageUrlsOf(masks));
  const mask = createCanvas(s.bbox.width, s.bbox.height);
  const mctx = ctx2d(mask);
  mctx.fillStyle = '#000000';
  mctx.fillRect(0, 0, mask.width, mask.height);
  // Overlapping layers: the strongest redraw wins.
  mctx.globalCompositeOperation = 'lighten';
  for (const e of masks) {
    const r = renderMaskShape(e, maskGrey(e.type === 'inpaint' ? e.denoiseLimit : null));
    if (r) drawAt(mctx, e, r, s);
  }
  mctx.globalCompositeOperation = 'source-over';
  const maskData = mctx.getImageData(0, 0, mask.width, mask.height);
  if (opts.outpaint) {
    addTransparentArea(maskData.data, ctx2d(composite).getImageData(0, 0, composite.width, composite.height).data);
    mctx.putImageData(maskData, 0, 0);
  }
  const source = opts.outpaint ? fillTransparent(composite, opts.infill) : composite;
  return {
    initImageUrl: await canvasToUrl(source),
    maskImageUrl: maskIsEmpty(maskData.data) ? null : await canvasToUrl(mask),
  };
}

async function controlImage(s: Doc, e: CanvasEntity): Promise<string> {
  const preview = s.filterPreviews[e.id];
  await preloadImages([...imageUrlsOf([e]), ...(preview ? [preview.url] : [])]);
  const out = createCanvas(s.bbox.width, s.bbox.height);
  const ctx = ctx2d(out);
  // ComfyUI drops the alpha channel; empty parts are black, as for InvokeAI.
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, out.width, out.height);
  const r = renderControlImage(e, preview);
  if (r) drawAt(ctx, e, r, s);
  return canvasToUrl(out);
}

async function regionMask(s: Doc, e: CanvasEntity): Promise<string> {
  await preloadImages(imageUrlsOf([e]));
  const out = createCanvas(s.bbox.width, s.bbox.height);
  const ctx = ctx2d(out);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, out.width, out.height);
  const r = renderMaskShape(e, maskGrey(null));
  if (r) drawAt(ctx, e, r, s);
  return canvasToUrl(out);
}

export const canvasRenderer: CanvasRenderer = {
  coverage: rasterCoverage,
  sourceAndMask,
  controlImage,
  regionMask,
};
