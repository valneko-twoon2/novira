// The canvas stores of comic pages: made from the page's layers without touching the left form, written back to the page
// (at once, then at most once per wait while changes keep coming) with no comic undo step, seeded again when the page
// changes from outside (clearing their undo history unless only pictures got names), dropped with their page or project,
// and at most MAX_STORES kept.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { useCanvas, type CanvasObject, type ImageObject, type RasterEntity } from '../canvas';
import { useGallery } from '../gallery';
import { useParams } from '../params';
import { useToasts } from '../toasts';
import { emptyPage, newProject } from './document';
import { flushPageCanvas, limitMessage, livePageCanvases, MAX_STORES, pageCanvasStore, resetPageCanvases, WRITE_BACK_MS } from './pageCanvas';
import { addRaster, MAX_MASKS_PER_PAGE, MAX_OBJECTS_PER_LAYER, MAX_RASTERS_PER_PAGE, pageRasters, updateRasterLook, type PageCanvas } from './pageCanvasDoc';
import { activePage, useComic } from './store';

const stroke = (id: string): CanvasObject => ({ kind: 'stroke', id, tool: 'brush', color: { r: 0, g: 0, b: 0, a: 1 }, width: 10, points: [100, 100, 400, 800], clip: null });
const picture: ImageObject = { kind: 'image', id: 'pic', url: '', imageName: 'p.png', x: 10, y: 10, width: 100, height: 100 };
const page = () => activePage(useComic.getState())!;
const withLayer = (doc: PageCanvas, objects: CanvasObject[]): PageCanvas => {
  const next = addRaster(doc, 'Ink')!;
  return { ...next, entities: next.entities.map((e) => (e.name === 'Ink' ? { ...e, objects } : e)) };
};
const ink = (entities: { name: string | null; type: string }[]) => entities.find((e) => e.name === 'Ink') as RasterEntity;

beforeEach(() => {
  vi.useFakeTimers();
  resetPageCanvases();
  useGallery.setState({ images: [] });
  useComic.setState({ projects: [], activeProjectId: null, activePageId: null, past: [], future: [] });
  useComic.getState().setProjects([newProject('Layers')]);
});

afterEach(() => {
  resetPageCanvases();
  vi.useRealTimers();
});

describe('making a page store', () => {
  it('takes the page layers and the Image tab tool settings, and never writes the form', () => {
    useComic.getState().setPageCanvas(page().id, withLayer(page().canvas, [stroke('s')]));
    useCanvas.setState({ brushWidth: 77, fillColor: { r: 1, g: 2, b: 3, a: 1 } });
    const params = useParams.getState();
    const before = { width: params.width, height: params.height };
    const store = pageCanvasStore(page().id)!;
    expect(store).not.toBe(useCanvas);
    expect(store.getState().entities).toEqual(page().canvas.entities);
    expect(store.getState().bbox).toEqual(page().canvas.bbox);
    expect(store.getState().brushWidth).toBe(77);
    expect(store.getState().fillColor).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    store.getState().setBbox({ x: 0, y: 0, width: 512, height: 768 });
    store.getState().undo();
    store.getState().redo();
    expect({ width: useParams.getState().width, height: useParams.getState().height }).toEqual(before);
  });

  it('starts on the brush, as its paint tool bar has no view tool, whatever the Image tab holds', () => {
    useCanvas.setState({ tool: 'view' });
    expect(pageCanvasStore(page().id)!.getState().tool).toBe('brush');
  });

  it('gives pictures their gallery address, and keeps one the gallery does not have yet', () => {
    useComic.getState().setPageCanvas(page().id, withLayer(page().canvas, [picture]));
    const store = pageCanvasStore(page().id)!;
    expect(ink(store.getState().entities).objects[0]).toMatchObject({ imageName: 'p.png', url: '' });
    useGallery.setState({ images: [{ name: 'p.png', url: 'blob:p' } as ImageDTO] });
    expect(ink(store.getState().entities).objects[0]).toMatchObject({ imageName: 'p.png', url: 'blob:p' });
    // An address is no edit: no undo step.
    expect(store.getState().past).toHaveLength(0);
  });

  it('leaves the comic untouched when a store is made for a page that is only shown', () => {
    const before = useComic.getState().projects;
    const calls = vi.fn();
    const off = useComic.subscribe(calls);
    const store = pageCanvasStore(page().id)!;
    store.getState().select('panels');
    store.getState().select(null);
    vi.advanceTimersByTime(WRITE_BACK_MS * 3);
    off();
    expect(calls).not.toHaveBeenCalled();
    expect(useComic.getState().projects).toBe(before);
  });

  it('gives the same store again, and none for a page that does not exist', () => {
    const store = pageCanvasStore(page().id);
    expect(pageCanvasStore(page().id)).toBe(store);
    expect(pageCanvasStore('missing')).toBeNull();
  });
});

