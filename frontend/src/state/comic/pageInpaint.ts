// Inpainting on a comic page: the limits of the generation box on a page, and the link between a queued inpaint
// and the page it was asked for. The request itself is built in the shell (`app/pageInpaint.ts`) from the Canvas's own request
// builder on the page's store; a result arrives through the queue with no memory of the page, so the queue items are
// remembered here and the result is staged on the store of the page that asked, even when another page is open by then.
import { t } from '@/i18n';
import type { Rect } from '../canvas';
import { pageCanvasStore } from './pageCanvas';
import { startPainting, usePagePaint } from './paintMode';
import { activePage, useComic } from './store';
import { toast } from '../toasts';

/** The longest side of the generation box on a page, in page pixels. */
export const MAX_INPAINT_SIDE = 2048;
/** The most pixels the generation box holds on a page (1536 x 1536). */
export const MAX_INPAINT_AREA = 1536 * 1536;
/** The shortest side of the box. */
const MIN_INPAINT_SIDE = 64;
/** The box snaps to multiples of this, as the Canvas's box does. */
const STEP = 8;

const floorTo = (v: number) => Math.floor(v / STEP) * STEP;

/** Why a box cannot be generated on a page: it reaches past the page, or is too large or too small; null when it is fine. */
export function pageBboxProblem(box: Rect, doc: { width: number; height: number }): 'outside' | 'tooLarge' | 'tooSmall' | null {
  if (box.width < MIN_INPAINT_SIDE || box.height < MIN_INPAINT_SIDE) return 'tooSmall';
  if (box.x < 0 || box.y < 0 || box.x + box.width > doc.width || box.y + box.height > doc.height) return 'outside';
  if (box.width > MAX_INPAINT_SIDE || box.height > MAX_INPAINT_SIDE || box.width * box.height > MAX_INPAINT_AREA) return 'tooLarge';
  return null;
}

/**
 * The box kept within a page and within a sane generation size: sides in multiples of 8, at least 64, at most 2048 and
 * 1536 x 1536 pixels together, inside the page. Used while the box is dragged and before a request is built.
 */
export function limitPageBbox(box: Rect, doc: { width: number; height: number }): Rect {
  let width = Math.min(Math.max(MIN_INPAINT_SIDE, box.width), MAX_INPAINT_SIDE, floorTo(doc.width));
  let height = Math.min(Math.max(MIN_INPAINT_SIDE, box.height), MAX_INPAINT_SIDE, floorTo(doc.height));
  if (width * height > MAX_INPAINT_AREA) {
    const k = Math.sqrt(MAX_INPAINT_AREA / (width * height));
    width = Math.max(MIN_INPAINT_SIDE, floorTo(width * k));
    height = Math.max(MIN_INPAINT_SIDE, floorTo(height * k));
  }
  width = Math.max(MIN_INPAINT_SIDE, floorTo(width));
  height = Math.max(MIN_INPAINT_SIDE, floorTo(height));
  const x = Math.min(Math.max(0, Math.round(box.x)), Math.max(0, doc.width - width));
  const y = Math.min(Math.max(0, Math.round(box.y)), Math.max(0, doc.height - height));
  return { x, y, width, height };
}

/** A box within the limits centred on `around` (what is to be redrawn), keeping the shape of `box`. */
export function fitPageBbox(box: Rect, doc: { width: number; height: number }, around: Rect | null): Rect {
  const fitted = limitPageBbox({ ...box, x: 0, y: 0 }, doc);
  const cx = around ? around.x + around.width / 2 : box.x + box.width / 2;
  const cy = around ? around.y + around.height / 2 : box.y + box.height / 2;
  return limitPageBbox({ ...fitted, x: cx - fitted.width / 2, y: cy - fitted.height / 2 }, doc);
}

/** The queue items waiting for a result, by id, with the page that asked. */
const waiting = new Map<number, string>();
/** How many items are remembered at most (a failed item is never told back, so the oldest are let go). */
const MAX_WAITING = 200;

/** Remembers that these queue items were asked for by a page. */
export function trackPageInpaint(itemIds: number[], pageId: string) {
  for (const id of itemIds) waiting.set(id, pageId);
  while (waiting.size > MAX_WAITING) waiting.delete(waiting.keys().next().value as number);
}

/** The page a queue item was asked for, if it was one of a page's inpaints. */
export const pageOfInpaint = (itemId: number): string | undefined => waiting.get(itemId);

/**
 * A result of the queue for a canvas item: when a page asked for it, the picture is staged on that page's store and this
 * returns true (the Image tab's store must not get it). The open page then starts painting, so the staging bar is at hand.
 */
export function landPageInpaint(itemId: number, imageName: string): boolean {
  const pageId = waiting.get(itemId);
  if (!pageId) return false;
  waiting.delete(itemId);
  const store = pageCanvasStore(pageId);
  if (!store) return true;
  store.getState().addStagedImage(imageName);
  if (activePage(useComic.getState())?.id === pageId) {
    if (!usePagePaint.getState().painting) startPainting(pageId);
  } else {
    toast({ status: 'info', title: t('comic.inpaint.readyElsewhere') });
  }
  return true;
}

/** Forgets every remembered item (for tests). */
export const resetPageInpaints = () => waiting.clear();
