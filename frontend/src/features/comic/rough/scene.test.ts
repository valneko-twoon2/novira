// @vitest-environment jsdom
// The 3D view of a panel's rough, with the WebGL renderer replaced by one that draws nothing (the maths, the meshes and the
// picking are three.js's own): picking and moving a person, bending a limb, turning, sliding and zooming the camera, and
// that a change from outside keeps or drops the chosen thing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newPerson, newProp, newRough, ROUGH_DISTANCE, type ComicRough } from '@/state/comic/rough';
import { personJoints, project } from '@/state/comic/roughView';
import { J } from '@/state/pose/pose';
import { createRoughScene, type RoughScene } from './scene';

const gl = vi.hoisted(() => ({ disposed: 0, sizes: [] as number[][] }));
vi.mock('three', async (original) => {
  const three = await original<typeof import('three')>();
  class WebGLRenderer {
    setPixelRatio() {}
    setSize(w: number, h: number) {
      gl.sizes.push([w, h]);
    }
    // Keeps the matrices of the camera and the things current, as drawing a frame does (the picking reads them).
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

const W = 400;
const H = 300;
let canvas: HTMLCanvasElement;
let scene: RoughScene;
let changes: ComicRough[];
let selects: (string | null)[];
let rough: ComicRough;

function fire(type: string, x: number, y: number, init: MouseEventInit = {}) {
  const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, ...init });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  canvas.dispatchEvent(e);
}
const at = (p: { x: number; y: number }) => [p.x * W, p.y * H] as const;
const last = () => changes.at(-1)!;

function startUp(start: ComicRough) {
  rough = start;
  scene = createRoughScene(canvas, start, W / H, { change: (r) => changes.push(r), select: (id) => selects.push(id) });
}

beforeEach(() => {
  gl.disposed = 0;
  gl.sizes = [];
  changes = [];
  selects = [];
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    cb();
    return 0;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: W });
  Object.defineProperty(canvas, 'clientHeight', { value: H });
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H, x: 0, y: 0, toJSON() {} });
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  canvas.hasPointerCapture = () => true;
  document.body.append(canvas);
});

afterEach(() => {
  scene.dispose();
  canvas.remove();
  vi.unstubAllGlobals();
});

describe('picking in the view', () => {
  it('chooses the person under the pointer and drags it over the floor', () => {
    startUp(newRough());
    const id = rough.people[0]!.id;
    fire('pointerdown', W / 2, H / 2);
    expect(selects).toEqual([id]);
    fire('pointermove', W / 2 + 60, H / 2);
    const moved = last().people[0]!.x;
    expect(moved).not.toBe(0);
    fire('pointerup', W / 2 + 60, H / 2);
    fire('pointermove', W / 2 + 120, H / 2);
    expect(last().people[0]!.x).toBe(moved);
  });

  it('chooses a prop and moves it as well', () => {
    const start = newRough();
    start.people = [];
    start.props = [{ ...newProp('box'), y: 0.4 }];
    start.camera.target.y = 0.4;
    startUp(start);
    fire('pointerdown', W / 2, H / 2);
    expect(selects).toEqual([start.props[0]!.id]);
    fire('pointermove', W / 2 - 40, H / 2);
    expect(last().props[0]!.x).not.toBe(0);
  });

  it('lets go of the choice on a click of the background', () => {
    startUp(newRough());
    scene.select(rough.people[0]!.id);
    fire('pointerdown', 5, 5);
    fire('pointerup', 5, 5);
    expect(selects).toEqual([null]);
  });
});