describe('layer limits', () => {
  const rasters = () => pageRasters({ entities: pageCanvasStore(page().id)!.getState().entities, bbox: page().canvas.bbox });
  const toasts = () => useToasts.getState().toasts;

  it('allows layers up to the limit with the slots counted, then refuses with a warning', () => {
    useToasts.setState({ toasts: [] });
    const store = pageCanvasStore(page().id)!;
    while (rasters().length < MAX_RASTERS_PER_PAGE) expect(store.getState().addEntity('raster')).not.toBe('');
    expect(rasters()).toHaveLength(MAX_RASTERS_PER_PAGE);
    expect(toasts()).toHaveLength(0);
    expect(store.getState().addEntity('raster')).toBe('');
    expect(rasters()).toHaveLength(MAX_RASTERS_PER_PAGE);
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]).toMatchObject({ status: 'warning', title: limitMessage('rasters') });
    // The saved page keeps every layer: nothing is dropped silently.
    flushPageCanvas();
    expect(page().canvas.entities).toHaveLength(MAX_RASTERS_PER_PAGE);
  });

  it('stops at the masks and the objects of one layer too', () => {
    useToasts.setState({ toasts: [] });
    const store = pageCanvasStore(page().id)!;
    for (let i = 0; i < MAX_MASKS_PER_PAGE; i++) expect(store.getState().addEntity(i % 2 ? 'regional' : 'inpaint')).not.toBe('');
    expect(store.getState().addEntity('inpaint')).toBe('');
    expect(toasts().at(-1)).toMatchObject({ title: limitMessage('masks') });
    const id = store.getState().addEntity('raster');
    for (let i = 0; i < MAX_OBJECTS_PER_LAYER; i++) store.getState().addObject(id, { kind: 'rect', id: `o${i}`, x: 0, y: 0, width: 1, height: 1, color: { r: 0, g: 0, b: 0, a: 1 } });
    expect(toasts().at(-1)).toMatchObject({ title: limitMessage('masks') });
    store.getState().addObject(id, { kind: 'rect', id: 'over', x: 0, y: 0, width: 1, height: 1, color: { r: 0, g: 0, b: 0, a: 1 } });
    expect(toasts().at(-1)).toMatchObject({ status: 'warning', title: limitMessage('objects') });
    expect(store.getState().entities.find((e) => e.id === id)!.objects).toHaveLength(MAX_OBJECTS_PER_LAYER);
  });
});

