// Whether the comic page is being painted on. In page mode the page's own tools work (panels, balloons,
// pictures); in paint mode the Canvas tools paint on the chosen raster layer of the page's canvas store (pageCanvas.ts) and
// the page's tools are out of reach. Painting starts from the toolbar's switch or by choosing a raster layer of the user in
// the layers panel; choosing a slot layer (the panels, the balloons), Escape, another page or leaving the comic ends it.
import { create, useStore } from 'zustand';
import { isSlot, useCanvas, type CanvasEntity } from '../canvas';
import { pageCanvasStore } from './pageCanvas';
import { useComic } from './store';

interface PagePaintState {
  painting: boolean;
}

export const usePagePaint = create<PagePaintState>()(() => ({ painting: false }));

/** Whether a layer is a raster of the user: one that is painted on and shown on the page's layer stack (not a slot). */
export const isPaintableRaster = (e: CanvasEntity | undefined): boolean => !!e && e.type === 'raster' && !isSlot(e);

/** Whether a layer is one the user paints on: a raster that is not a slot, or an inpaint mask (drawn by the stage's chrome). */
export const isPaintable = (e: CanvasEntity | undefined): boolean => isPaintableRaster(e) || e?.type === 'inpaint';

/** Whether inpaint results wait on the page's store to be accepted or discarded (Escape then discards them, not paint mode). */
export function usePageHasStaged(pageId: string | null): boolean {
  const store = pageId ? pageCanvasStore(pageId) : null;
  // Without a page store the Image tab's store is read, and nothing of it is used.
  return useStore(store ?? useCanvas, (s) => !!store && s.stagedImageNames.length > 0);
}

/**
 * Starts painting on a page: its chosen layer stays when it is a raster of the user, else its top one is chosen (a new one
 * when it has none). The panel choice and the cut tool are let go, and False when the page is gone.
 */
export function startPainting(pageId: string): boolean {
  const store = pageCanvasStore(pageId);
  if (!store) return false;
  // Painting first, so the choice below is not taken for a new one (see followLayerChoice).
  usePagePaint.setState({ painting: true });
  const s = store.getState();
  if (!isPaintable(s.entities.find((e) => e.id === s.selectedEntityId))) {
    const top = [...s.entities].reverse().find(isPaintableRaster);
    if (top) s.select(top.id);
    else s.addEntity('raster');
  }
  const comic = useComic.getState();
  if (comic.selectedPanelId || comic.backdropSelected) comic.selectPanel(null);
  if (comic.cutting) comic.setCutting(false);
  return true;
}

/**
 * Ends painting. A raster of the user chosen in the page's store is let go, so choosing it again in the layers panel starts
 * painting again.
 */
export function stopPainting(pageId?: string | null) {
  if (!usePagePaint.getState().painting) return;
  usePagePaint.setState({ painting: false });
  const store = pageId ? pageCanvasStore(pageId) : null;
  const s = store?.getState();
  if (s && isPaintable(s.entities.find((e) => e.id === s.selectedEntityId))) s.select(null);
}

/** Follows a new choice in a page's layers: a raster of the user starts painting, a slot ends it. */
export function followLayerChoice(pageId: string, selectedId: string | null) {
  const store = pageCanvasStore(pageId);
  const chosen = store?.getState().entities.find((e) => e.id === selectedId);
  const painting = usePagePaint.getState().painting;
  if (isPaintable(chosen) && !painting) startPainting(pageId);
  else if (chosen && isSlot(chosen) && painting) stopPainting(pageId);
}
