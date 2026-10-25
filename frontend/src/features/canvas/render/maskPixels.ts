// Pixel work for the generation inputs on RGBA buffers (ImageData.data), free of canvas calls so it can be tested.
// A mask is an opaque grey picture: the red channel says how strongly a pixel is redrawn (255 = fully).

/** The grey of an inpaint layer in the mask: its denoise limit (0..1), or full strength when it has none. */
export function maskGrey(denoiseLimit: number | null): number {
  if (denoiseLimit === null || !Number.isFinite(denoiseLimit)) return 255;
  return Math.round(Math.min(1, Math.max(0, denoiseLimit)) * 255);
}

/** Adds the transparent part of `rgba` to `mask` (same size): a pixel is redrawn as much as it is transparent. */
export function addTransparentArea(mask: Uint8ClampedArray, rgba: Uint8ClampedArray): void {
  for (let i = 0; i < mask.length; i += 4) {
    const v = Math.max(mask[i] as number, 255 - (rgba[i + 3] as number));
    mask[i] = v;
    mask[i + 1] = v;
    mask[i + 2] = v;
    mask[i + 3] = 255;
  }
}

/** Below this a mask value is antialiasing noise, not a request to redraw. */
const EMPTY_BELOW = 4;

/** True when no pixel of the mask asks for a redraw. */
export function maskIsEmpty(mask: Uint8ClampedArray): boolean {
  for (let i = 0; i < mask.length; i += 4) if ((mask[i] as number) >= EMPTY_BELOW) return false;
  return true;
}

interface Level {
  w: number;
  h: number;
  /** Premultiplied red, green, blue and alpha (0..1) per pixel. */
  c: Float32Array;
}

/**
 * One level up: the colour of a coarse pixel is the alpha-weighted mean of its known children, and it counts as known
 * as soon as its children add up to one opaque pixel. So the colour right next to the content is the content's edge
 * colour, not a mix with the average of the whole picture.
 */
function halve(l: Level): Level {
  const w = Math.max(1, Math.ceil(l.w / 2));
  const h = Math.max(1, Math.ceil(l.h / 2));
  const c = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const sx = x * 2 + dx;
          const sy = y * 2 + dy;
          if (sx >= l.w || sy >= l.h) continue;
          const i = (sy * l.w + sx) * 4;
          for (let k = 0; k < 4; k++) c[o + k] = (c[o + k] as number) + (l.c[i + k] as number);
        }
      }
      const weight = c[o + 3] as number;
      if (weight <= 0) continue;
      const a = Math.min(1, weight);
      for (let k = 0; k < 3; k++) c[o + k] = ((c[o + k] as number) / weight) * a;
      c[o + 3] = a;
    }
  }
  return { w, h, c };
}

/** Bilinear sample of a coarser level at the centre of fine pixel (x, y). */
function sample(l: Level, x: number, y: number, out: Float32Array) {
  const fx = Math.min(l.w - 1, Math.max(0, (x + 0.5) / 2 - 0.5));
  const fy = Math.min(l.h - 1, Math.max(0, (y + 0.5) / 2 - 0.5));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(l.w - 1, x0 + 1);
  const y1 = Math.min(l.h - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  for (let k = 0; k < 4; k++) {
    const a = l.c[(y0 * l.w + x0) * 4 + k] as number;
    const b = l.c[(y0 * l.w + x1) * 4 + k] as number;
    const c = l.c[(y1 * l.w + x0) * 4 + k] as number;
    const d = l.c[(y1 * l.w + x1) * 4 + k] as number;
    out[k] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }
}

/**
 * Fills transparent pixels with the colours of the nearest content, blurring with distance (pull-push), and makes
 * every pixel opaque. Opaque pixels keep their colour. This is the source an outpaint starts from where the canvas
 * is empty; the sampler redraws that area anyway, it only needs plausible colours to start from.
 */
export function pullPushFill(rgba: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const base: Level = { w, h, c: new Float32Array(w * h * 4) };
  for (let i = 0; i < w * h; i++) {
    const a = (rgba[i * 4 + 3] as number) / 255;
    for (let k = 0; k < 3; k++) base.c[i * 4 + k] = ((rgba[i * 4 + k] as number) / 255) * a;
    base.c[i * 4 + 3] = a;
  }
  const levels = [base];
  while (levels[levels.length - 1]!.w > 1 || levels[levels.length - 1]!.h > 1) levels.push(halve(levels[levels.length - 1]!));
  const s = new Float32Array(4);
  for (let l = levels.length - 2; l >= 0; l--) {
    const fine = levels[l]!;
    const coarse = levels[l + 1]!;
    for (let y = 0; y < fine.h; y++) {
      for (let x = 0; x < fine.w; x++) {
        const i = (y * fine.w + x) * 4;
        const a = fine.c[i + 3] as number;
        if (a >= 1) continue;
        sample(coarse, x, y, s);
        for (let k = 0; k < 4; k++) fine.c[i + k] = (fine.c[i + k] as number) + (1 - a) * (s[k] as number);
      }
    }
  }
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const a = base.c[i * 4 + 3] as number;
    for (let k = 0; k < 3; k++) out[i * 4 + k] = a > 0 ? Math.round(((base.c[i * 4 + k] as number) / a) * 255) : 0;
    out[i * 4 + 3] = 255;
  }
  return out;
}
