// @vitest-environment jsdom
// The canvas calls around the mask pixel functions: loading a picture, and saving the overlay, cut-out, mosaic and mask.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { cutoutBlob, loadMask, mosaicBlob, overlayUrl, transparentMaskBlob, type Mask } from './maskImage';

let canvases: ReturnType<typeof installRecordingCanvases>;
let failToBlob = false;

class FakeImage {
  naturalWidth = 4;
  naturalHeight = 2;
  crossOrigin = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(url: string) {
    queueMicrotask(() => (url.includes('broken') ? this.onerror?.() : this.onload?.()));
  }
}

const mask = (width = 4, height = 2): Mask => ({ width, height, alpha: new Uint8ClampedArray(width * height).fill(255) });

beforeEach(() => {
  canvases = installRecordingCanvases({ pixel: () => [200, 100, 50, 255] });
  failToBlob = false;
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(failToBlob ? null : new Blob(['png'], { type: 'image/png' }));
  };
  URL.createObjectURL = () => 'blob:overlay';
  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });
});
afterEach(() => {
  canvases.restore();
  vi.unstubAllGlobals();
});

const written = () => canvases.all.flatMap((r) => r.of('putImageData')).map((a) => (a[0] as ImageData).data);

describe('loading a mask', () => {
  it('reads the brightness of the picture as the selection', async () => {
    const m = await loadMask('blob:mask');
    expect([m.width, m.height]).toEqual([4, 2]);
    expect(m.alpha[0]).toBe(Math.round(0.299 * 200 + 0.587 * 100 + 0.114 * 50));
  });

  it('fails when the picture cannot be loaded', async () => {
    await expect(loadMask('blob:broken')).rejects.toThrow('could not be loaded');
  });

  it('fails without a canvas', async () => {
    canvases.restore();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(loadMask('blob:mask')).rejects.toThrow('no canvas');
    vi.restoreAllMocks();
  });
});

describe('saving results', () => {
  it('makes an overlay URL tinted at half strength', async () => {
    expect(await overlayUrl(mask(), [255, 0, 0], false)).toBe('blob:overlay');
    expect(Array.from(written()[0]!.slice(0, 4))).toEqual([255, 0, 0, 128]);
  });

  it('cuts the picture out to the selection', async () => {
    const m = mask();
    m.alpha.fill(0);
    const blob = await cutoutBlob('blob:picture', m, false);
    expect(blob.type).toBe('image/png');
    expect(written()[0]![3]).toBe(0);
    await cutoutBlob('blob:picture', m, true);
    expect(written()[1]![3]).toBe(255);
  });

  it('refuses a mask of another size', async () => {
    await expect(cutoutBlob('blob:picture', mask(8, 8), false)).rejects.toThrow('does not fit');
    await expect(mosaicBlob('blob:picture', mask(8, 8), false, 4)).rejects.toThrow('does not fit');
  });

  it('turns the selection into mosaic', async () => {
    await mosaicBlob('blob:picture', mask(), false, 2);
    expect(Array.from(written()[0]!.slice(0, 4))).toEqual([200, 100, 50, 255]);
  });

  it('writes a transparent mask and reports a picture that cannot be saved', async () => {
    await transparentMaskBlob(mask(), false);
    expect(Array.from(written()[0]!.slice(0, 4))).toEqual([255, 255, 255, 255]);
    failToBlob = true;
    await expect(transparentMaskBlob(mask(), true)).rejects.toThrow('toBlob failed');
  });
});
