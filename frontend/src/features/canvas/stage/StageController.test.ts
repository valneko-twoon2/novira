// @vitest-environment jsdom
// The stage controller on a jsdom canvas: pointer, wheel and key handling for every tool, and the render loop it drives.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { t } from '@/i18n';
import { useCanvas, type PoseObject } from '@/state/canvas';
import { useParams } from '@/state/params';
import { useQueue } from '@/state/queue';
import { toast } from '@/state/toasts';
import { objectsBounds } from '@/ui/canvasDraw/bounds';
import { J } from '@/state/pose/pose';
import { StageController } from './StageController';

vi.mock('@/state/toasts', async (original) => ({ ...(await original<typeof import('@/state/toasts')>()), toast: vi.fn() }));

let canvases: ReturnType<typeof installRecordingCanvases>;
let canvas: HTMLCanvasElement;
let host: HTMLElement;
let controller: StageController;
let frames: (() => void)[] = [];
let resizeCallback: (() => void) | null = null;

const rect = (width: number, height: number) => ({ left: 0, top: 0, right: width, bottom: height, x: 0, y: 0, width, height, toJSON: () => ({}) }) as DOMRect;

function pointer(type: string, x: number, y: number, init: MouseEventInit = {}) {
  const e = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true, ...init });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  canvas.dispatchEvent(e);
  return e;
}
const drag = (from: [number, number], to: [number, number], init: MouseEventInit = {}) => {
  pointer('pointerdown', ...from, init);
  pointer('pointermove', ...to, init);
  pointer('pointerup', ...to, init);
};
const flush = () => {
  const run = frames;
  frames = [];
  run.forEach((f) => f());
};
const state = () => useCanvas.getState();
const lastObject = () => state().entities[0]!.objects.at(-1)!;

beforeEach(() => {
  canvases = installRecordingCanvases();
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        resizeCallback = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.mocked(toast).mockClear();
  host = document.createElement('div');
  canvas = document.createElement('canvas');
  host.append(canvas);
  document.body.append(host);
  host.getBoundingClientRect = () => rect(800, 600);
  canvas.getBoundingClientRect = () => rect(800, 600);
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  canvas.hasPointerCapture = () => true;
  useParams.setState({ aspectLocked: false, aspectRatio: 'free' });
  useCanvas.setState({
    entities: [],
    selectedEntityId: null,
    tool: 'brush',
    viewport: { x: 0, y: 0, scale: 1 },
    bbox: { x: 100, y: 100, width: 200, height: 200 },
    groupHidden: { raster: false, control: false, inpaint: false, regional: false },
    settings: { showGrid: false, snapToGrid: false, showHud: true, clipToBbox: false, preserveMask: false, autoProcess: false, dimOutsideBbox: true },
    stagedImageNames: [],
    brushWidth: 40,
    mosaicWidth: 40,
    eraserWidth: 40,
    fillColor: { r: 9, g: 8, b: 7, a: 1 },
  });
  controller = new StageController(canvas, host);
  controller.start();
});
afterEach(() => {
  controller.dispose();
  canvases.restore();
  host.remove();
  vi.unstubAllGlobals();
});

describe('StageController setup', () => {
  it('sizes the canvas to its host and redraws on resize and on state changes', () => {
    expect(canvas.style.width).toBe('800px');
    expect(canvas.width).toBe(800);
    host.getBoundingClientRect = () => rect(500, 400);
    resizeCallback!();
    expect(canvas.style.height).toBe('400px');
    const rec = canvases.of(canvas);
    const before = rec.of('clearRect').length;
    state().setTool('rect');
    expect(frames).toHaveLength(1);
    state().setTool('move');
    expect(frames).toHaveLength(1);
    flush();
    expect(rec.of('clearRect').length).toBe(before + 1);
  });

  it('stops listening after dispose', () => {
    controller.dispose();
    drag([150, 150], [160, 160]);
    expect(state().entities).toHaveLength(0);
  });

  it('follows the tool in the mouse cursor', () => {
    const cursorFor = (tool: ReturnType<typeof state>['tool']) => {
      state().setTool(tool);
      pointer('pointermove', 5, 5);
      return canvas.style.cursor;
    };
    expect(cursorFor('brush')).toBe('none');
    expect(cursorFor('rect')).toBe('crosshair');
    expect(cursorFor('colorPicker')).toBe('crosshair');
    expect(cursorFor('move')).toBe('move');
    expect(cursorFor('view')).toBe('grab');
  });
});

