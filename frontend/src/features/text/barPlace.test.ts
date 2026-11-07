import { describe, expect, it } from 'vitest';
import { layerBounds, placeBar } from './barPlace';

const sheet = { width: 600, height: 400 };
const bar = { width: 200, height: 40 };
const layer = { x: 300, y: 200, rotation: 0 };

describe('layerBounds', () => {
  it('scales the box and centres it on the layer', () => {
    expect(layerBounds(layer, { hw: 100, hh: 50 }, 0.5)).toEqual({ left: 100, top: 75, right: 200, bottom: 125 });
  });

  it('turns a rotated box into the bounds that hold it', () => {
    const b = layerBounds({ x: 0, y: 0, rotation: 90 }, { hw: 100, hh: 50 }, 1);
    expect(b.right).toBeCloseTo(50);
    expect(b.bottom).toBeCloseTo(100);
  });
});

describe('placeBar', () => {
  it('sits above the layer, centred, with the gap', () => {
    // The box spans y 150..250 and x 200..400: the bar is 8 above its top, centred on x 300.
    expect(placeBar(layer, { hw: 100, hh: 50 }, 1, sheet, bar)).toEqual({ left: 200, top: 150 - 8 - 40 });
  });

  it('goes under the layer when the top has no room', () => {
    const high = { x: 300, y: 30, rotation: 0 };
    expect(placeBar(high, { hw: 100, hh: 20 }, 1, sheet, bar)).toEqual({ left: 200, top: 50 + 8 });
  });

  it('sits at the top edge when neither side has room', () => {
    const tall = { x: 300, y: 200, rotation: 0 };
    expect(placeBar(tall, { hw: 100, hh: 200 }, 1, sheet, bar).top).toBe(0);
  });

  it('stays inside the sheet at the sides', () => {
    expect(placeBar({ x: 10, y: 200, rotation: 0 }, { hw: 10, hh: 10 }, 1, sheet, bar).left).toBe(0);
    expect(placeBar({ x: 590, y: 200, rotation: 0 }, { hw: 10, hh: 10 }, 1, sheet, bar).left).toBe(400);
  });

  it('pins a bar wider than the sheet to the left edge', () => {
    expect(placeBar(layer, { hw: 10, hh: 10 }, 1, { width: 150, height: 400 }, bar).left).toBe(0);
  });

  it('puts the bar exactly at the boundary above when it just fits', () => {
    // Top of the box is 48 = bar height + gap: the bar starts at 0 and stays above.
    expect(placeBar({ x: 300, y: 100, rotation: 0 }, { hw: 50, hh: 52 }, 1, sheet, bar).top).toBe(0);
  });
});
