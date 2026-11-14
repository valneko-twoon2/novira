// @vitest-environment jsdom
// The stage under fingers (the phone's canvas editor): one finger paints with the tool in hand, a second finger turns
// what the first began into a pinch that zooms and pans the view, and the finger left after a pinch paints nothing
// until every finger is lifted. A pen or a mouse is not affected.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { useCanvas } from '@/state/canvas';
import { StageController } from './StageController';

vi.mock('@/state/toasts', async (original) => ({ ...(await original<typeof import('@/state/toasts')>()), toast: vi.fn() }));

let canvases: ReturnType<typeof installRecordingCanvases>;
let canvas: HTMLCanvasElement;
let host: HTMLElement;
let controller: StageController;

const rect = (width: number, height: number) => ({ left: 0, top: 0, right: width, bottom: height, x: 0, y: 0, width, height, toJSON: () => ({}) }) as DOMRect;

function finger(type: string, id: number, x: number, y: number, pointerType = 'touch') {
  const e = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true });
  Object.defineProperty(e, 'pointerId', { value: id });
  Object.defineProperty(e, 'pointerType', { value: pointerType });
  canvas.dispatchEvent(e);
}
const state = () => useCanvas.getState();
const strokes = () => state().entities.flatMap((e) => e.objects);

beforeEach(() => {
  canvases = installRecordingCanvases();
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  host = document.createElement('div');
  canvas = document.createElement('canvas');
  host.append(canvas);
  document.body.append(host);
  host.getBoundingClientRect = () => rect(400, 600);
  canvas.getBoundingClientRect = () => rect(400, 600);
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  canvas.hasPointerCapture = () => true;
  useCanvas.setState({
    entities: [],
    selectedEntityId: null,
    tool: 'brush',
    viewport: { x: 0, y: 0, scale: 1 },
    bbox: { x: 0, y: 0, width: 400, height: 600 },
    settings: { showGrid: false, snapToGrid: false, showHud: true, clipToBbox: false, preserveMask: false, autoProcess: false, dimOutsideBbox: true },
    brushWidth: 20,
  });
  controller = new StageController(canvas, host);
  controller.start();
  // The first start fits the bbox into the stage; the cases start from a plain view.
  useCanvas.setState({ viewport: { x: 0, y: 0, scale: 1 } });
});
afterEach(() => {
  controller.dispose();
  canvases.restore();
  host.remove();
  vi.unstubAllGlobals();
});

describe('fingers on the stage', { tags: [] }, () => {
  it('paints a stroke with one finger', { tags: ['equivalence'] }, () => {
    finger('pointerdown', 1, 100, 100);
    finger('pointermove', 1, 150, 120);
    finger('pointerup', 1, 150, 120);
    expect(strokes()).toHaveLength(1);
    expect(strokes()[0]).toMatchObject({ kind: 'stroke', points: [100, 100, 150, 120] });
    expect(state().viewport).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it(
    'turns a second finger into a pinch that drops the begun stroke, and paints nothing until every finger is lifted',
    { tags: ['state-transition'] },
    () => {
      finger('pointerdown', 1, 100, 100);
      finger('pointerdown', 2, 200, 100);
      // The fingers spread to twice their distance around the same midpoint (150, 100).
      finger('pointermove', 1, 50, 100);
      finger('pointermove', 2, 250, 100);
      expect(state().viewport.scale).toBeCloseTo(2);
      expect(state().viewport.x).toBeCloseTo(-150);
      finger('pointerup', 2, 250, 100);
      // The finger left behind moves without painting or panning.
      const after = state().viewport;
      finger('pointermove', 1, 20, 300);
      expect(state().viewport).toEqual(after);
      finger('pointerup', 1, 20, 300);
      expect(strokes()).toHaveLength(0);
      // Once every finger is up, one finger paints again.
      finger('pointerdown', 3, 60, 60);
      finger('pointermove', 3, 80, 60);
      finger('pointerup', 3, 80, 60);
      expect(strokes()).toHaveLength(1);
    },
  );

  it('leaves a pen as it was: a second pen press during a stroke starts no pinch', { tags: ['condition'] }, () => {
    finger('pointerdown', 1, 100, 100, 'pen');
    finger('pointerdown', 2, 200, 100, 'pen');
    finger('pointermove', 1, 140, 100, 'pen');
    finger('pointerup', 1, 140, 100, 'pen');
    expect(strokes()).toHaveLength(1);
    expect(state().viewport).toEqual({ x: 0, y: 0, scale: 1 });
  });
});
