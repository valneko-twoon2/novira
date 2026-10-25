// Bounds of drawn canvas content and the union of rectangles.
import { describe, expect, it } from 'vitest';
import type { CanvasObject } from '@/state/canvas';
import { objectsBounds, unionRect } from './bounds';

const black = { r: 0, g: 0, b: 0, a: 1 };
const stroke = (patch: Partial<Extract<CanvasObject, { kind: 'stroke' }>> = {}): CanvasObject => ({
  kind: 'stroke',
  id: 's',
  tool: 'brush',
  color: black,
  width: 10,
  points: [10, 10, 50, 30],
  clip: null,
  ...patch,
});

describe('unionRect', () => {
  it('unions two rectangles and passes a missing one through', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 20, y: 5, width: 10, height: 10 };
    expect(unionRect(a, b)).toEqual({ x: 0, y: 0, width: 30, height: 15 });
    expect(unionRect(null, b)).toBe(b);
    expect(unionRect(a, null)).toBe(a);
    expect(unionRect(null, null)).toBeNull();
  });
});

describe('bounds of drawn content', () => {
  it('ignores eraser strokes in bounds', () => {
    const b = objectsBounds([
      { kind: 'rect', id: 'r', x: 10, y: 10, width: 20, height: 20, color: black },
      { kind: 'stroke', id: 's', tool: 'eraser', color: black, width: 10, points: [500, 500, 600, 600], clip: null },
    ]);
    expect(b).toEqual({ x: 10, y: 10, width: 20, height: 20 });
  });

  it('ignores mosaic strokes in bounds, like eraser strokes', () => {
    const b = objectsBounds([
      { kind: 'rect', id: 'r', x: 10, y: 10, width: 20, height: 20, color: black },
      { kind: 'stroke', id: 'm', tool: 'mosaic', block: 16, color: black, width: 10, points: [500, 500, 600, 600], clip: null },
    ]);
    expect(b).toEqual({ x: 10, y: 10, width: 20, height: 20 });
  });

  it('grows a brush stroke by half its width plus one', () => {
    expect(objectsBounds([stroke()])).toEqual({ x: 4, y: 4, width: 52, height: 32 });
  });

  it('cuts a clipped stroke to its clip rectangle', () => {
    const clip = { x: 20, y: 0, width: 20, height: 100 };
    expect(objectsBounds([stroke({ clip })])).toEqual({ x: 20, y: 4, width: 20, height: 32 });
  });

  it('ignores a stroke that lies entirely outside its clip', () => {
    const clip = { x: 500, y: 500, width: 10, height: 10 };
    expect(objectsBounds([stroke({ clip })])).toBeNull();
  });

  it('ignores a stroke without a full point and empty images and rectangles', () => {
    expect(objectsBounds([stroke({ points: [5] })])).toBeNull();
    expect(objectsBounds([stroke({ points: [5, 5] })])).toEqual({ x: -1, y: -1, width: 12, height: 12 });
    expect(objectsBounds([{ kind: 'image', id: 'i', url: 'u', imageName: null, x: 0, y: 0, width: 0, height: 10 }])).toBeNull();
    expect(objectsBounds([{ kind: 'rect', id: 'r', x: 0, y: 0, width: 10, height: -1, color: black }])).toBeNull();
  });

  it('unions an image with a stroke', () => {
    const image: CanvasObject = { kind: 'image', id: 'i', url: 'u', imageName: 'n', x: 100, y: 100, width: 50, height: 50 };
    expect(objectsBounds([stroke(), image])).toEqual({ x: 4, y: 4, width: 146, height: 146 });
  });
});
