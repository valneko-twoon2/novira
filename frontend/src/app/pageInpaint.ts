// Inpainting on a comic page: the Canvas's own request builder run on the page's store. The init picture is the
// page as drawn (panels, balloons and the user's rasters under the generation box), the mask comes from the store's inpaint
// layers as on the Canvas. The result is staged on the page's store (`landPageInpaint`) and accepted into a new raster
// layer with the Canvas's own staging actions. It is put together here since the comic feature does not import the Canvas one.
import { backend } from '@/backend';
import { canvasReadiness } from '@/features/canvas/register';
import { canvasRenderer, type CanvasRenderer } from '@/features/canvas/render/generationInputs';
import { buildCanvasRequest } from '@/features/canvas/request';
import { drawPage, preparePage } from '@/features/comic/pageRender';
import { t } from '@/i18n';
import { objectsBounds } from '@/ui/canvasDraw/bounds';
import { canvasToUrl, hasContent } from '@/ui/canvasDraw/composite';
import { createCanvas } from '@/ui/canvasDraw/entityRender';
import type { CanvasStore, Rect } from '@/state/canvas';
import { findImage } from '@/state/gallery';
import { useParams } from '@/state/params';
import { toast } from '@/state/toasts';
import { pagePixels } from '@/state/comic/document';
import { findPage, flushPageCanvas, pageCanvasStore } from '@/state/comic/pageCanvas';
import { fitPageBbox, limitPageBbox, pageBboxProblem, trackPageInpaint } from '@/state/comic/pageInpaint';

/** The size of the open page's document (its pixels, 200 dpi). */
function docOf(pageId: string): { width: number; height: number } | null {
  const page = findPage(pageId);
  return page ? pagePixels(page) : null;
}

/** The pixels the request builder reads, with the page drawn as the init picture. */
function pageRenderer(pageId: string, store: CanvasStore): CanvasRenderer {
  return {
    ...canvasRenderer,
    // The page is always there as a whole: a box on it is always inpainted or reworked, never an outpaint.
    coverage: async () => 'full',
    sourceAndMask: async (s, opts) => {
      const page = findPage(pageId);
      if (!page) throw new Error('page gone');
      const mask = await canvasRenderer.sourceAndMask(s, { ...opts, outpaint: false });
      const live = store.getState();
      const prepared = await preparePage({ ...page, canvas: { entities: live.entities, bbox: live.bbox } }, (name) => findImage(name)?.url);
      const whole = drawPage(prepared);
      const crop = createCanvas(s.bbox.width, s.bbox.height);
      (crop.getContext('2d') as CanvasRenderingContext2D).drawImage(whole, -s.bbox.x, -s.bbox.y);
      return { initImageUrl: await canvasToUrl(crop), maskImageUrl: mask.maskImageUrl };
    },
  };
}

/** Where the masks of a store hold something, in page pixels; null when they are empty. */
function maskBounds(store: CanvasStore): Rect | null {
  let out: Rect | null = null;
  for (const e of store.getState().entities) {
    if (e.type !== 'inpaint' || !e.isEnabled || !hasContent(e)) continue;
    const b = objectsBounds(e.objects);
    if (!b) continue;
    const r = { x: e.x + b.x, y: e.y + b.y, width: b.width, height: b.height };
    out = out ? unite(out, r) : r;
  }
  return out;
}

function unite(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}

/** Why the page cannot be inpainted now (empty = ready): the Canvas's reasons, then the page's own. */
export function pageInpaintReadiness(pageId: string): string[] {
  const store = pageCanvasStore(pageId);
  if (!store) return [];
  const s = store.getState();
  const reasons = canvasReadiness(s, useParams.getState());
  if (!s.entities.some((e) => e.type === 'inpaint' && e.isEnabled && !s.groupHidden.inpaint && hasContent(e))) reasons.push(t('comic.inpaint.noMask'));
  return reasons;
}

/**
 * Queues an inpaint of the page's generation box: the page under the box with the mask. A box that reaches past the page
 * or is too large is fitted around the mask first (and the user is told). The queued items are remembered, so the result
 * is staged on this page's store. True when something was queued.
 */
export async function queuePageInpaint(pageId: string, opts: { prepend?: boolean } = {}): Promise<boolean> {
  const store = pageCanvasStore(pageId);
  const doc = docOf(pageId);
  if (!store || !doc) return false;
  const reasons = pageInpaintReadiness(pageId);
  if (reasons.length) {
    toast({ status: 'warning', title: t('app.invoke.notReady'), description: reasons.join('\n') });
    return false;
  }
  try {
    const current = store.getState().bbox;
    if (pageBboxProblem(current, doc)) {
      const fitted = pageBboxProblem(current, doc) === 'tooSmall' ? limitPageBbox(current, doc) : fitPageBbox(current, doc, maskBounds(store));
      store.getState().setBbox(fitted, { history: false });
      toast({ status: 'info', title: t('comic.inpaint.boxFitted', { width: fitted.width, height: fitted.height }) });
    }
    // The page the request draws is the document, so what the store still holds goes into it first.
    flushPageCanvas(pageId);
    const request = await buildCanvasRequest(store.getState(), useParams.getState(), opts.prepend ?? false, pageRenderer(pageId, store));
    const items = await backend.enqueue(request);
    trackPageInpaint(
      items.map((i) => i.id),
      pageId,
    );
    toast({ status: 'success', title: t('app.invoke.enqueued', { count: items.length }) });
    return items.length > 0;
  } catch (err) {
    toast({ status: 'error', title: t('app.invoke.failed'), description: String(err instanceof Error ? err.message : err) });
    return false;
  }
}
