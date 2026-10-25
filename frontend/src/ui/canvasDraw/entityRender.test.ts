// @vitest-environment jsdom
// Rendering a canvas entity into an offscreen canvas: bounds, strokes, masks, control effects and the render cache.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import type { CanvasEntity, CanvasObject, ControlEntity, InpaintEntity, RasterEntity, RGBA, StrokeObject } from '@/state/canvas';
import { blendOperation, createCanvas, renderControlImage, renderEntity, renderMaskShape } from './entityRender';

const picture = { width: 10, height: 10 } as HTMLImageElement;
const loaded = new Map<string, HTMLImageElement | null>();
vi.mock('./imageCache', () => ({
  getImage: (url: string) => loaded.get(url) ?? null,
  imageVersion: () => 0,
}));

const red: RGBA = { r: 255, g: 0, b: 0, a: 1 };
const base = { id: 'e', seq: 1, name: null, isEnabled: true, isLocked: false, opacity: 1, x: 0, y: 0 };
const stroke = (patch: Partial<StrokeObject> = {}): StrokeObject => ({
  kind: 'stroke',
  id: 's',
  tool: 'brush',
  color: red,
  width: 10,
  points: [10, 10, 40, 30],
  clip: null,
  ...patch,
});
const raster = (objects: CanvasObject[]): RasterEntity => ({ ...base, type: 'raster', objects });
const inpaint = (objects: CanvasObject[], fill: InpaintEntity['fill'] = 'solid'): InpaintEntity => ({
  ...base,
  type: 'inpaint',
  objects,
  color: { r: 0, g: 0, b: 255, a: 1 },
  fill,
  denoiseLimit: null,
  noiseLevel: null,
});
const control = (objects: CanvasObject[], withTransparencyEffect = false): ControlEntity => ({
  ...base,
  type: 'control',
  objects,
  modelKey: null,
  weight: 1,
  beginEnd: [0, 1],
  controlMode: 'balanced',
  filter: 'none',
  withTransparencyEffect,
});

let rec: ReturnType<typeof installRecordingCanvases>;
beforeEach(() => {
  rec = installRecordingCanvases();
  loaded.clear();
});
afterEach(() => rec.restore());

describe('renderEntity', () => {
  it('returns null for an entity with no objects', () => {
    expect(renderEntity(raster([]))).toBeNull();
  });

  it('sizes the canvas to the objects and draws a brush stroke as a line', () => {
    const out = renderEntity(raster([stroke()]))!;
    expect(out.x).toBeLessThanOrEqual(5);
    expect(out.y).toBeLessThanOrEqual(5);
    expect(out.canvas.width).toBeGreaterThanOrEqual(40);
    const r = rec.of(out.canvas);
    expect(r.of('translate')[0]).toEqual([-out.x, -out.y]);
    expect(r.of('moveTo')[0]).toEqual([10, 10]);
    expect(r.of('lineTo')[0]).toEqual([40, 30]);
    expect(r.of('stroke')).toHaveLength(1);
    expect(r.sets.find((s) => s.name === 'strokeStyle')!.value).toBe('rgba(255, 0, 0, 1)');
  });

  it('draws a single point as a dot, an eraser as destination-out and a clipped stroke inside its clip', () => {
    const dot = renderEntity(raster([stroke({ points: [20, 20] })]))!;
    expect(rec.of(dot.canvas).of('arc')[0]).toEqual([20, 20, 5, 0, Math.PI * 2]);
    expect(rec.of(dot.canvas).of('fill')).toHaveLength(1);

    const erased = renderEntity(raster([{ kind: 'rect', id: 'r', x: 0, y: 0, width: 40, height: 40, color: red }, stroke({ tool: 'eraser', clip: { x: 0, y: 0, width: 30, height: 30 } })]))!;
    const r = rec.of(erased.canvas);
    expect(r.sets.some((s) => s.name === 'globalCompositeOperation' && s.value === 'destination-out')).toBe(true);
    expect(r.sets.find((s) => s.name === 'strokeStyle')!.value).toBe('#ffffff');
    expect(r.of('rect')[0]).toEqual([0, 0, 30, 30]);
    expect(r.of('clip')).toHaveLength(1);
  });

  it('draws rectangles and loaded images, and skips an image that is still loading', () => {
    loaded.set('/a.png', picture);
    const objects: CanvasObject[] = [
      { kind: 'rect', id: 'r', x: 0, y: 0, width: 20, height: 10, color: red },
      { kind: 'image', id: 'i', url: '/a.png', imageName: null, x: 20, y: 0, width: 10, height: 10 },
      { kind: 'image', id: 'j', url: '/pending.png', imageName: null, x: 30, y: 0, width: 10, height: 10 },
    ];
    const out = renderEntity(raster(objects))!;
    const r = rec.of(out.canvas);
    expect(r.of('fillRect')[0]).toEqual([0, 0, 20, 10]);
    expect(r.of('drawImage')).toHaveLength(1);
    expect(r.of('drawImage')[0]).toEqual([picture, 20, 0, 10, 10]);
  });

  it('caches by the objects array, but not while an extra in-progress object is drawn', () => {
    const e = raster([stroke()]);
    const first = renderEntity(e);
    expect(renderEntity(e)).toBe(first);
    const withExtra = renderEntity(e, { extra: stroke({ points: [0, 0, 5, 5] }) });
    expect(withExtra).not.toBe(first);
    expect(renderEntity(e)).toBe(first);
  });

  it('tints a mask with its colour, using a pattern for a hatched fill', () => {
    const solid = renderEntity(inpaint([stroke()]))!;
    const rs = rec.of(solid.canvas);
    expect(rs.sets.some((s) => s.name === 'globalCompositeOperation' && s.value === 'source-in')).toBe(true);
    expect(rs.sets.filter((s) => s.name === 'fillStyle').pop()!.value).toBe('rgba(0, 0, 255, 1)');
    expect(rs.of('createPattern')).toHaveLength(0);

    for (const fill of ['diagonal', 'crosshatch', 'grid', 'horizontal', 'vertical'] as const) {
      const out = renderEntity(inpaint([stroke()], fill))!;
      expect(rec.of(out.canvas).of('createPattern')).toHaveLength(1);
    }
  });

  it('draws mask strokes white so the tint decides the colour', () => {
    const out = renderEntity(inpaint([stroke()]))!;
    expect(rec.of(out.canvas).sets.find((s) => s.name === 'strokeStyle')!.value).toBe('#ffffff');
  });

  it('shows a control layer\'s filter preview instead of its pixels', () => {
    loaded.set('/preview.png', picture);
    const preview = { url: '/preview.png', x: 3, y: 4, width: 20, height: 12 };
    const out = renderEntity(control([stroke()]), { preview })!;
    expect(out).toMatchObject({ x: 3, y: 4, width: 20, height: 12 });
    expect(rec.of(out.canvas).of('drawImage')[0]).toEqual([picture, 0, 0, 20, 12]);
    const pending = renderEntity(control([stroke()]), { preview: { ...preview, url: '/later.png' } })!;
    expect(rec.of(pending.canvas).of('drawImage')).toHaveLength(0);
  });

  it('makes dark pixels transparent with the transparency effect', () => {
    const out = renderEntity(control([stroke()], true))!;
    const r = rec.of(out.canvas);
    const put = r.of('putImageData');
    expect(put).toHaveLength(1);
    const data = (put[0]![0] as ImageData).data;
    // Left half black becomes transparent, right half white stays opaque.
    expect(data[3]).toBe(0);
    expect(data[(out.canvas.width - 1) * 4 + 3]).toBe(255);
  });
});