describe('writing back', () => {
  it('puts a change of the store into the page at once, with no comic undo step', () => {
    const store = pageCanvasStore(page().id)!;
    const id = store.getState().addEntity('raster', { name: 'Ink' });
    store.getState().addObject(id, stroke('s'));
    vi.advanceTimersByTime(WRITE_BACK_MS);
    expect(ink(pageRasters(page().canvas)).objects).toEqual([stroke('s')]);
    expect(useComic.getState().past).toHaveLength(0);
    expect(page().canvas.entities).toBe(store.getState().entities);
  });

  it('writes a run of changes once now and once after the wait, not on every change', () => {
    const store = pageCanvasStore(page().id)!;
    const id = store.getState().addEntity('raster', { name: 'Ink' });
    vi.advanceTimersByTime(WRITE_BACK_MS * 2);
    const original = useComic.getState().setPageCanvas;
    const spy = vi.fn(original);
    useComic.setState({ setPageCanvas: spy });
    try {
      // A layer dragged with the move tool: one change on every pointer move.
      for (let x = 1; x <= 30; x++) store.getState().updateEntity(id, { x }, { history: false });
      expect(spy).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(WRITE_BACK_MS);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(ink(pageRasters(page().canvas)).x).toBe(30);
      vi.advanceTimersByTime(WRITE_BACK_MS * 4);
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      useComic.setState({ setPageCanvas: original });
    }
  });

  it('writes what is still waiting when asked', () => {
    const store = pageCanvasStore(page().id)!;
    const id = store.getState().addEntity('raster', { name: 'Ink' });
    store.getState().updateEntity(id, { x: 5 }, { history: false });
    expect(ink(pageRasters(page().canvas)).x).toBe(0);
    flushPageCanvas(page().id);
    expect(ink(pageRasters(page().canvas)).x).toBe(5);
  });

  it('does not take its own write for an outside change (no loop, the history stays)', () => {
    const store = pageCanvasStore(page().id)!;
    store.getState().addEntity('raster', { name: 'Ink' });
    vi.advanceTimersByTime(WRITE_BACK_MS * 2);
    const entities = store.getState().entities;
    expect(store.getState().past).toHaveLength(1);
    expect(store.getState().entities).toBe(entities);
    expect(page().canvas.entities).toBe(entities);
  });

  it('does not write a selection or a tool change', () => {
    const store = pageCanvasStore(page().id)!;
    const before = page().canvas;
    store.getState().select('balloons');
    store.getState().setTool('eraser');
    vi.advanceTimersByTime(WRITE_BACK_MS * 2);
    expect(page().canvas).toBe(before);
  });
});

describe('outside changes', () => {
  it('seed the store again and clear its undo history', () => {
    const store = pageCanvasStore(page().id)!;
    store.getState().addEntity('raster', { name: 'Ink' });
    vi.advanceTimersByTime(WRITE_BACK_MS * 2);
    const id = ink(store.getState().entities).id;
    // The assistant hides the layer.
    useComic.getState().setPageCanvas(page().id, updateRasterLook(page().canvas, id, { isEnabled: false })!);
    expect(ink(store.getState().entities).isEnabled).toBe(false);
    expect(store.getState().past).toHaveLength(0);
    expect(store.getState().selectedEntityId).toBe(id);
    // Not written back again.
    vi.advanceTimersByTime(WRITE_BACK_MS * 2);
    expect(ink(pageRasters(page().canvas)).isEnabled).toBe(false);
  });

  it('keep the history when pictures only got their gallery names', () => {
    useComic.getState().setPageCanvas(page().id, withLayer(page().canvas, [{ ...picture, imageName: null, url: 'blob:local' }]));
    const store = pageCanvasStore(page().id)!;
    store.getState().addEntity('raster');
    vi.advanceTimersByTime(WRITE_BACK_MS * 2);
    const named = page().canvas.entities.map((e) => (e.name === 'Ink' ? { ...e, objects: [{ ...picture, url: 'blob:stored' }] } : e));
    useComic.getState().setPageCanvas(page().id, { ...page().canvas, entities: named });
    expect(store.getState().past).toHaveLength(1);
    expect(ink(store.getState().entities).objects[0]).toMatchObject({ imageName: 'p.png', url: 'blob:stored' });
  });

  it('come from a new paper, which scales the store layers too', () => {
    useComic.getState().setPageCanvas(page().id, withLayer(page().canvas, [stroke('s')]));
    const store = pageCanvasStore(page().id)!;
    store.getState().select(ink(store.getState().entities).id);
    useComic.getState().setPageLayout(page().id, { size: 'B4' });
    expect(store.getState().entities).toEqual(page().canvas.entities);
    expect((ink(store.getState().entities).objects[0] as { width: number }).width).toBeGreaterThan(10);
  });

  it('drop a change of the store that was still waiting', () => {
    const store = pageCanvasStore(page().id)!;
    const id = store.getState().addEntity('raster', { name: 'Ink' });
    store.getState().updateEntity(id, { x: 5 }, { history: false });
    useComic.getState().setPageCanvas(page().id, updateRasterLook(page().canvas, id, { opacity: 0.5 })!);
    vi.advanceTimersByTime(WRITE_BACK_MS * 2);
    expect(ink(pageRasters(page().canvas))).toMatchObject({ x: 0, opacity: 0.5 });
    expect(ink(store.getState().entities)).toMatchObject({ x: 0, opacity: 0.5 });
  });
});

