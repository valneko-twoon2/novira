// @vitest-environment jsdom
// The pictures a canvas invocation sends: source, mask and control images, drawn on recorded canvases.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import type { CanvasEntity } from '@/state/canvas';
import { canvasRenderer } from './generationInputs';

vi.mock('@/ui/canvasDraw/imageCache', () => ({
  getImage: () => null,
  imageVersion: () => 0,
  preloadImages: () => Promise.resolve(),
  onImageLoaded: () => () => {},
}));

const red = { r: 255, g: 0, b: 0, a: 1 };
const base = { seq: 1, name: null, isEnabled: true, isLocked: false, opacity: 1, x: 0, y: 0 };
const rect = { kind: 'rect' as const, id: 'r', x: 0, y: 0, width: 20, height: 20, color: red };
const raster = (id: string, objects = [rect]): CanvasEntity => ({ ...base, id, type: 'raster', objects });
const inpaint = (id: string, denoiseLimit: number | null = null): CanvasEntity => ({ ...base, id, type: 'inpaint', objects: [rect], color: red, fill: 'solid', denoiseLimit, noiseLevel: null });
const control = (id: string): CanvasEntity => ({
  ...base,
  id,
  type: 'control',
  objects: [rect],
  modelKey: null,
  weight: 1,
  beginEnd: [0, 1],
  controlMode: 'balanced',
  filter: 'none',
  withTransparencyEffect: false,
});
const doc = (entities: CanvasEntity[], previews = {}) => ({
  entities,
  groupHidden: { raster: false, control: false, inpaint: false, regional: false },
  bbox: { x: 0, y: 0, width: 40, height: 30 },
  filterPreviews: previews,
});

let canvases: ReturnType<typeof installRecordingCanvases>;
let urls = 0;
function install(options: Parameters<typeof installRecordingCanvases>[0] = {}) {
  canvases = installRecordingCanvases(options);
}
beforeEach(() => {
  urls = 0;
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(['png']));
  };
  URL.createObjectURL = () => `blob:${++urls}`;
});
afterEach(() => canvases.restore());

describe('coverage', () => {
  it('is empty without raster content and measured on the composite otherwise', async () => {
    install({ pixel: () => [0, 0, 0, 255] });
    expect(await canvasRenderer.coverage(doc([]))).toBe('empty');
    expect(await canvasRenderer.coverage(doc([raster('a')]))).toBe('full');
  });
});

describe('source and mask', () => {
  const infill = { method: 'color' as const, color: '#808080' };

  it('sends the composite alone when nothing is to be redrawn', async () => {
    install({ pixel: () => [0, 0, 0, 255] });
    const out = await canvasRenderer.sourceAndMask(doc([raster('a')]), { outpaint: false, infill });
    expect(out).toEqual({ initImageUrl: 'blob:1', maskImageUrl: null });
  });

  it('sends a mask of the inpaint layers, the strongest redraw winning where they overlap', async () => {
    install();
    const out = await canvasRenderer.sourceAndMask(doc([raster('a'), inpaint('m1', 0.5), inpaint('m2')]), { outpaint: false, infill });
    expect(out.maskImageUrl).not.toBeNull();
    const maskCanvas = canvases.all.find((r) => r.sets.some((s) => s.name === 'globalCompositeOperation' && s.value === 'lighten'))!;
    expect(maskCanvas.of('drawImage')).toHaveLength(2);
    expect(maskCanvas.sets.filter((s) => s.name === 'fillStyle')[0]!.value).toBe('#000000');
  });

  it('adds the transparent area to the mask and fills it with a colour for outpainting', async () => {
    install({ pixel: () => [10, 10, 10, 0] });
    const out = await canvasRenderer.sourceAndMask(doc([raster('a')]), { outpaint: true, infill });
    expect(out.maskImageUrl).not.toBeNull();
    const filled = canvases.all.find((r) => r.sets.some((s) => s.name === 'fillStyle' && s.value === '#808080'))!;
    expect(filled.of('fillRect')).toHaveLength(1);
    expect(filled.of('drawImage')).toHaveLength(1);
  });

  it('fills the transparent area from the surrounding colours for the other infill methods', async () => {
    install({ pixel: (x) => (x < 20 ? [200, 50, 50, 255] : [0, 0, 0, 0]) });
    const out = await canvasRenderer.sourceAndMask(doc([raster('a')]), { outpaint: true, infill: { method: 'lama', color: '#000000' } });
    expect(out.initImageUrl).toMatch(/^blob:/);
    expect(canvases.all.some((r) => r.of('putImageData').length > 0 && r.of('drawImage').length === 1)).toBe(true);
  });
});

describe('regional masks', () => {
  it('draws the region white on black at the bbox position', async () => {
    install();
    const layer = control('r');
    const url = await canvasRenderer.regionMask(doc([layer]), layer);
    expect(url).toMatch(/^blob:/);
    const out = canvases.all.find((r) => r.sets.some((s) => s.name === 'fillStyle' && s.value === '#000000'))!;
    expect(out.of('fillRect')[0]).toEqual([0, 0, 40, 30]);
    expect(out.of('drawImage')).toHaveLength(1);
  });
});

describe('control images', () => {
  it('draws the control layer on black at the bbox position', async () => {
    install();
    const url = await canvasRenderer.controlImage(doc([control('c')]), control('c'));
    expect(url).toMatch(/^blob:/);
    const out = canvases.all.find((r) => r.sets.some((s) => s.name === 'fillStyle' && s.value === '#000000'))!;
    expect(out.of('fillRect')[0]).toEqual([0, 0, 40, 30]);
    expect(out.of('drawImage')).toHaveLength(1);
  });

  it('uses the filter preview when there is one, and stays black for an empty layer', async () => {
    install();
    const preview = { url: 'blob:p', x: 2, y: 3, width: 10, height: 10 };
    const layer = control('c');
    await canvasRenderer.controlImage(doc([layer], { c: preview }), layer);
    const empty = { ...control('e'), objects: [] };
    await canvasRenderer.controlImage(doc([empty]), empty);
    expect(canvases.all.length).toBeGreaterThan(1);
  });
});