describe('painting', () => {
  it('draws a stroke on a new raster layer when nothing is selected', () => {
    drag([150, 150], [200, 180]);
    expect(state().entities).toHaveLength(1);
    const o = lastObject();
    expect(o).toMatchObject({ kind: 'stroke', tool: 'brush', width: 40, points: [150, 150, 200, 180], clip: null });
  });

  it('keeps a stroke relative to the layer offset, clips to the bbox when asked and straightens with shift', () => {
    const id = state().addEntity('raster', { x: 10, y: 20 });
    state().select(id);
    state().setSettings({ clipToBbox: true });
    pointer('pointerdown', 150, 150);
    pointer('pointermove', 160, 160);
    pointer('pointermove', 170, 190, { shiftKey: true });
    pointer('pointermove', 170.2, 190.2);
    pointer('pointerup', 170, 190);
    expect(lastObject()).toMatchObject({ points: [140, 130, 160, 170], clip: { x: 90, y: 80, width: 200, height: 200 } });
  });

  it('ignores a right click and a second press during a drag', () => {
    pointer('pointerdown', 150, 150, { button: 2 });
    expect(state().entities).toHaveLength(0);
    pointer('pointerdown', 150, 150);
    pointer('pointerdown', 10, 10);
    pointer('pointerup', 150, 150);
    expect(state().entities[0]!.objects).toHaveLength(1);
  });

  it('does not create a layer for the eraser and warns about a locked or hidden layer', () => {
    state().setTool('eraser');
    drag([150, 150], [200, 200]);
    expect(state().entities).toHaveLength(0);

    state().setTool('brush');
    const id = state().addEntity('raster');
    state().select(id);
    state().updateEntity(id, { isLocked: true });
    drag([150, 150], [200, 200]);
    expect(toast).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'warning' }));
    state().updateEntity(id, { isLocked: false, isEnabled: false });
    drag([150, 150], [200, 200]);
    expect(toast).toHaveBeenCalledTimes(2);
    state().updateEntity(id, { isEnabled: true });
    state().setGroupHidden('raster', true);
    drag([150, 150], [200, 200]);
    expect(toast).toHaveBeenCalledTimes(3);
    expect(state().entities[0]!.objects).toHaveLength(0);
  });

  it('does not paint, fill a rectangle or a lasso into a slot, and says so', () => {
    const slot = state().addEntity('raster', { slot: 'panels' });
    state().select(slot);
    for (const tool of ['brush', 'eraser', 'mosaic', 'rect', 'lasso'] as const) {
      state().setTool(tool);
      drag([150, 150], [200, 200]);
    }
    expect(state().entities).toHaveLength(1);
    expect(state().entities[0]!.objects).toHaveLength(0);
    expect(toast).toHaveBeenCalledTimes(5);
    expect(toast).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'warning', title: t('canvas.toast.slotLayer') }));
  });

  it('erases with the eraser width and pixelates with a mosaic block, but not on a mask', () => {
    const id = state().addEntity('raster');
    state().select(id);
    state().setTool('eraser');
    state().setMosaicBlock(24);
    drag([150, 150], [200, 200]);
    expect(lastObject()).toMatchObject({ tool: 'eraser', width: 40 });
    state().setTool('mosaic');
    drag([150, 150], [200, 200]);
    expect(lastObject()).toMatchObject({ tool: 'mosaic', block: 24 });

    const mask = state().addEntity('inpaint');
    state().select(mask);
    drag([150, 150], [200, 200]);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(state().entities.find((e) => e.id === mask)!.objects).toHaveLength(0);
  });

  it('shows the in-progress stroke while dragging', () => {
    pointer('pointerdown', 150, 150);
    pointer('pointermove', 200, 200);
    flush();
    expect(canvases.all.some((r) => r.of('lineTo').length > 0)).toBe(true);
    pointer('pointerleave', 0, 0);
    flush();
  });
});

describe('rectangles', () => {
  beforeEach(() => state().setTool('rect'));

  it('adds a rectangle from the drag, a square with shift, and nothing for a click', () => {
    drag([100, 100], [180, 140]);
    expect(lastObject()).toMatchObject({ kind: 'rect', x: 100, y: 100, width: 80, height: 40 });
    drag([100, 100], [150, 120], { shiftKey: true });
    expect(lastObject()).toMatchObject({ width: 50, height: 50 });
    drag([300, 300], [250, 260]);
    expect(lastObject()).toMatchObject({ x: 250, y: 260, width: 50, height: 40 });
    const count = state().entities[0]!.objects.length;
    drag([100, 100], [100, 100]);
    expect(state().entities[0]!.objects).toHaveLength(count);
  });
});

