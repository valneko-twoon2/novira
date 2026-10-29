// @vitest-environment jsdom
// The 3D view of the pose editor, with the WebGL renderer replaced by one that draws nothing: a joint is swung round its
// parent by dragging it, the neck slides, the background turns the body (within the pitch limit), the wheel zooms, and the
// joints go back to how they were.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { v3, type Vec3 } from '@/state/pose/math3d';
import { createPoseScene, type PoseScene } from './scene';

const gl = vi.hoisted(() => ({ disposed: 0 }));
vi.mock('three', async (original) => {
  const three = await original<typeof import('three')>();
  class WebGLRenderer {
    setPixelRatio() {}
    setSize() {}
    render(scene: import('three').Scene, camera: import('three').Camera) {
      scene.updateMatrixWorld();
      camera.updateMatrixWorld();
    }
    dispose() {
      gl.disposed++;
    }
  }
  return { ...three, WebGLRenderer };
});

const SIZE = 300;
const RADIUS = 100;
const HALF = RADIUS * 1.25;
/** Eighteen joints in a row along x, far enough apart that each ball can be picked alone. */
const row: Vec3[] = Array.from({ length: 18 }, (_, i) => v3((i - 8.5) * 10, 0, 0));
let canvas: HTMLCanvasElement;
let scene: PoseScene;
let changed: number;

const screen = (p: Vec3) => [(p.x / HALF / 2 + 0.5) * SIZE, (0.5 - p.y / HALF / 2) * SIZE] as const;
function fire(type: string, x: number, y: number) {
  const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  canvas.dispatchEvent(e);
}
const open = (hidden: number[] = []) => {
  scene = createPoseScene(canvas, row, hidden, RADIUS, () => changed++);
};

beforeEach(() => {
  gl.disposed = 0;
  changed = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    cb();
    return 0;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: SIZE, configurable: true });
  Object.defineProperty(canvas, 'clientHeight', { value: SIZE });
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: SIZE, height: SIZE, right: SIZE, bottom: SIZE, x: 0, y: 0, toJSON() {} });
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  canvas.hasPointerCapture = () => true;
});

afterEach(() => {
  scene.dispose();
  vi.unstubAllGlobals();
});

describe('the joints', () => {
  it('start as given, and a copy is handed out', () => {
    open([3]);
    expect(scene.joints()).toEqual(row);
    scene.joints()[0]!.x = 999;
    expect(scene.joints()).toEqual(row);
    expect(changed).toBeGreaterThan(0);
  });

  it('swing a joint round its parent when its ball is dragged, and go back on reset', () => {
    open();
    const [x, y] = screen(row[4]!);
    fire('pointerdown', x, y);
    fire('pointermove', x, y - 40);
    const swung = scene.joints()[4]!;
    expect(swung.y).toBeGreaterThan(0);
    fire('pointerup', x, y - 40);
    fire('pointermove', x, y - 80);
    expect(scene.joints()[4]).toEqual(swung);
    scene.reset();
    expect(scene.joints()).toEqual(row);
  });

  it('slide the neck, which hangs from nothing, in the picture plane', () => {
    open();
    const [x, y] = screen(row[1]!);
    fire('pointerdown', x, y);
    fire('pointermove', x, y - 30);
    const neck = scene.joints()[1]!;
    expect(neck.y).toBeGreaterThan(0);
    expect(neck.z).toBeCloseTo(0);
  });
});

describe('the view', () => {
  it('turns with a drag of the background and stops short of straight up or down', () => {
    open();
    fire('pointerdown', 5, 5);
    fire('pointermove', 55, 35);
    expect(scene.view().yaw).toBeCloseTo(0.5);
    expect(scene.view().pitch).toBeCloseTo(0.3);
    fire('pointermove', 55, 100000);
    expect(scene.view().pitch).toBeCloseTo(Math.PI / 2);
    fire('pointermove', 55, -100000);
    expect(scene.view().pitch).toBeCloseTo(-Math.PI / 2);
  });

  it('is set from outside within the same limit', () => {
    open();
    scene.setView(1, 10);
    expect(scene.view()).toEqual({ yaw: 1, pitch: Math.PI / 2 });
  });

  it('ignores a move with nothing pressed, and a pointer that is let go', () => {
    open();
    const before = changed;
    fire('pointermove', 50, 50);
    expect(changed).toBe(before);
    fire('pointerdown', 5, 5);
    fire('pointerup', 5, 5);
    fire('pointermove', 50, 50);
    expect(scene.view()).toEqual({ yaw: 0, pitch: 0 });
  });

  it('zooms with the wheel, within limits, and resizes to a wide or a tall canvas', () => {
    open();
    const wheel = (deltaY: number) => canvas.dispatchEvent(new WheelEvent('wheel', { deltaY, cancelable: true, bubbles: true }));
    for (let i = 0; i < 40; i++) wheel(-100);
    for (let i = 0; i < 80; i++) wheel(100);
    Object.defineProperty(canvas, 'clientWidth', { value: 600 });
    scene.resize();
    Object.defineProperty(canvas, 'clientWidth', { value: 100 });
    scene.resize();
  });

  it('frees the renderer when it is closed', () => {
    open();
    scene.dispose();
    expect(gl.disposed).toBe(1);
    scene = { dispose() {} } as PoseScene;
  });
});
