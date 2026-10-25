// The canvas stores of comic pages: one Canvas store per page that is open (its layers are always shown, and it
// is painted on), made from the page's layers in the comic document (`page.canvas`), which stays the source of truth.
//
// - A store is made with `syncParams: false` and no persist, so it never writes the left form or the Image tab's document;
//   its tool settings start from the Image tab's. Pictures get their addresses from the gallery by name.
// - A change of the store's layers or box is written back to the page with `setPageCanvas` (no undo step of the comic): at
//   once for the first change, then at most once every WRITE_BACK_MS while changes keep coming (a layer dragged with the
//   move tool changes on every pointer move, and every write re-runs the comic's subscribers).
// - A change of the page that did not come from its store (the assistant, a project read again, a new paper, a comic undo
//   that brings back another paper) seeds the store again and clears its undo history, which held the old layers. Pictures
//   only given their gallery names keep the history.
// - The store of a page that is gone (its page or its project deleted) is dropped; at most MAX_STORES stay, the one used
//   longest ago going first.
import { t } from '@/i18n';
import { createCanvasStore, useCanvas, type CanvasEntity, type CanvasStore, type LimitKind } from '../canvas';
import { findImage, useGallery } from '../gallery';
import type { ComicPage } from './document';
import { MAX_MASKS_PER_PAGE, MAX_OBJECTS_PER_LAYER, MAX_RASTERS_PER_PAGE, type PageCanvas } from './pageCanvasDoc';
import { activePage, useComic } from './store';
import { toast } from '../toasts';

/** How often, at most, a store's changes are written back to its page while they keep coming. */
export const WRITE_BACK_MS = 150;
/** What the user is told when the page's limits refuse a layer or an object (saving would drop it silently otherwise). */
const LIMIT_MESSAGE: Record<LimitKind, () => string> = {
  rasters: () => t('comic.layers.limitRasters', { max: MAX_RASTERS_PER_PAGE }),
  masks: () => t('comic.layers.limitMasks', { max: MAX_MASKS_PER_PAGE }),
  objects: () => t('comic.layers.limitObjects', { max: MAX_OBJECTS_PER_LAYER }),
};

/** The sentence for a limit that is reached. */
export const limitMessage = (kind: LimitKind): string => LIMIT_MESSAGE[kind]();

/** The page store's limits: the same ones saving and reading apply (`pageCanvasDoc.ts`). */
export const PAGE_LIMITS = { rasters: MAX_RASTERS_PER_PAGE, masks: MAX_MASKS_PER_PAGE, objects: MAX_OBJECTS_PER_LAYER };

/** How many page stores are kept at most. */
export const MAX_STORES = 8;

interface Entry {
  pageId: string;
  store: CanvasStore;
  /** The page's layers as this store last read or wrote them: another value on the page is an outside change. */
  known: PageCanvas;
  /** The store's layers and box as last seeded or written, so a store change that is not an edit is not written back. */
  entities: CanvasEntity[];
  bbox: PageCanvas['bbox'];
  timer: ReturnType<typeof setTimeout> | null;
  dirty: boolean;
  unsubscribe: () => void;
}

const entries = new Map<string, Entry>();
let watching: (() => void) | null = null;
/** Set while a store writes back, so the comic's change it causes is not taken for an outside one. */
let writing = false;

/** The page with this id in any project. */
export const findPage = (pageId: string): ComicPage | undefined => {
  for (const project of useComic.getState().projects) {
    const page = project.pages.find((p) => p.id === pageId);
    if (page) return page;
  }
  return undefined;
};

/**
 * The entities with their pictures' addresses looked up in the gallery by name. A picture the gallery does not have (yet)
 * keeps its address, an empty one is simply not drawn, so painting never drops a picture from the page.
 */
function withAddresses(entities: CanvasEntity[]): CanvasEntity[] {
  return entities.map((e) => {
    if (!e.objects.some((o) => o.kind === 'image' && o.imageName && !o.url)) return e;
    const objects = e.objects.map((o) => {
      if (o.kind !== 'image' || !o.imageName || o.url) return o;
      const url = findImage(o.imageName)?.url;
      return url ? { ...o, url } : o;
    });
    return { ...e, objects } as CanvasEntity;
  });
}

/** The entities without their pictures' addresses and names, to see whether a change only named pictures. */
const drawingOnly = (entities: CanvasEntity[]) =>
  JSON.stringify(entities.map((e) => ({ ...e, objects: e.objects.map((o) => (o.kind === 'image' ? { ...o, url: '', imageName: null } : o)) })));

function write(entry: Entry) {
  entry.dirty = false;
  const s = entry.store.getState();
  if (s.entities === entry.entities && s.bbox === entry.bbox) return;
  const doc: PageCanvas = { entities: s.entities, bbox: s.bbox };
  entry.entities = s.entities;
  entry.bbox = s.bbox;
  entry.known = doc;
  writing = true;
  try {
    useComic.getState().setPageCanvas(entry.pageId, doc);
  } finally {
    writing = false;
  }
}

