// Viewport commands that need the current stage size (zoom buttons, reset view, fit layers), per canvas store.
import { useCanvas, type CanvasStore, type Rect } from '@/state/canvas';
import { unionRect } from '@/ui/canvasDraw/bounds';
import { contentBounds } from '@/ui/canvasDraw/composite';
import { fitRect, stepZoom, zoomAt } from './geometry';
import { visibleEntities } from './render/composite';

/** What the view of one store knows about its stage: the stage size and whether the view was fitted once. */
interface StageView {
  width: number;
  height: number;
  fitted: boolean;
}

const views = new WeakMap<CanvasStore, StageView>();

function viewOf(store: CanvasStore): StageView {
  let view = views.get(store);
  if (!view) {
    view = { width: 800, height: 600, fitted: false };
    views.set(store, view);
  }
  return view;
}

export function setStageSize(width: number, height: number, store: CanvasStore = useCanvas) {
  const view = viewOf(store);
  view.width = width;
  view.height = height;
}

/**
 * Fits the bbox into the stage the first time the stage of `store` has a usable size; later calls do nothing, so the
 * view a person left stays when the stage mounts again.
 */
export function fitBboxOnce(store: CanvasStore = useCanvas) {
  const view = viewOf(store);
  if (view.fitted || view.width <= 50 || view.height <= 50) return;
  view.fitted = true;
  fitBbox(store);
}

export function zoomStep(dir: 1 | -1, store: CanvasStore = useCanvas) {
  const s = store.getState();
  const stage = viewOf(store);
  s.setViewport(zoomAt(s.viewport, { x: stage.width / 2, y: stage.height / 2 }, stepZoom(s.viewport.scale, dir)));
}

export function zoomTo(scale: number, store: CanvasStore = useCanvas) {
  const s = store.getState();
  const stage = viewOf(store);
  s.setViewport(zoomAt(s.viewport, { x: stage.width / 2, y: stage.height / 2 }, scale));
}

/** Fit the bbox (and visible layers) into the stage. */
export function resetView(store: CanvasStore = useCanvas) {
  const s = store.getState();
  const stage = viewOf(store);
  const content = contentBounds(visibleEntities(s, ['raster', 'control', 'inpaint', 'regional']));
  const target: Rect = unionRect(s.bbox, content) ?? s.bbox;
  s.setViewport(fitRect(target, stage.width, stage.height));
}

export function fitBbox(store: CanvasStore = useCanvas) {
  const s = store.getState();
  const stage = viewOf(store);
  s.setViewport(fitRect(s.bbox, stage.width, stage.height));
}

/** Resize the bbox around the visible layer content. */
export function fitBboxToLayers(store: CanvasStore = useCanvas) {
  const s = store.getState();
  const content = contentBounds(visibleEntities(s, ['raster', 'control', 'inpaint', 'regional']));
  if (!content) return;
  s.setBbox(content, { history: true });
}