describe('moving a layer', () => {
  it('moves the selected layer with the drag and records one history step', () => {
    const id = state().addEntity('raster', { objects: [{ kind: 'rect', id: 'r', x: 0, y: 0, width: 20, height: 20, color: { r: 0, g: 0, b: 0, a: 1 } }] });
    state().select(id);
    state().setTool('move');
    const past = state().past.length;
    pointer('pointerdown', 10, 10);
    pointer('pointermove', 40, 30);
    pointer('pointermove', 50, 60);
    pointer('pointerup', 50, 60);
    expect(state().entities[0]).toMatchObject({ x: 40, y: 50 });
    expect(state().past.length).toBe(past + 1);
  });

  it('does nothing without a selection and warns about a locked layer', () => {
    state().setTool('move');
    drag([10, 10], [40, 40]);
    const id = state().addEntity('raster');
    state().select(id);
    state().updateEntity(id, { isLocked: true });
    drag([10, 10], [40, 40]);
    expect(state().entities[0]).toMatchObject({ x: 0, y: 0 });
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('does not move a slot and says so', () => {
    const slot = state().addEntity('raster', { slot: 'panels' });
    state().select(slot);
    state().setTool('move');
    drag([10, 10], [40, 40]);
    expect(state().entities[0]).toMatchObject({ x: 0, y: 0 });
    expect(toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: t('canvas.toast.slotLayer') }));
  });
});

describe('the pose tool', () => {
  const pose = () => state().entities[0]!.objects[0] as PoseObject;
  const joint = (i: number): [number, number] => [pose().points[i * 2]!, pose().points[i * 2 + 1]!];
  const place = () => {
    state().setTool('pose');
    pointer('pointerdown', 200, 200);
    pointer('pointerup', 200, 200);
  };

  it('places a standing pose on a new control layer, sized to the bounding box', () => {
    place();
    expect(state().entities.map((e) => e.type)).toEqual(['control']);
    const b = objectsBounds([{ ...pose(), width: 0 }])!;
    expect(b.height).toBeCloseTo(160 + 2, 0);
    expect(b.x + b.width / 2).toBeCloseTo(200, 0);
    expect(pose().hidden).toEqual([]);
  });

  it('turns a dragged joint around its parent with everything below it, as one history step', () => {
    place();
    const elbow = joint(J.rElbow);
    const len = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const upper = len(joint(J.rShoulder), elbow);
    const fore = len(elbow, joint(J.rWrist));
    const past = state().past.length;
    pointer('pointerdown', ...elbow);
    pointer('pointermove', elbow[0] - 30, elbow[1] - 40);
    pointer('pointermove', elbow[0] - 40, elbow[1] - 60);
    pointer('pointerup', elbow[0] - 40, elbow[1] - 60);
    expect(len(joint(J.rShoulder), joint(J.rElbow))).toBeCloseTo(upper, 5);
    expect(len(joint(J.rElbow), joint(J.rWrist))).toBeCloseTo(fore, 5);
    expect(joint(J.rElbow)).not.toEqual(elbow);
    expect(state().past.length).toBe(past + 1);
  });

  it('moves only the joint with shift, hides it with alt, and leaves a locked layer alone', () => {
    place();
    const wrist = joint(J.rWrist);
    const elbow = joint(J.rElbow);
    drag(wrist, [wrist[0] + 15, wrist[1] + 5], { shiftKey: true });
    expect(joint(J.rWrist)).toEqual([wrist[0] + 15, wrist[1] + 5]);
    expect(joint(J.rElbow)).toEqual(elbow);
    pointer('pointerdown', ...joint(J.rWrist), { altKey: true });
    pointer('pointerup', ...joint(J.rWrist));
    expect(pose().hidden).toEqual([J.rWrist]);
    state().updateEntity(state().entities[0]!.id, { isLocked: true });
    const before = pose();
    drag(joint(J.lWrist), [10, 10]);
    expect(pose()).toBe(before);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ status: 'warning' }));
  });
});

