// @vitest-environment jsdom
// Queuing an inpaint of a comic page: the Canvas's request builder runs on the page's store, the box is fitted when it
// does not suit the page, the queued items are tied to the page, and the readiness names what is missing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { newProject } from '@/state/comic/document';
import { pageCanvasStore, resetPageCanvases } from '@/state/comic/pageCanvas';
import { pageOfInpaint, resetPageInpaints } from '@/state/comic/pageInpaint';
import { activePage, useComic } from '@/state/comic/store';
import { useToasts } from '@/state/toasts';
import { pageInpaintReadiness, queuePageInpaint } from './pageInpaint';

vi.mock('@/ui/canvasDraw/imageCache', () => ({
  getImage: () => null,
  imageVersion: () => 0,
  preloadImages: () => Promise.resolve(),
  onImageLoaded: () => () => {},
}));
vi.mock('@/features/canvas/register', () => ({ canvasReadiness: () => [] }));
vi.mock('@/features/comic/pageRender', () => ({
  preparePage: async () => ({}),
  drawPage: () => document.createElement('canvas'),
}));

let canvases: ReturnType<typeof installRecordingCanvases>;
const page = () => activePage(useComic.getState())!;
const red = { r: 255, g: 0, b: 0, a: 1 };

beforeEach(() => {
  canvases = installRecordingCanvases({ pixel: () => [255, 255, 255, 255] });
  let urls = 0;
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(['png']));
  };
  URL.createObjectURL = () => `blob:${++urls}`;
  resetPageCanvases();
  resetPageInpaints();
  useToasts.setState({ toasts: [] });
  useComic.getState().setProjects([newProject('Rain')]);
});
afterEach(() => {
  canvases.restore();
  resetPageCanvases();
  resetPageInpaints();
  vi.restoreAllMocks();
});

/** A mask layer with a stroke on it, chosen in the page's store. */
function addMask(x: number, y: number) {
  const store = pageCanvasStore(page().id)!;
  const id = store.getState().addEntity('inpaint');
  store.getState().addObject(id, { kind: 'rect', id: 'm', x, y, width: 100, height: 100, color: red });
  return store;
}

describe('the readiness of a page inpaint', () => {
  it('asks for a mask', () => {
    pageCanvasStore(page().id);
    expect(pageInpaintReadiness(page().id)).toHaveLength(1);
    addMask(10, 10);
    expect(pageInpaintReadiness(page().id)).toEqual([]);
  });

  it('has nothing to say about a page that is gone', () => {
    expect(pageInpaintReadiness('nope')).toEqual([]);
  });
});

describe('queuing an inpaint', () => {
  it('does not queue without a mask', async () => {
    const enqueue = vi.spyOn(backend, 'enqueue');
    pageCanvasStore(page().id);
    expect(await queuePageInpaint(page().id)).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
    expect(useToasts.getState().toasts.some((x) => x.status === 'warning')).toBe(true);
  });

  it('queues an inpaint of the box, tied to the page', async () => {
    const enqueue = vi.spyOn(backend, 'enqueue').mockResolvedValue([{ id: 55 }] as never);
    const store = addMask(300, 300);
    store.getState().setBbox({ x: 200, y: 200, width: 512, height: 640 }, { history: false });
    expect(await queuePageInpaint(page().id)).toBe(true);
    const request = enqueue.mock.calls[0]![0];
    expect(request.origin).toBe('canvas');
    expect(request.destination).toBe('canvas');
    expect(request.params.generationMode).toBe('inpaint');
    expect(request.params.width).toBe(512);
    expect(request.params.height).toBe(640);
    expect(request.initImageUrl).toMatch(/^blob:/);
    expect(request.maskImageUrl).toMatch(/^blob:/);
    expect(pageOfInpaint(55)).toBe(page().id);
    expect(store.getState().bbox).toEqual({ x: 200, y: 200, width: 512, height: 640 });
  });

  it('fits a box that is too large around the mask first, and says so', async () => {
    const enqueue = vi.spyOn(backend, 'enqueue').mockResolvedValue([{ id: 56 }] as never);
    const store = addMask(1400, 2000);
    // The page's whole box, as a new page has it.
    expect(store.getState().bbox.height).toBeGreaterThan(2048);
    expect(await queuePageInpaint(page().id)).toBe(true);
    const box = store.getState().bbox;
    expect(box.width * box.height).toBeLessThanOrEqual(1536 * 1536);
    expect(box.x + box.width).toBeLessThanOrEqual(1654);
    expect(box.y + box.height).toBeGreaterThan(2000);
    expect(enqueue.mock.calls[0]![0].params.height).toBe(box.height);
    expect(useToasts.getState().toasts.some((x) => x.status === 'info')).toBe(true);
  });

  it('tells the user when the queue refuses, and ties nothing to the page', async () => {
    vi.spyOn(backend, 'enqueue').mockRejectedValue(new Error('down'));
    addMask(300, 300);
    expect(await queuePageInpaint(page().id)).toBe(false);
    expect(useToasts.getState().toasts.some((x) => x.status === 'error')).toBe(true);
  });
});
