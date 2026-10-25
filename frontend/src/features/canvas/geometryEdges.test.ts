import { describe, expect, it } from 'vitest';
import { normalizeRect, resizeRect, snap } from './geometry';

describe('rectangle helpers', () => {
  it('normalizes a drag in any direction and snaps to a step', () => {
    expect(normalizeRect(50, 40, 10, 5)).toEqual({ x: 10, y: 5, width: 40, height: 35 });
    expect(snap(13, 8)).toBe(16);
    expect(snap(11, 8)).toBe(8);
  });
});

describe('resizing with a locked ratio: corners', () => {
  const start = { x: 0, y: 0, width: 512, height: 512 };

  it('follows the width when the corner moves wider than tall', () => {
    expect(resizeRect(start, 'se', 256, 0, { ratio: 1 })).toMatchObject({ width: 768, height: 768 });
  });

  it('follows the height when the corner moves taller than wide', () => {
    expect(resizeRect(start, 'se', 0, 256, { ratio: 1 })).toMatchObject({ width: 768, height: 768 });
  });

  it('keeps the opposite corner fixed when dragging the north-west handle', () => {
    expect(resizeRect(start, 'nw', -128, 0, { ratio: 1 })).toEqual({ x: -128, y: -128, width: 640, height: 640 });
  });

  it('centres a vertical-only resize and sizes the width from the ratio', () => {
    expect(resizeRect(start, 's', 0, 256, { ratio: 2 })).toEqual({ x: -512, y: 0, width: 1536, height: 768 });
  });
});
