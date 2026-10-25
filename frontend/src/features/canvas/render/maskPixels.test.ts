import { describe, expect, it } from 'vitest';
import { addTransparentArea, maskGrey, maskIsEmpty, pullPushFill } from './maskPixels';

/** An RGBA buffer from one [r, g, b, a] per pixel. */
const rgba = (...pixels: number[][]) => new Uint8ClampedArray(pixels.flat());
const pixel = (data: Uint8ClampedArray, i: number) => Array.from(data.slice(i * 4, i * 4 + 4));

describe('mask pixels', () => {
  it('turns a denoise limit into the grey of the mask', () => {
    expect(maskGrey(null)).toBe(255);
    expect(maskGrey(0.5)).toBe(128);
    expect(maskGrey(2)).toBe(255);
    expect(maskGrey(-1)).toBe(0);
    expect(maskGrey(Number.NaN)).toBe(255);
  });

  it('redraws transparent pixels as much as they are transparent, keeping stronger mask values', () => {
    const mask = rgba([0, 0, 0, 255], [200, 200, 200, 255], [0, 0, 0, 255]);
    addTransparentArea(mask, rgba([9, 9, 9, 255], [9, 9, 9, 255], [9, 9, 9, 55]));
    expect([pixel(mask, 0), pixel(mask, 1), pixel(mask, 2)]).toEqual([
      [0, 0, 0, 255],
      [200, 200, 200, 255],
      [200, 200, 200, 255],
    ]);
  });

  it('treats antialiasing noise as an empty mask', () => {
    expect(maskIsEmpty(rgba([0, 0, 0, 255], [3, 3, 3, 255]))).toBe(true);
    expect(maskIsEmpty(rgba([0, 0, 0, 255], [4, 4, 4, 255]))).toBe(false);
    expect(maskIsEmpty(new Uint8ClampedArray())).toBe(true);
  });
});

describe('pull-push fill', () => {
  it('keeps opaque pixels and fills the transparent ones from their surroundings, all opaque', () => {
    // 4 x 2: the left half red, the right half empty.
    const red = [255, 0, 0, 255];
    const none = [0, 0, 0, 0];
    const out = pullPushFill(rgba(red, red, none, none, red, red, none, none), 4, 2);
    for (let i = 0; i < 8; i++) expect(pixel(out, i)).toEqual([255, 0, 0, 255]);
  });

  it('blends towards the nearer colour', () => {
    // 8 x 1: red at the left end, blue at the right end, empty between.
    const px = Array.from({ length: 8 }, (_, i) => (i === 0 ? [255, 0, 0, 255] : i === 7 ? [0, 0, 255, 255] : [0, 0, 0, 0]));
    const out = pullPushFill(rgba(...px), 8, 1);
    const [r1, , b1] = pixel(out, 1) as [number, number, number, number];
    const [r6, , b6] = pixel(out, 6) as [number, number, number, number];
    expect(r1).toBeGreaterThan(b1);
    expect(b6).toBeGreaterThan(r6);
    expect(pixel(out, 0)).toEqual([255, 0, 0, 255]);
    expect(pixel(out, 7)).toEqual([0, 0, 255, 255]);
  });

  it('continues the edge colour next to the content instead of the average of the whole picture', () => {
    // 8 x 2: red in the first column, blue in the last, empty between. The pixel beside the red one stays red.
    const row = Array.from({ length: 8 }, (_, i) => (i === 0 ? [255, 0, 0, 255] : i === 7 ? [0, 0, 255, 255] : [0, 0, 0, 0]));
    const out = pullPushFill(rgba(...row, ...row), 8, 2);
    const [r, , b] = pixel(out, 1) as [number, number, number, number];
    // A plain average of the coarse levels gave about [226, 0, 29] here.
    expect(r).toBeGreaterThan(232);
    expect(b).toBeLessThan(20);
  });

  it('leaves a picture without holes as it is and an empty one black', () => {
    const full = rgba([10, 20, 30, 255], [40, 50, 60, 255], [70, 80, 90, 255]);
    expect(Array.from(pullPushFill(full, 3, 1))).toEqual(Array.from(full));
    expect(Array.from(pullPushFill(rgba([5, 5, 5, 0], [5, 5, 5, 0]), 2, 1))).toEqual([0, 0, 0, 255, 0, 0, 0, 255]);
  });
});