describe('the camera', () => {
  it('turns round what it looks at when the background is dragged, and stops short of straight up', () => {
    startUp(newRough());
    fire('pointerdown', 5, 5);
    fire('pointermove', 45, 25);
    const camera = last().camera;
    expect(camera.yaw).toBeLessThan(0);
    expect(camera.pitch).toBeGreaterThan(rough.camera.pitch);
    fire('pointermove', 45, 25000);
    expect(last().camera.pitch).toBeLessThanOrEqual(1.4);
    fire('pointerup', 45, 25000);
    expect(selects).toEqual([]);
  });

  it('slides the target with Shift or the right button', () => {
    startUp(newRough());
    fire('pointerdown', 5, 5, { shiftKey: true });
    fire('pointermove', 105, 5);
    expect(last().camera.target.x).not.toBe(rough.camera.target.x);
    fire('pointerup', 105, 5);
    fire('pointerdown', 5, 5, { button: 2 });
    fire('pointermove', 5, 105);
    expect(last().camera.target.y).not.toBe(rough.camera.target.y);
  });

  it('comes nearer on a wheel up and goes back on a wheel down, within the limits', () => {
    startUp(newRough());
    const wheel = (deltaY: number) => canvas.dispatchEvent(new WheelEvent('wheel', { deltaY, cancelable: true, bubbles: true }));
    wheel(-100);
    expect(last().camera.distance).toBeLessThan(rough.camera.distance);
    for (let i = 0; i < 80; i++) wheel(100);
    expect(last().camera.distance).toBe(ROUGH_DISTANCE.max);
    for (let i = 0; i < 200; i++) wheel(-100);
    expect(last().camera.distance).toBe(ROUGH_DISTANCE.min);
  });

  it('takes no menu on the right button', () => {
    startUp(newRough());
    const e = new Event('contextmenu', { cancelable: true });
    canvas.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });
});

describe('the joints of the chosen person', () => {
  const pointOf = (joint: number) => at(project(rough.camera, W / H, personJoints(rough.people[0]!)[joint]!));

  it('bends a limb round the joint it hangs from when its coloured joint is dragged', () => {
    startUp(newRough());
    scene.select(rough.people[0]!.id);
    const [x, y] = pointOf(J.rWrist);
    fire('pointerdown', x, y);
    fire('pointermove', x + 30, y + 40);
    expect(last().people[0]!.joints).not.toEqual(rough.people[0]!.joints);
    expect(selects).toEqual([]);
  });

  it('moves the whole person when the neck is dragged', () => {
    startUp(newRough());
    scene.select(rough.people[0]!.id);
    const [x, y] = pointOf(J.neck);
    fire('pointerdown', x, y);
    // The neck is above the camera's eye line: the ray only meets the floor once the pointer is below the horizon.
    fire('pointermove', x + 50, H * 0.9);
    expect(last().people[0]!.x).not.toBe(0);
    expect(last().people[0]!.joints).toEqual(rough.people[0]!.joints);
  });
});

describe('a rough changed from outside', () => {
  it('keeps the choice while the thing is still there and drops it when it is gone', () => {
    startUp(newRough());
    const person = rough.people[0]!;
    scene.select(person.id);
    const shifted = { ...person, x: 0.3 };
    scene.set({ ...rough, people: [shifted] });
    const [x, y] = at(project(rough.camera, W / H, personJoints(shifted)[J.rWrist]!));
    fire('pointerdown', x, y);
    fire('pointermove', x + 30, y + 40);
    // The person is still chosen, so its wrist bent.
    expect(last().people[0]!.joints).not.toEqual(person.joints);
    fire('pointerup', x, y);
    scene.set({ ...rough, people: [newPerson(2, 0)] });
    fire('pointerdown', x, y);
    fire('pointerup', x, y);
    expect(selects.at(-1)).toBe(null);
  });

  it('resizes to the canvas', () => {
    startUp({ ...newRough(), floor: false });
    scene.resize();
    expect(gl.sizes.at(-1)).toEqual([W, H]);
  });

  it('follows a change of the theme', async () => {
    startUp(newRough());
    document.documentElement.setAttribute('data-theme', 'dark');
    await Promise.resolve();
    document.documentElement.removeAttribute('data-theme');
    await Promise.resolve();
  });

  it('frees the renderer when it is closed', () => {
    startUp(newRough());
    scene.dispose();
    expect(gl.disposed).toBe(1);
    scene = { dispose() {} } as RoughScene;
  });
});
