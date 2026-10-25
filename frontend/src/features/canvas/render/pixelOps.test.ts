// The bucket's flood fill and the growth of its region, on plain pixel arrays.
import { describe, expect, it } from 'vitest';
import { floodFillRegion, growRegion, regionPixels } from './pixelOps';

/** RGBA pixels from rows of letters: . clear, # black, r red, p near black (value 20). */
function picture(rows: string[]): { data: Uint8ClampedArray; width: number; height: number } {
  const height = rows.length;
  const width = rows[0]!.length;
  const data = new Uint8ClampedArray(width * height * 4);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const o = (y * width + x) * 4;
      const c = ch === '#' ? [0, 0, 0, 255] : ch === 'r' ? [255, 0, 0, 255] : ch === 'p' ? [20, 20, 20, 255] : [0, 0, 0, 0];
      data.set(c, o);
    });
  });
  return { data, width, height };
}
const count = (mask: Uint8Array) => mask.reduce((n, v) => n + v, 0);

describe('floodFillRegion', () => {
  it('fills the clear region up to the lines, and no further', () => {
    const { data, width, height } = picture(['..#..', '..#..', '..#..']);
    const left = floodFillRegion(data, width, height, 0, 0, 0)!;
    expect(count(left.mask)).toBe(6);
    expect(left.bounds).toEqual({ x: 0, y: 0, width: 2, height: 3 });
    const right = floodFillRegion(data, width, height, 4, 2, 0)!;
    expect(right.bounds).toEqual({ x: 3, y: 0, width: 2, height: 3 });
  });

  it('goes round a wall that has a gap', () => {
    const { data, width, height } = picture(['..#..', '..#..', '.....']);
    expect(count(floodFillRegion(data, width, height, 0, 0, 0)!.mask)).toBe(width * height - 2);
  });

  it('does not leak through a diagonal gap (four-way connection)', () => {
    const { data, width, height } = picture(['.#.', '#..', '...']);
    expect(count(floodFillRegion(data, width, height, 0, 0, 0)!.mask)).toBe(1);
  });

  it('fills a line when the line is pressed, with its own colour as the seed', () => {
    const { data, width, height } = picture(['..#..']);
    const line = floodFillRegion(data, width, height, 2, 0, 0)!;
    expect(count(line.mask)).toBe(1);
  });

  it('reads a tolerance per channel: near colours join, far ones do not', () => {
    const { data, width, height } = picture(['#p r']);
    // "#" (0,0,0) and "p" (20,20,20) are 20 apart: joined from tolerance 20 on.
    expect(count(floodFillRegion(data, width, height, 0, 0, 19)!.mask)).toBe(1);
    expect(count(floodFillRegion(data, width, height, 0, 0, 20)!.mask)).toBe(2);
    // The clear pixel (alpha 0) is 255 apart in alpha; only the top tolerance joins it, red (255,0,0) is joined then too.
    expect(count(floodFillRegion(data, width, height, 0, 0, 255)!.mask)).toBe(4);
  });

  it('treats fully clear pixels as alike whatever their hidden colour', () => {
    const { data, width, height } = picture(['...']);
    data.set([200, 10, 10, 0], 4);
    expect(count(floodFillRegion(data, width, height, 0, 0, 0)!.mask)).toBe(3);
  });

  it('is null outside the image', () => {
    const { data, width, height } = picture(['..']);
    expect(floodFillRegion(data, width, height, -1, 0, 0)).toBeNull();
    expect(floodFillRegion(data, width, height, 2, 0, 0)).toBeNull();
    expect(floodFillRegion(data, width, height, 0, 1, 0)).toBeNull();
  });

  it('fills a large empty image whole, without recursion trouble', () => {
    const width = 600;
    const height = 400;
    const data = new Uint8ClampedArray(width * height * 4);
    const region = floodFillRegion(data, width, height, 300, 200, 0)!;
    expect(count(region.mask)).toBe(width * height);
    expect(region.bounds).toEqual({ x: 0, y: 0, width, height });
  });
});

describe('growRegion', () => {
  it('adds the pixels next to the region, within the image', () => {
    const { data, width, height } = picture(['..#..', '..#..', '..#..']);
    const left = floodFillRegion(data, width, height, 0, 0, 0)!;
    const grown = growRegion(left, width, height);
    expect(count(grown.mask)).toBe(9);
    expect(grown.bounds).toEqual({ x: 0, y: 0, width: 3, height: 3 });
  });

  it('adds no diagonal neighbours', () => {
    const { data, width, height } = picture(['...', '...', '...']);
    const one = { mask: new Uint8Array(9), bounds: { x: 1, y: 1, width: 1, height: 1 } };
    one.mask[4] = 1;
    expect(count(growRegion(one, width, height).mask)).toBe(5);
    expect(data.length).toBe(36);
  });
});

describe('regionPixels', () => {
  it('paints the region in the colour with its alpha, over a box as large as the bounds', () => {
    const region = { mask: new Uint8Array([0, 1, 1, 0, 0, 1]), bounds: { x: 1, y: 0, width: 2, height: 2 } };
    const px = regionPixels(region, 3, { r: 1, g: 2, b: 3, a: 0.5 });
    expect([...px]).toEqual([1, 2, 3, 128, 1, 2, 3, 128, 0, 0, 0, 0, 1, 2, 3, 128]);
  });
});
