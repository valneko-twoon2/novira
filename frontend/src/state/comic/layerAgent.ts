// The assistant's view of a page's layers and its layer operations, each checked here as the other comic operations are
// (see agentEditor.ts). `layer` changes one raster layer by its number in the stack (1 is the bottom): its name, visibility,
// lock, opacity, blend, or its place (one up or down, to the top or the bottom, which is how a layer goes under or over the
// panels and the balloons slots). `addLayer` puts a new empty raster layer on top and `deleteLayer` removes a raster layer
// of the user that is not locked. The assistant cannot draw on a layer or put a picture in it, and cannot delete a slot.
//
// Layers are no undo steps of the comic, so the comic's undo does not take these changes back. A change to the
// page's layers from here makes the page's canvas store (pageCanvas.ts) read the page again, which clears that store's own
// undo history; what the user painted but the store had not written yet is written first, so it is never lost.
import { RASTER_BLENDS } from '../canvas';
import type { ComicPage } from './document';
import { layerName } from './layerName';
import { flushPageCanvas, livePageCanvases, pageCanvasStore } from './pageCanvas';
import { addRaster, cleanLayerName, MAX_RASTERS_PER_PAGE, moveRaster, pageRasters, removeRaster, updateRasterLook, type RasterLook } from './pageCanvasDoc';
import { isPaintable, stopPainting, usePagePaint } from './paintMode';
import { useComic } from './store';

/**
 * The page's raster layers as the assistant is told them, bottom first: the panels and balloons slots, and the user's
 * rasters, each with its number, name, kind (`panels`, `balloons` or `raster`), visibility, and when they differ from the
 * plain ones lock, opacity, blend, and how many objects (strokes, shapes, pictures) a raster of the user holds.
 */
export function layerContext(page: ComicPage) {
  return pageRasters(page.canvas).map((e, i) => ({
    layer: i + 1,
    name: layerName(e),
    kind: e.slot ?? 'raster',
    visible: e.isEnabled,
    ...(e.isLocked ? { locked: true } : {}),
    ...(e.opacity < 1 ? { opacity: e.opacity } : {}),
    ...(e.blend && e.blend !== 'normal' ? { blend: e.blend } : {}),
    ...(!e.slot ? { objects: e.objects.length } : {}),
  }));
}

/** What the assistant is told about painting: whether the page is being painted on, and how many rasters a page holds at most. */
export const paintContext = (page: ComicPage) => ({
  painting: usePagePaint.getState().painting,
  maxLayers: MAX_RASTERS_PER_PAGE,
  layersTotal: pageRasters(page.canvas).length,
});

const MOVES = ['up', 'down', 'top', 'bottom'] as const;

/** The page as it is now, after the store's pending changes are written. */
function freshPage(pageId: string): ComicPage | undefined {
  flushPageCanvas(pageId);
  for (const project of useComic.getState().projects) {
    const found = project.pages.find((p) => p.id === pageId);
    if (found) return found;
  }
  return undefined;
}

/** Leaves paint mode when the layer being painted is gone after a change. */
function keepPaintingValid(pageId: string) {
  if (!usePagePaint.getState().painting || !livePageCanvases().includes(pageId)) return;
  const s = pageCanvasStore(pageId)?.getState();
  if (s && !isPaintable(s.entities.find((e) => e.id === s.selectedEntityId))) stopPainting(pageId);
}

/** Applies a `layer`, `addLayer` or `deleteLayer` operation to the page; true when it changed something. */
export function applyLayerOp(op: Record<string, unknown>, target: ComicPage | null): boolean {
  const page = target ? freshPage(target.id) : undefined;
  if (!page) return false;
  const store = useComic.getState();
  const put = (next: ReturnType<typeof addRaster>) => {
    const changed = !!next && store.setPageCanvas(page.id, next);
    if (changed) keepPaintingValid(page.id);
    return changed;
  };
  if (op.op === 'addLayer') {
    // Only an empty raster layer can be added; another kind is not one.
    if (op.kind !== undefined && op.kind !== 'raster') return false;
    return put(addRaster(page.canvas, cleanLayerName(op.name)));
  }
  const n = op.layer;
  const layer = typeof n === 'number' && Number.isInteger(n) ? pageRasters(page.canvas)[n - 1] : undefined;
  if (!layer) return false;
  if (op.op === 'deleteLayer') {
    // A locked layer is the user's to unlock first; a slot cannot go.
    if (layer.isLocked) return false;
    return put(removeRaster(page.canvas, layer.id));
  }
  const look: RasterLook = {};
  if (typeof op.visible === 'boolean') look.isEnabled = op.visible;
  if (typeof op.locked === 'boolean') look.isLocked = op.locked;
  if (typeof op.opacity === 'number' && Number.isFinite(op.opacity)) look.opacity = op.opacity;
  if (typeof op.blend === 'string' && (RASTER_BLENDS as readonly string[]).includes(op.blend)) look.blend = op.blend as RasterLook['blend'];
  // A name of only spaces is ignored; a slot keeps the screen's own name unless it is given one.
  if (typeof op.name === 'string' && cleanLayerName(op.name)) look.name = op.name;
  let doc = updateRasterLook(page.canvas, layer.id, look);
  if (typeof op.move === 'string' && (MOVES as readonly string[]).includes(op.move)) {
    doc = moveRaster(doc ?? page.canvas, layer.id, op.move as (typeof MOVES)[number]) ?? doc;
  }
  return put(doc);
}
