// @vitest-environment jsdom
// Flattening layers inside a rect: order, opacity, blend, and the bounds and content helpers.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import type { CanvasObject, RasterEntity } from '@/state/canvas';
import { compositeRect, contentBounds, hasContent, imageUrlsOf } from './composite';

vi.mock('./imageCache', () => ({
  getImage: () => null,
  imageVersion: () => 0,
  preloadImages: () => Promise.resolve(),
}));

const red = { r: 255, g: 0, b: 0, a: 1 };
const square = (x: number): CanvasObject => ({ kind: 'rect', id: `r${x}`, x, y: 0, width: 10, height: 10, color: red });
const raster = (id: string, patch: Partial<RasterEntity> = {}): RasterEntity => ({
  id,
  type: 'raster',
  seq: 1,
  name: null,
  isEnabled: true,
  isLocked: false,
  opacity: 1,
  x: 0,
  y: 0,
  objects: [square(0)],
  ...patch,
});

let canvases: ReturnType<typeof installRecordingCanvases>;
beforeEach(() => {
  canvases = installRecordingCanvases();
});
afterEach(() => canvases.restore());

describe('compositeRect', () => {
  it('draws the layers in order with their opacity and blend, and leaves the canvas normal afterwards', async () => {
    const out = await compositeRect([raster('a', { opacity: 0.5 }), raster('m', { blend: 'multiply' }), raster('s', { blend: 'screen', x: 4 })], { x: 0, y: 0, width: 20, height: 10 });
    const rec = canvases.of(out);
    expect(rec.of('drawImage')).toHaveLength(3);
    expect(rec.sets.filter((s) => s.name === 'globalCompositeOperation').map((s) => s.value)).toEqual(['source-over', 'multiply', 'screen', 'source-over']);
    expect(rec.sets.filter((s) => s.name === 'globalAlpha').map((s) => s.value)).toEqual([0.5, 1, 1, 1]);
    expect(rec.of('drawImage')[2]!.slice(1)).toEqual([4, 0, 10, 10]);
  });

  it('sizes the canvas to the rect times the scale, never below one pixel', async () => {
    const out = await compositeRect([], { x: 0, y: 0, width: 100, height: 0.2 }, 0.5);
    expect([out.width, out.height]).toEqual([50, 1]);
  });
});

describe('content helpers', () => {
  it('finds the pictures, the drawn bounds and whether a layer has content', () => {
    const picture: CanvasObject = { kind: 'image', id: 'i', url: '/p.png', imageName: null, x: 30, y: 5, width: 10, height: 10 };
    expect(imageUrlsOf([raster('a', { objects: [square(0), picture] })])).toEqual(['/p.png']);
    expect(contentBounds([raster('a'), raster('b', { x: 20, y: 10 })])).toEqual({ x: 0, y: 0, width: 30, height: 20 });
    expect(contentBounds([raster('e', { objects: [] })])).toBeNull();
    expect(hasContent(raster('a'))).toBe(true);
    expect(hasContent(raster('e', { objects: [] }))).toBe(false);
  });
});
