// @vitest-environment jsdom
// The bucket tool on the stage: a press fills from the pressed point of the chosen raster layer, inside the generation box on
// the Image tab's kind of stage and inside the whole document over a host's document; no layer or a slot gives a warning.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { createCanvasStore, type CanvasStore, type RasterEntity } from '@/state/canvas';
import { useToasts } from '@/state/toasts';
import { StageController } from './StageController';

const filled = vi.fn(async () => true);
vi.mock('../actions', async (orig) => ({ ...(await orig<typeof import('../actions')>()), bucketFill: (...a: unknown[]) => (filled as (...x: unknown[]) => Promise<boolean>)(...a) }));

let canvases: ReturnType<typeof installRecordingCanvases>;
let canvas: HTMLCanvasElement;
let host: HTMLElement;
let store: CanvasStore;
let controller: StageController;
const ink: RasterEntity = { id: 'ink', type: 'raster', seq: 1, name: null, isEnabled: true, isLocked: false, opacity: 1, x: 0, y: 0, objects: [] };
const rect = (width: number, height: number, left = 0, top = 0) =>
  ({ left, top, right: left + width, bottom: top + height, x: left, y: top, width, height, toJSON: () => ({}) }) as DOMRect;

function press(x: number, y: number) {
  const e = new MouseEvent('pointerdown', { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  canvas.dispatchEvent(e);
}

function make(external: boolean) {
  host = document.createElement('div');
  canvas = document.createElement('canvas');
  host.append(canvas);
  document.body.append(host);
  // Shown 500 px wide at (40, 20): half the size of a 1000 x 1400 document.
  host.getBoundingClientRect = () => rect(500, 700, 40, 20);
  canvas.getBoundingClientRect = () => rect(500, 700, 40, 20);
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  canvas.hasPointerCapture = () => true;
  store = createCanvasStore({ syncParams: false });
  store.setState({ entities: [ink], selectedEntityId: 'ink', tool: 'bucket', viewport: { x: 0, y: 0, scale: 1 } });
  store.getState().setBbox({ x: 8, y: 16, width: 128, height: 64 }, { history: false });
  controller = new StageController(canvas, host, store, external ? { docSize: () => ({ width: 1000, height: 1400 }), content: () => null } : null);
  controller.start();
}

beforeEach(() => {
  canvases = installRecordingCanvases();
  filled.mockClear();
  useToasts.setState({ toasts: [] });
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => {
  controller.dispose();
  canvases.restore();
  host.remove();
  vi.unstubAllGlobals();
});

describe('the bucket tool', () => {
  it('fills inside the generation box on a stage of its own', () => {
    make(false);
    press(40 + 30, 20 + 50);
    expect(filled).toHaveBeenCalledTimes(1);
    // The stage fitted the box in its view, so the point is read through the store's viewport.
    const [, at, area] = filled.mock.calls[0] as unknown as [string, { x: number; y: number }, unknown];
    const v = store.getState().viewport;
    expect(at.x).toBeCloseTo((30 - v.x) / v.scale, 5);
    expect(at.y).toBeCloseTo((50 - v.y) / v.scale, 5);
    expect(area).toEqual({ x: 8, y: 16, width: 128, height: 64 });
  });

  it('fills inside the whole document over a host\'s document, in document pixels', () => {
    make(true);
    press(40 + 50, 20 + 100);
    expect(filled).toHaveBeenCalledWith('ink', { x: 100, y: 200 }, { x: 0, y: 0, width: 1000, height: 1400 }, store);
  });

  it('warns when no layer is chosen, and when the layer is a slot', () => {
    make(true);
    store.getState().select(null);
    press(100, 100);
    expect(filled).not.toHaveBeenCalled();
    expect(useToasts.getState().toasts.at(-1)?.status).toBe('warning');
    useToasts.setState({ toasts: [] });
    store.setState({ entities: [{ ...ink, id: 'panels', slot: 'panels' }], selectedEntityId: 'panels' });
    press(100, 100);
    expect(filled).not.toHaveBeenCalled();
    expect(useToasts.getState().toasts.at(-1)?.status).toBe('warning');
  });

  it('does not fill from a locked layer', () => {
    make(true);
    store.setState({ entities: [{ ...ink, isLocked: true }] });
    press(100, 100);
    expect(filled).not.toHaveBeenCalled();
  });
});