describe('undo', () => {
  it('of the page store goes back to the page; the comic undo leaves the layers and the store alone', () => {
    const store = pageCanvasStore(page().id)!;
    const panels = page().panels.length;
    useComic.getState().setPanelCount(page().id, panels + 1);
    store.getState().addEntity('raster', { name: 'Ink' });
    vi.advanceTimersByTime(WRITE_BACK_MS * 2);
    expect(useComic.getState().past).toHaveLength(1);
    const painted = store.getState().entities;

    useComic.getState().undo();
    expect(page().panels).toHaveLength(panels);
    expect(page().canvas.entities).toBe(painted);
    expect(store.getState().entities).toBe(painted);
    expect(store.getState().past).toHaveLength(1);

    store.getState().undo();
    vi.advanceTimersByTime(WRITE_BACK_MS * 2);
    expect(ink(pageRasters(page().canvas))).toBeUndefined();
    expect(useComic.getState().future).toHaveLength(1);
    store.getState().redo();
    vi.advanceTimersByTime(WRITE_BACK_MS * 2);
    expect(ink(pageRasters(page().canvas))).toBeDefined();
  });
});

describe('dropping stores', () => {
  it('drops the store of a deleted page and of every page of a deleted project', () => {
    useComic.getState().addPage();
    const [first, second] = useComic.getState().projects[0]!.pages;
    pageCanvasStore(first!.id);
    pageCanvasStore(second!.id);
    useComic.getState().deletePage(second!.id);
    expect(livePageCanvases()).toEqual([first!.id]);
    useComic.getState().deleteProject(useComic.getState().projects[0]!.id);
    expect(livePageCanvases()).toEqual([]);
  });

  it('seeds the store again when a project is read again under the same page', () => {
    const store = pageCanvasStore(page().id)!;
    store.getState().addEntity('raster', { name: 'Ink' });
    vi.advanceTimersByTime(WRITE_BACK_MS * 2);
    const project = useComic.getState().projects[0]!;
    const fresh = { ...project, pages: project.pages.map((p) => ({ ...p, canvas: { ...p.canvas, entities: p.canvas.entities.filter((e) => e.name !== 'Ink') } })) };
    useComic.getState().setProjects([fresh]);
    expect(ink(store.getState().entities)).toBeUndefined();
    expect(store.getState().past).toHaveLength(0);
  });

  it(`keeps at most ${MAX_STORES}, writing back the one used longest ago before it goes`, () => {
    const pages = Array.from({ length: MAX_STORES + 1 }, () => emptyPage());
    useComic.getState().setProjects([{ ...newProject('Many'), pages }]);
    const firstStore = pageCanvasStore(pages[0]!.id)!;
    const id = firstStore.getState().addEntity('raster', { name: 'Ink' });
    firstStore.getState().updateEntity(id, { x: 9 }, { history: false });
    for (const p of pages.slice(1, MAX_STORES)) pageCanvasStore(p.id);
    // Using the first one again keeps it; the second is now the oldest.
    pageCanvasStore(pages[0]!.id);
    pageCanvasStore(pages[MAX_STORES]!.id);
    expect(livePageCanvases()).toHaveLength(MAX_STORES);
    expect(livePageCanvases()).not.toContain(pages[1]!.id);
    expect(livePageCanvases()).toContain(pages[0]!.id);
    pageCanvasStore(pages[1]!.id);
    expect(livePageCanvases()).not.toContain(pages[2]!.id);
    for (const p of pages.slice(2, MAX_STORES + 1)) pageCanvasStore(p.id);
    // The first page's store went last; its waiting change reached the page first.
    expect(livePageCanvases()).not.toContain(pages[0]!.id);
    const firstPage = useComic.getState().projects[0]!.pages[0]!;
    expect(ink(pageRasters(firstPage.canvas)).x).toBe(9);
  });
});
