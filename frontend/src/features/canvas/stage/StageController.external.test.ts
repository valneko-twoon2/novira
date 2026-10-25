// @vitest-environment jsdom
// The stage controller over a document its host shows (a comic page): the view follows the host's box, not the store's
// viewport; strokes land in document pixels; the wheel, panning and the view, bbox and pose tools are the host's or absent;
// the selected raster is drawn on the host's content canvas at no more pixels than the document has, and the stage's own
// canvas draws no checkerboard under the layers.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { createCanvasStore, useCanvas, type CanvasStore, type RasterEntity } from '@/state/canvas';
import { StageController } from './StageController';

let canvases: ReturnType<typeof installRecordingCanvases>;
let canvas: HTMLCanvasElement;
let content: HTMLCanvasElement;
let host: HTMLElement;
let store: CanvasStore;
let controller: StageController;
let frames: (() => void)[] = [];
let shown = 500;
const doc = { width: 1000, height: 1400 };

const rect = (width: number, height: number, left = 0, top = 0) =>
  ({ left, top, right: left + width, bottom: top + height, x: left, y: top, width, height, toJSON: () => ({}) }) as DOMRect;

function pointer(type: string, x: number, y: number, init: MouseEventInit = {}) {
  const e = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true, ...init });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  canvas.dispatchEvent(e);
  return e;
}
const flush = () => {
  const run = frames;
  frames = [];
  run.forEach((f) => f());
};
const ink: RasterEntity = { id: 'ink', type: 'raster', seq: 3, name: null, isEnabled: true, isLocked: false, opacity: 1, x: 0, y: 0, objects: [] };

beforeEach(() => {
  canvases = installRecordingCanvases();
  frames = [];
  shown = 500;
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  host = document.createElement('div');
  canvas = document.createElement('canvas');
  content = document.createElement('canvas');
  host.append(canvas);
  document.body.append(host, content);
  // The page is shown 500 px wide at (40, 20) on the screen; the stage's canvas covers it.
  host.getBoundingClientRect = () => rect(shown, (shown * doc.height) / doc.width, 40, 20);
  canvas.getBoundingClientRect = () => rect(shown, (shown * doc.height) / doc.width, 40, 20);
  content.getBoundingClientRect = () => rect(shown, (shown * doc.height) / doc.width, 40, 20);
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  canvas.hasPointerCapture = () => true;
  store = createCanvasStore({ syncParams: false });
  store.setState({ entities: [ink], selectedEntityId: 'ink', tool: 'brush', brushWidth: 20, viewport: { x: 7, y: 9, scale: 3 } });
  controller = new StageController(canvas, host, store, { docSize: () => doc, content: () => content });
  controller.start();
});
afterEach(() => {
  controller.dispose();
  canvases.restore();
  host.remove();
  content.remove();
  vi.unstubAllGlobals();
});

