import { describe, expect, it } from 'vitest';
import { ALPHA_THRESHOLD, opaqueBounds } from './trim';

/** A picture of `width` x `height` pixels, transparent except for the given pixels (x, y, alpha). */
function picture(width: number, height: number, drawn: [number, number, number][]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x, y, alpha] of drawn) data[(y * width + x) * 4 + 3] = alpha;
  return { width, height, data };
}

describe('opaqueBounds', () => {
  it('finds the smallest box around everything that is not transparent', () => {
    const box = opaqueBounds(picture(10, 8, [[2, 3, 255], [6, 3, 255], [4, 6, 200]]));
    expect(box).toEqual({ left: 2, top: 3, width: 5, height: 4 });
  });

  it('is the whole picture when the edges are drawn on, and a single pixel when only one is', () => {
    expect(opaqueBounds(picture(3, 2, [[0, 0, 255], [2, 1, 255]]))).toEqual({ left: 0, top: 0, width: 3, height: 2 });
    expect(opaqueBounds(picture(5, 5, [[1, 4, 255]]))).toEqual({ left: 1, top: 4, width: 1, height: 1 });
  });

  it('is null when the whole picture is transparent', () => {
    expect(opaqueBounds(picture(4, 4, []))).toBeNull();
  });

  it('does not let almost invisible pixels (a faint halo) widen the box', () => {
    const faint = ALPHA_THRESHOLD;
    const box = opaqueBounds(picture(10, 10, [[5, 5, 255], [0, 0, faint], [9, 9, faint]]));
    expect(box).toEqual({ left: 5, top: 5, width: 1, height: 1 });
    expect(opaqueBounds(picture(10, 10, [[0, 0, faint + 1]]))).toEqual({ left: 0, top: 0, width: 1, height: 1 });
  });
});