describe('renderMaskShape and renderControlImage', () => {
  it('paints a mask in one grey', () => {
    expect(renderMaskShape(inpaint([]), 128)).toBeNull();
    const out = renderMaskShape(inpaint([stroke()]), 128)!;
    const r = rec.of(out.canvas);
    expect(r.sets.find((s) => s.name === 'fillStyle' && s.value === 'rgb(128, 128, 128)')).toBeTruthy();
    expect(r.of('fillRect').pop()).toEqual([0, 0, out.canvas.width, out.canvas.height]);
  });

  it('renders the control layer pixels, or its preview when there is one', () => {
    const plain = renderControlImage(control([stroke()]))!;
    expect(rec.of(plain.canvas).of('stroke')).toHaveLength(1);
    expect(renderControlImage(control([]))).toBeNull();
    loaded.set('/p.png', picture);
    const viaPreview = renderControlImage(control([stroke()]), { url: '/p.png', x: 1, y: 2, width: 6, height: 7 })!;
    expect(rec.of(viaPreview.canvas).of('drawImage')[0]).toEqual([picture, 0, 0, 6, 7]);
    const noImage = renderControlImage(control([]), { url: '/none.png', x: 0, y: 0, width: 4, height: 4 })!;
    expect(rec.of(noImage.canvas).of('drawImage')).toHaveLength(0);
  });
});

describe('mosaic strokes', () => {
  it('pixelates what was drawn under the stroke on a grid', () => {
    const e: CanvasEntity = raster([
      { kind: 'rect', id: 'r', x: 0, y: 0, width: 64, height: 64, color: red },
      stroke({ tool: 'mosaic', block: 8, points: [10, 10], clip: { x: 0, y: 0, width: 64, height: 64 } }),
    ]);
    const out = renderEntity(e)!;
    const r = rec.of(out.canvas);
    expect(r.sets.some((s) => s.name === 'globalCompositeOperation' && s.value === 'destination-out')).toBe(true);
    expect(r.of('drawImage').length).toBeGreaterThanOrEqual(2);
    const smoothingOff = rec.all.some((x) => x.sets.some((s) => s.name === 'imageSmoothingEnabled' && s.value === false));
    expect(smoothingOff).toBe(true);
  });

  it('draws a dragged mosaic along its path', () => {
    const e = raster([{ kind: 'rect', id: 'r', x: 0, y: 0, width: 64, height: 64, color: red }, stroke({ tool: 'mosaic', points: [5, 5, 50, 50] })]);
    const out = renderEntity(e)!;
    expect(out.canvas.width).toBe(64);
    expect(rec.all.some((x) => x.of('lineTo').length > 0)).toBe(true);
  });
});

describe('blendOperation', () => {
  it('draws a raster layer with its blend and every other layer normally', () => {
    expect(blendOperation(raster([]))).toBe('source-over');
    expect(blendOperation({ ...raster([]), blend: 'normal' })).toBe('source-over');
    expect(blendOperation({ ...raster([]), blend: 'multiply' })).toBe('multiply');
    expect(blendOperation({ ...raster([]), blend: 'screen' })).toBe('screen');
    expect(blendOperation({ ...control([]), blend: 'multiply' } as unknown as CanvasEntity)).toBe('source-over');
  });
});

describe('createCanvas', () => {
  it('rounds the size up and never makes an empty canvas', () => {
    const c = createCanvas(10.2, 0);
    expect([c.width, c.height]).toEqual([11, 1]);
  });
});