/** Writes now when no write happened lately, else once the wait is over. */
function scheduleWrite(entry: Entry) {
  if (entry.timer) {
    entry.dirty = true;
    return;
  }
  write(entry);
  const tick = () => {
    if (!entry.dirty) {
      entry.timer = null;
      return;
    }
    write(entry);
    entry.timer = setTimeout(tick, WRITE_BACK_MS);
  };
  entry.timer = setTimeout(tick, WRITE_BACK_MS);
}

function seed(entry: Entry, doc: PageCanvas, keepHistory: boolean) {
  const entities = withAddresses(doc.entities);
  entry.known = doc;
  entry.entities = entities;
  entry.bbox = doc.bbox;
  const s = entry.store.getState();
  const selected = s.selectedEntityId && entities.some((e) => e.id === s.selectedEntityId) ? s.selectedEntityId : null;
  entry.store.setState({
    entities,
    bbox: doc.bbox,
    selectedEntityId: selected,
    ...(keepHistory ? {} : { past: [], future: [], lastHistoryKey: null }),
  });
}

function drop(entry: Entry, flush: boolean) {
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = null;
  if (flush && entry.dirty && findPage(entry.pageId)) write(entry);
  entry.unsubscribe();
  entries.delete(entry.pageId);
}

/** Follows the comic (outside changes, deleted pages) and the gallery (pictures that arrive) for every page store. */
function watch() {
  if (watching) return;
  const offComic = useComic.subscribe((s, prev) => {
    if (s.projects === prev.projects || writing) return;
    const pages = new Map<string, ComicPage>();
    for (const project of s.projects) for (const page of project.pages) pages.set(page.id, page);
    for (const entry of [...entries.values()]) {
      const page = pages.get(entry.pageId);
      if (!page) drop(entry, false);
      else if (page.canvas !== entry.known) {
        // A change of this store not yet written goes: the page changed under it.
        if (entry.timer) clearTimeout(entry.timer);
        entry.timer = null;
        entry.dirty = false;
        seed(entry, page.canvas, drawingOnly(page.canvas.entities) === drawingOnly(entry.store.getState().entities));
      }
    }
  });
  const offGallery = useGallery.subscribe((g, prev) => {
    if (g.images === prev.images) return;
    for (const entry of entries.values()) {
      const s = entry.store.getState();
      const entities = withAddresses(s.entities);
      // Only addresses change: no undo step, and the page keeps what it had.
      if (entities.some((e, i) => e !== s.entities[i])) {
        entry.entities = entities;
        entry.store.setState({ entities });
      }
    }
  });
  watching = () => {
    offComic();
    offGallery();
  };
}

/** The canvas store of a page, made from its layers when there is none yet; null when the page does not exist. */
export function pageCanvasStore(pageId: string): CanvasStore | null {
  const found = entries.get(pageId);
  if (found) {
    // The one used last goes to the end, so the one used longest ago is dropped first.
    entries.delete(pageId);
    entries.set(pageId, found);
    return found.store;
  }
  const page = findPage(pageId);
  if (!page) return null;
  watch();
  const g = useCanvas.getState();
  const store = createCanvasStore({
    syncParams: false,
    limits: PAGE_LIMITS,
    onLimit: (kind) => toast({ status: 'warning', title: LIMIT_MESSAGE[kind]() }),
  });
  store.setState({
    // Paint mode is entered to paint and its tool bar has no hand (the page moves its own view), so a page starts on the brush.
    tool: 'brush',
    brushWidth: g.brushWidth,
    eraserWidth: g.eraserWidth,
    mosaicWidth: g.mosaicWidth,
    mosaicBlock: g.mosaicBlock,
    fillColor: g.fillColor,
    // The page is not a stage of its own: no grid, nothing dimmed outside the box, strokes not cut at the box.
    settings: { ...g.settings, showGrid: false, dimOutsideBbox: false, clipToBbox: false },
  });
  const entry: Entry = { pageId, store, known: page.canvas, entities: [], bbox: page.canvas.bbox, timer: null, dirty: false, unsubscribe: () => undefined };
  seed(entry, page.canvas, false);
  entry.unsubscribe = store.subscribe((s) => {
    if (s.entities !== entry.entities || s.bbox !== entry.bbox) scheduleWrite(entry);
  });
  entries.set(pageId, entry);
  while (entries.size > MAX_STORES) {
    const oldest = entries.values().next().value as Entry;
    drop(oldest, true);
  }
  return store;
}

/** The canvas store of the open page (made when needed, as its layers are always shown); null when no page is open. */
export function useActivePageCanvas(): CanvasStore | null {
  const pageId = useComic((s) => activePage(s)?.id ?? null);
  return pageId ? pageCanvasStore(pageId) : null;
}

/** Writes every change a page store still holds back to its page now (or every page's when none is named). */
export function flushPageCanvas(pageId?: string) {
  for (const entry of entries.values()) {
    if (pageId && entry.pageId !== pageId) continue;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = null;
    if (entry.dirty) write(entry);
  }
}

/** The pages that have a store now, the one used longest ago first (for tests). */
export const livePageCanvases = (): string[] => [...entries.keys()];

/** Drops every page store and stops following the comic (for tests). */
export function resetPageCanvases() {
  for (const entry of [...entries.values()]) drop(entry, false);
  watching?.();
  watching = null;
}
