import { describe, expect, it } from 'vitest';
import { DEFAULT_TEXT_STYLE, newBubbleLayer, newTextLayer } from '@/state/text/textModel';
import { containsPoint, handleAt, layerAt, scaleStyle, toImage, toLocal } from './hit';

const scene = { width: 1000, height: 1000 };

describe('layer hit testing', () => {
  it('converts points between image and layer space, with rotation', () => {
    const layer = { x: 100, y: 100, rotation: 90 };
    const local = toLocal(layer, { x: 100, y: 150 });
    expect(local.x).toBeCloseTo(50);
    expect(local.y).toBeCloseTo(0);
    const back = toImage(layer, local);
    expect(back.x).toBeCloseTo(100);
    expect(back.y).toBeCloseTo(150);
  });

  it('finds the top-most unlocked visible layer', () => {
    const a = { ...newTextLayer(scene, 'A'), id: 'a' };
    const b = { ...newTextLayer(scene, 'B'), id: 'b' };
    const halves = new Map([
      ['a', { hw: 100, hh: 50 }],
      ['b', { hw: 100, hh: 50 }],
    ]);
    const p = { x: a.x, y: a.y };
    expect(layerAt([a, b], halves, p)?.id).toBe('b');
    expect(layerAt([a, { ...b, locked: true }], halves, p)?.id).toBe('a');
    expect(layerAt([a, { ...b, visible: false }], halves, p)?.id).toBe('a');
    expect(layerAt([a, b], halves, { x: 0, y: 0 })).toBeNull();
  });

  it('follows rotation when testing containment', () => {
    const layer = { ...newTextLayer(scene, 'A'), rotation: 90 };
    const half = { hw: 200, hh: 20 };
    // After a quarter turn the long side runs vertically.
    expect(containsPoint(layer, half, { x: layer.x, y: layer.y + 150 })).toBe(true);
    expect(containsPoint(layer, half, { x: layer.x + 150, y: layer.y })).toBe(false);
  });

  it('finds the pointer handle of a bubble before its corners', () => {
    const bubble = { ...newBubbleLayer(scene, 'round', 'a'), x: 500, y: 500 };
    const half = { hw: bubble.width / 2, hh: bubble.height / 2 };
    const tip = { x: bubble.x + bubble.tail.x, y: bubble.y + bubble.tail.y };
    expect(handleAt(bubble, half, tip, 10)).toEqual({ kind: 'tail' });
    expect(handleAt(bubble, half, { x: bubble.x + half.hw, y: bubble.y + half.hh }, 10)).toEqual({ kind: 'corner', sx: 1, sy: 1 });
    expect(handleAt(bubble, half, { x: bubble.x, y: bubble.y }, 10)).toBeNull();
  });
});

describe('scaling a style', () => {
  it('scales font, outlines, shadow and spacing together', () => {
    const style = {
      ...DEFAULT_TEXT_STYLE,
      fontSize: 100,
      letterSpacing: 4,
      stroke: { color: '#000000', width: 10 },
      outline: { color: '#ffffff', width: 6 },
      shadow: { color: '#000000', blur: 8, offsetX: 4, offsetY: 6 },
    };
    const half = scaleStyle(style, 0.5);
    expect(half.fontSize).toBe(50);
    expect(half.stroke?.width).toBe(5);
    expect(half.outline?.width).toBe(3);
    expect(half.shadow).toMatchObject({ blur: 4, offsetX: 2, offsetY: 3 });
    expect(half.letterSpacing).toBe(2);
    expect(scaleStyle({ ...style, stroke: null }, 2).stroke).toBeNull();
  });
});
