import { describe, expect, it } from 'vitest';
import { cutoutPixels, maskFromPixels, mosaicPixels, overlayPixels, transparentMaskPixels } from './maskImage';

/** A 2x1 mask: the first pixel selected, the second not. */
const mask = () => maskFromPixels(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]), 2, 1);
const photo = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]);

describe('selection mask pixels', () => {
  it('reads brightness as how selected a pixel is', () => {
    expect(Array.from(mask().alpha)).toEqual([255, 0]);
    expect(maskFromPixels(new Uint8ClampedArray([128, 128, 128, 255]), 1, 1).alpha[0]).toBe(128);
  });

  it('cuts the selection out, or the rest when inverted, keeping the colours', () => {
    expect(Array.from(cutoutPixels(photo, mask(), false))).toEqual([10, 20, 30, 255, 40, 50, 60, 0]);
    expect(Array.from(cutoutPixels(photo, mask(), true))).toEqual([10, 20, 30, 0, 40, 50, 60, 255]);
  });

  it('keeps the transparency the picture already has', () => {
    const half = new Uint8ClampedArray([10, 20, 30, 100, 0, 0, 0, 255]);
    expect(cutoutPixels(half, mask(), false)[3]).toBe(100);
  });

  it('turns the selected squares into their average colour and leaves the rest alone', () => {
    // 4x1: the left two pixels are selected; a block of 2 averages them.
    const four = new Uint8ClampedArray([0, 0, 0, 255, 100, 100, 100, 255, 7, 7, 7, 255, 9, 9, 9, 255]);
    const m = maskFromPixels(new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255, 0, 0, 0, 255]), 4, 1);
    expect(Array.from(mosaicPixels(four, m, false, 2))).toEqual([50, 50, 50, 255, 50, 50, 50, 255, 7, 7, 7, 255, 9, 9, 9, 255]);
    // Inverted, only the right square changes.
    expect(Array.from(mosaicPixels(four, m, true, 2))).toEqual([0, 0, 0, 255, 100, 100, 100, 255, 8, 8, 8, 255, 8, 8, 8, 255]);
  });

  it('mixes a half selected pixel halfway and ignores transparent pixels in the average', () => {
    const two = new Uint8ClampedArray([0, 0, 0, 255, 200, 200, 200, 255]);
    const half = maskFromPixels(new Uint8ClampedArray([128, 128, 128, 255, 255, 255, 255, 255]), 2, 1);
    const out = mosaicPixels(two, half, false, 2);
    expect(out[4]).toBe(100);
    expect(out[0]).toBe(50);
    const clear = new Uint8ClampedArray([0, 0, 0, 0, 200, 200, 200, 255]);
    expect(Array.from(mosaicPixels(clear, maskFromPixels(new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255]), 2, 1), false, 2).slice(4, 7))).toEqual([200, 200, 200]);
    // A square that is all transparent has no colour to take and stays as it is.
    expect(Array.from(mosaicPixels(new Uint8ClampedArray([5, 5, 5, 0, 5, 5, 5, 0]), half, false, 2))).toEqual([5, 5, 5, 0, 5, 5, 5, 0]);
  });

  it('tints the selection for the preview and writes a white-on-transparent mask for the canvas', () => {
    expect(Array.from(overlayPixels(mask(), [0, 0, 255], false, 0.5))).toEqual([0, 0, 255, 128, 0, 0, 255, 0]);
    expect(Array.from(transparentMaskPixels(mask(), false))).toEqual([255, 255, 255, 255, 255, 255, 255, 0]);
    expect(Array.from(transparentMaskPixels(mask(), true))).toEqual([255, 255, 255, 0, 255, 255, 255, 255]);
  });
});