describe('the bounding box', () => {
  beforeEach(() => state().setTool('bbox'));

  it('moves by the drag, snapped to 8 px (to 64 px on the grid, exact with alt)', () => {
    drag([200, 200], [213, 224]);
    expect(state().bbox).toMatchObject({ x: 112, y: 128, width: 200, height: 200 });
    drag([200, 200], [213, 224], { altKey: true });
    expect(state().bbox).toMatchObject({ x: 125, y: 152 });
    state().setSettings({ snapToGrid: true });
    drag([200, 200], [240, 240]);
    expect(state().bbox.x % 64).toBe(0);
  });

  it('resizes from a handle, keeping the ratio with shift or a locked aspect ratio', () => {
    const r = state().bbox;
    const corner: [number, number] = [r.x + r.width, r.y + r.height];
    drag(corner, [corner[0] + 100, corner[1] + 40]);
    expect(state().bbox).toMatchObject({ x: r.x, y: r.y, width: 304, height: 240 });
    const r2 = state().bbox;
    drag([r2.x + r2.width, r2.y + r2.height], [r2.x + r2.width + 60, r2.y + r2.height + 10], { shiftKey: true });
    expect(state().bbox.width / state().bbox.height).toBeCloseTo(304 / 240, 1);
    useParams.setState({ aspectLocked: true, aspectRatio: '1:1' });
    const r3 = state().bbox;
    drag([r3.x + r3.width, r3.y + r3.height], [r3.x + r3.width + 64, r3.y + r3.height]);
    expect(state().bbox.width / state().bbox.height).toBeCloseTo(r3.width / r3.height, 1);
  });

  it('does nothing outside the box and picks the resize cursor over a handle', () => {
    pointer('pointermove', 20, 20);
    expect(canvas.style.cursor).toBe('default');
    drag([20, 20], [60, 60]);
    expect(state().bbox).toMatchObject({ x: 100, y: 100, width: 200, height: 200 });
    pointer('pointermove', 300, 300);
    expect(canvas.style.cursor).toBe('nwse-resize');
    pointer('pointermove', 200, 200);
    expect(canvas.style.cursor).toBe('move');
    pointer('pointerdown', 300, 300);
    expect(canvas.style.cursor).toBe('nwse-resize');
    pointer('pointerup', 300, 300);
    pointer('pointerdown', 200, 200);
    expect(canvas.style.cursor).toBe('move');
    pointer('pointerup', 200, 200);
  });
});

describe('the colour picker', () => {
  it('takes the colour under the pointer from the visible layers, and keeps the colour over empty pixels', () => {
    canvases.restore();
    canvases = installRecordingCanvases({ pixel: () => [10, 20, 30, 255] });
    state().addEntity('raster', { objects: [{ kind: 'rect', id: 'r', x: 0, y: 0, width: 50, height: 50, color: { r: 1, g: 1, b: 1, a: 1 } }] });
    state().addEntity('raster', { isEnabled: false });
    state().setTool('colorPicker');
    pointer('pointerdown', 10, 10);
    expect(state().fillColor).toMatchObject({ r: 10, g: 20, b: 30, a: 1 });
    canvases.restore();
    canvases = installRecordingCanvases({ pixel: () => [200, 200, 200, 0] });
    pointer('pointermove', 12, 12);
    expect(state().fillColor).toMatchObject({ r: 10, g: 20, b: 30 });
    pointer('pointerup', 12, 12);
  });
});

describe('panning and zooming', () => {
  it('pans with the view tool, the middle button or the space bar', () => {
    state().setTool('view');
    drag([100, 100], [130, 90]);
    expect(state().viewport).toMatchObject({ x: 30, y: -10, scale: 1 });
    state().setTool('brush');
    drag([100, 100], [110, 110], { button: 1 });
    expect(state().viewport).toMatchObject({ x: 40, y: 0 });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(canvas.style.cursor).toBe('grab');
    pointer('pointerdown', 100, 100);
    expect(canvas.style.cursor).toBe('grabbing');
    pointer('pointermove', 105, 100);
    pointer('pointerup', 105, 100);
    expect(state().viewport.x).toBe(45);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
    expect(canvas.style.cursor).toBe('none');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    window.dispatchEvent(new Event('blur'));
    expect(canvas.style.cursor).toBe('none');
  });

  it('ignores the space bar while typing', () => {
    const input = document.createElement('input');
    document.body.append(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(canvas.style.cursor).toBe('none');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    input.remove();
  });

  it('zooms around the pointer with the wheel, and resizes the brush with ctrl + wheel', () => {
    canvas.dispatchEvent(new WheelEvent('wheel', { clientX: 400, clientY: 300, deltaY: -100, cancelable: true }));
    expect(state().viewport.scale).toBeGreaterThan(1);
    canvas.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, cancelable: true }));
    expect(state().brushWidth).toBeGreaterThan(40);
    state().setTool('eraser');
    canvas.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: 100, cancelable: true }));
    expect(state().eraserWidth).toBeLessThan(40);
    state().setTool('mosaic');
    canvas.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, cancelable: true }));
    expect(state().mosaicWidth).toBeGreaterThan(40);
  });
});

describe('the staged picture', () => {
  it('draws the live progress image while the canvas is generating', () => {
    useQueue.setState({
      items: [{ id: 'q1', destination: 'canvas' } as never],
      progress: { itemId: 'q1', progressImageUrl: '/live.png' } as never,
    });
    flush();
    pointer('pointermove', 5, 5);
    flush();
    useQueue.setState({ progress: null });
    state().addStagedImage('missing.png');
    pointer('pointermove', 6, 6);
    flush();
    expect(canvases.of(canvas).of('clearRect').length).toBeGreaterThan(1);
  });
});
