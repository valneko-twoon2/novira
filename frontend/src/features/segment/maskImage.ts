// What the app does with the mask picture ComfyUI makes (white = selected): show it over the picture, cut the
// selection out, or turn it into a transparent mask for the canvas. The pixel work is plain functions on RGBA data;
// the canvas calls around them only load and save.

export interface Mask {
  width: number;
  height: number;
  /** 0..255 per pixel, how much of it is selected. */
  alpha: Uint8ClampedArray;
}

/** The selection of a mask picture: brightness is how selected a pixel is. */
export function maskFromPixels(rgba: Uint8ClampedArray, width: number, height: number): Mask {
  const alpha = new Uint8ClampedArray(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = Math.round(0.299 * rgba[i * 4]! + 0.587 * rgba[i * 4 + 1]! + 0.114 * rgba[i * 4 + 2]!);
  return { width, height, alpha };
}

const amount = (m: Mask, i: number, invert: boolean) => (invert ? 255 - m.alpha[i]! : m.alpha[i]!);

/** A picture that is `color` where selected (and transparent elsewhere), at `strength` (0..1) of full opacity. */
export function overlayPixels(m: Mask, color: [number, number, number], invert: boolean, strength: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(m.alpha.length * 4);
  for (let i = 0; i < m.alpha.length; i++) out.set([color[0], color[1], color[2], Math.round(amount(m, i, invert) * strength)], i * 4);
  return out;
}

/** The picture with everything but the selection made transparent. `rgba` is the picture at the mask's size. */
export function cutoutPixels(rgba: Uint8ClampedArray, m: Mask, invert: boolean): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba);
  for (let i = 0; i < m.alpha.length; i++) out[i * 4 + 3] = Math.round((rgba[i * 4 + 3]! * amount(m, i, invert)) / 255);
  return out;
}

/**
 * The picture with the selection turned into mosaic blocks: each `block`-pixel square takes the average colour of the
 * square (transparent pixels count for nothing), and a pixel is mixed between its own colour and that average by how
 * selected it is, so the edge of the selection stays soft. `rgba` is the picture at the mask's size.
 */
export function mosaicPixels(rgba: Uint8ClampedArray, m: Mask, invert: boolean, block: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba);
  const size = Math.max(2, Math.round(block));
  for (let by = 0; by < m.height; by += size) {
    for (let bx = 0; bx < m.width; bx += size) {
      const x1 = Math.min(m.width, bx + size);
      const y1 = Math.min(m.height, by + size);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let selected = false;
      for (let y = by; y < y1; y++) {
        for (let x = bx; x < x1; x++) {
          const i = y * m.width + x;
          if (amount(m, i, invert) > 0) selected = true;
          const w = rgba[i * 4 + 3]!;
          r += rgba[i * 4]! * w;
          g += rgba[i * 4 + 1]! * w;
          b += rgba[i * 4 + 2]! * w;
          a += w;
        }
      }
      // Nothing of the square is selected, or it is all transparent: leave it as it is.
      if (!selected || a === 0) continue;
      const avg = [r / a, g / a, b / a, a / ((x1 - bx) * (y1 - by))];
      for (let y = by; y < y1; y++) {
        for (let x = bx; x < x1; x++) {
          const i = y * m.width + x;
          const k = amount(m, i, invert) / 255;
          for (let c = 0; c < 4; c++) out[i * 4 + c] = Math.round(rgba[i * 4 + c]! * (1 - k) + avg[c]! * k);
        }
      }
    }
  }
  return out;
}

/** White where selected, transparent elsewhere: how the canvas wants an inpaint mask. */
export function transparentMaskPixels(m: Mask, invert: boolean): Uint8ClampedArray {
  return overlayPixels(m, [255, 255, 255], invert, 1);
}

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The picture could not be loaded'));
    img.src = url;
  });
}

function context(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no canvas');
  return ctx;
}

async function pixelsOf(url: string): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const img = await load(url);
  const ctx = context(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
  return { data, width, height };
}

const toBlob = (ctx: CanvasRenderingContext2D) => new Promise<Blob>((resolve, reject) => ctx.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));

function draw(ctx: CanvasRenderingContext2D, rgba: Uint8ClampedArray, width: number, height: number) {
  ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
}

export async function loadMask(url: string): Promise<Mask> {
  const { data, width, height } = await pixelsOf(url);
  return maskFromPixels(data, width, height);
}

/** A picture URL of the selection tinted with `color`, to lay over the picture. */
export async function overlayUrl(m: Mask, color: [number, number, number], invert: boolean): Promise<string> {
  const ctx = context(m.width, m.height);
  draw(ctx, overlayPixels(m, color, invert, 0.5), m.width, m.height);
  return URL.createObjectURL(await toBlob(ctx));
}

/** The picture at `url` cut to the selection, as a PNG. The mask must be the same size as the picture. */
export async function cutoutBlob(url: string, m: Mask, invert: boolean): Promise<Blob> {
  const { data, width, height } = await pixelsOf(url);
  if (width !== m.width || height !== m.height) throw new Error('The mask does not fit the picture');
  const ctx = context(width, height);
  draw(ctx, cutoutPixels(data, m, invert), width, height);
  return toBlob(ctx);
}

/** The picture at `url` with the selection turned into mosaic, as a PNG. The mask must be the same size as the picture. */
export async function mosaicBlob(url: string, m: Mask, invert: boolean, block: number): Promise<Blob> {
  const { data, width, height } = await pixelsOf(url);
  if (width !== m.width || height !== m.height) throw new Error('The mask does not fit the picture');
  const ctx = context(width, height);
  draw(ctx, mosaicPixels(data, m, invert, block), width, height);
  return toBlob(ctx);
}

export async function transparentMaskBlob(m: Mask, invert: boolean): Promise<Blob> {
  const ctx = context(m.width, m.height);
  draw(ctx, transparentMaskPixels(m, invert), m.width, m.height);
  return toBlob(ctx);
}