describe('a stage over a host document', () => {
  it('paints in document pixels from the host box, whatever the store viewport says', () => {
    pointer('pointerdown', 40 + 50, 20 + 100);
    pointer('pointermove', 40 + 250, 20 + 100);
    pointer('pointerup', 40 + 250, 20 + 100);
    const stroke = store.getState().entities[0]!.objects[0]!;
    expect(stroke).toMatchObject({ kind: 'stroke', tool: 'brush', width: 20, points: [100, 200, 500, 200] });
    expect(store.getState().viewport).toEqual({ x: 7, y: 9, scale: 3 });
    expect(useCanvas.getState().entities).toEqual([]);
  });

  it('follows the host zoom: the same screen point is another document point', () => {
    shown = 1000;
    pointer('pointerdown', 40 + 100, 20 + 100);
    pointer('pointerup', 40 + 100, 20 + 100);
    expect(store.getState().entities[0]!.objects[0]).toMatchObject({ points: [100, 100] });
  });

  it('leaves the wheel, the middle button and the view, bbox and pose tools to the host', () => {
    const wheel = new WheelEvent('wheel', { deltaY: -100, cancelable: true, bubbles: true });
    canvas.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
    expect(store.getState().viewport).toEqual({ x: 7, y: 9, scale: 3 });
    pointer('pointerdown', 100, 100, { button: 1 });
    pointer('pointerup', 100, 100, { button: 1 });
    for (const tool of ['view', 'bbox', 'pose'] as const) {
      store.getState().setTool(tool);
      pointer('pointerdown', 100, 100);
      pointer('pointermove', 200, 200);
      pointer('pointerup', 200, 200);
    }
    expect(store.getState().entities).toEqual([ink]);
    expect(store.getState().bbox).toEqual(createCanvasStore({ syncParams: false }).getState().bbox);
    expect(canvas.setPointerCapture).not.toHaveBeenCalled();
  });

  it('moves and resizes the box with the box tool when the host limits it, through the host limit', () => {
    controller.dispose();
    const limit = vi.fn((b: { x: number; y: number; width: number; height: number }) => ({ ...b, x: Math.min(b.x, 100), width: Math.min(b.width, 600) }));
    controller = new StageController(canvas, host, store, { docSize: () => doc, content: () => content, limitBbox: limit });
    controller.start();
    store.getState().setBbox({ x: 0, y: 0, width: 512, height: 512 }, { history: false });
    store.getState().setTool('bbox');
    // Inside the box: a move of 200 screen pixels is 400 document pixels, held back to x = 100 by the host.
    pointer('pointerdown', 40 + 50, 20 + 50);
    pointer('pointermove', 40 + 250, 20 + 50);
    pointer('pointerup', 40 + 250, 20 + 50);
    expect(limit).toHaveBeenCalled();
    expect(store.getState().bbox).toMatchObject({ x: 100, y: 0, width: 512, height: 512 });
    // The east handle at the box's right edge, dragged far out, is held to 600 wide.
    const edge = 40 + (100 + 512) * 0.5;
    pointer('pointerdown', edge, 20 + 128);
    pointer('pointermove', edge + 200, 20 + 128);
    pointer('pointerup', edge + 200, 20 + 128);
    expect(store.getState().bbox.width).toBe(600);
    expect(store.getState().entities).toEqual([ink]);
  });

  it('draws the selected layer and the live stroke on the content canvas, at most at document size', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    pointer('pointerdown', 40 + 50, 20 + 100);
    pointer('pointermove', 40 + 250, 20 + 100);
    flush();
    // Shown 500 px wide at a device pixel ratio of 2: 1000 pixels, the document's own.
    expect(content.width).toBe(1000);
    expect(content.height).toBe(1400);
    const rec = canvases.of(content);
    expect(rec.of('drawImage').length).toBeGreaterThan(0);
    // Shown larger than the document: the document's pixels, no more.
    shown = 2000;
    controller.invalidate();
    flush();
    expect(content.width).toBe(1000);
    // Shown smaller: fewer pixels.
    shown = 200;
    controller.invalidate();
    flush();
    expect(content.width).toBe(400);
  });

  it('draws nothing on the content canvas while a slot or no layer is chosen', () => {
    const painted: RasterEntity = { ...ink, objects: [{ kind: 'rect', id: 'r', x: 10, y: 10, width: 100, height: 100, color: { r: 0, g: 0, b: 0, a: 1 } }] };
    const slot: RasterEntity = { ...ink, id: 'panels', objects: [], slot: 'panels' };
    store.setState({ entities: [slot, painted], selectedEntityId: 'ink' });
    flush();
    expect(canvases.of(content).of('drawImage')).toHaveLength(1);
    for (const selectedEntityId of [null, 'panels']) {
      store.setState({ selectedEntityId });
      flush();
    }
    expect(canvases.of(content).of('drawImage')).toHaveLength(1);
  });

  it('draws no checkerboard on its own canvas', () => {
    controller.invalidate();
    flush();
    const rec = canvases.of(canvas);
    expect(rec.of('createPattern')).toHaveLength(0);
    expect(rec.of('clearRect').length).toBeGreaterThan(0);
  });
});
