// The pixel work of "finish with AI": the lit base picture and the line picture the model is given, and the cut that keeps
// the result inside the letters. Plain typed arrays, no DOM and no `ctx.filter`, so it runs the same everywhere and is tested directly.

export type Rgb = [number, number, number];

/** `#rrggbb` (or `#rgb`) as 0..255 channels; anything else is mid grey. */
export function parseColor(hex: string): Rgb {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [128, 128, 128];
  const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** The alpha of a picture's pixels as 0..1 (the letters drawn white on transparent). */
export function alphaOf(rgba: ArrayLike<number>): Float32Array {
  const out = new Float32Array(rgba.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = (rgba[i * 4 + 3] as number) / 255;
  return out;
}

/** One box blur along rows, then along columns, with edge pixels repeated. `r` is the half width in pixels. */
function boxBlurPass(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const span = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = (src[row] as number) * r;
    for (let x = 0; x <= r; x++) sum += src[row + Math.min(x, w - 1)] as number;
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / span;
      sum += (src[row + Math.min(x + r + 1, w - 1)] as number) - (src[row + Math.max(x - r, 0)] as number);
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = (tmp[x] as number) * r;
    for (let y = 0; y <= r; y++) sum += tmp[Math.min(y, h - 1) * w + x] as number;
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / span;
      sum += (tmp[Math.min(y + r + 1, h - 1) * w + x] as number) - (tmp[Math.max(y - r, 0) * w + x] as number);
    }
  }
  return out;
}

/** A Gaussian blur of standard deviation `sigma` pixels, made of three box blurs. */
export function gaussianBlur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  if (sigma < 0.5) return src;
  // Three boxes of width n have the variance of sigma^2 when n = sqrt(4 sigma^2 + 1).
  const half = Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));
  let out = src;
  for (let i = 0; i < 3; i++) out = boxBlurPass(out, w, h, half);
  return out;
}

/** How much larger than 512 px the picture's short side is: the blur radii were chosen on pictures that size. */
function sizeFactor(w: number, h: number): number {
  return Math.min(w, h) / 512;
}

/** The letters as a soft height field: sharp where the glyph is, rounded towards the edges. */
export function heightField(alpha: Float32Array, w: number, h: number): Float32Array {
  const k = sizeFactor(w, h);
  const near = gaussianBlur(alpha, w, h, 3 * k);
  const far = gaussianBlur(alpha, w, h, 9 * k);
  const out = new Float32Array(alpha.length);
  for (let i = 0; i < out.length; i++) out[i] = (alpha[i] as number) * 0.5 + (near[i] as number) * 0.3 + (far[i] as number) * 0.2;
  return out;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The lettering lit like an embossed surface (light from the top left) in the look's colour on its background colour: the
 * picture the model starts from. It already has the depth, so the model has less to invent and keeps the letters.
 */
export function bevelBase(alpha: Float32Array, w: number, h: number, fg: Rgb, bg: Rgb): Uint8ClampedArray {
  const height = heightField(alpha, w, h);
  // The height differences are strong where the field is steep; the gain was set by eye at 512 px; a larger picture has gentler slopes per pixel, so it grows with the size.
  const gain = 28 * sizeFactor(w, h);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const gx = ((height[y * w + Math.min(x + 1, w - 1)] as number) - (height[y * w + Math.max(x - 1, 0)] as number)) / (x === 0 || x === w - 1 ? 1 : 2);
      const gy = ((height[Math.min(y + 1, h - 1) * w + x] as number) - (height[Math.max(y - 1, 0) * w + x] as number)) / (y === 0 || y === h - 1 ? 1 : 2);
      const nx = -gx * gain;
      const ny = -gy * gain;
      const len = Math.sqrt(nx * nx + ny * ny + 1);
      const lit = clamp01((nx * -0.45 + ny * -0.6 + 0.66) / len);
      const shade = 0.35 + 0.95 * lit;
      const spec = lit ** 24 * 0.55;
      const a = alpha[i] as number;
      for (let c = 0; c < 3; c++) {
        const letter = clamp01((fg[c]! / 255) * shade + spec);
        out[i * 4 + c] = Math.round((bg[c]! * (1 - a) + letter * 255 * a));
      }
      out[i * 4 + 3] = 255;
    }
  }
  return out;
}

/** White lines on black where the letters' edge runs, thickened by one pixel: what a line ControlNet is given. */
export function lineMap(alpha: Float32Array, w: number, h: number): Uint8ClampedArray {
  const edge = new Float32Array(alpha.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const dx = Math.abs((alpha[i] as number) - (alpha[y * w + Math.max(x - 1, 0)] as number));
      const dy = Math.abs((alpha[i] as number) - (alpha[Math.max(y - 1, 0) * w + x] as number));
      edge[i] = clamp01((dx + dy) * 2);
    }
  }
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let j = Math.max(y - 1, 0); j <= Math.min(y + 1, h - 1); j++) {
        for (let i = Math.max(x - 1, 0); i <= Math.min(x + 1, w - 1); i++) m = Math.max(m, edge[j * w + i] as number);
      }
      const v = Math.round(m * 255);
      const o = (y * w + x) * 4;
      out[o] = v;
      out[o + 1] = v;
      out[o + 2] = v;
      out[o + 3] = 255;
    }
  }
  return out;
}

/** The background colour of a result: the median of four corner squares, where a picture of letters has none of them. */
export function keyColor(rgba: ArrayLike<number>, w: number, h: number): Rgb {
  const side = Math.max(1, Math.min(24, Math.floor(Math.min(w, h) / 4)));
  const channels: number[][] = [[], [], []];
  for (const [x0, y0] of [
    [0, 0],
    [w - side, 0],
    [0, h - side],
    [w - side, h - side],
  ] as const) {
    for (let y = y0; y < y0 + side; y++) {
      for (let x = x0; x < x0 + side; x++) for (let c = 0; c < 3; c++) channels[c]!.push(rgba[(y * w + x) * 4 + c] as number);
    }
  }
  const mid = (list: number[]) => list.sort((a, b) => a - b)[list.length >> 1] as number;
  return [mid(channels[0]!), mid(channels[1]!), mid(channels[2]!)];
}

/** How far the look may leave the letters at spill 100, as a share of the picture's short side. */
export const SPILL_REACH = 0.12;
/** How different from the background a pixel must be to count as part of the look. */
const KEY_RANGE = 0.16;

/**
 * The model's picture cut to the letters. With `spill` 0 the alpha is the glyph alpha exactly. With a spill, outside the
 * letters what does not look like the background stays, fading out with the distance from the letters (flames, glow).
 * `spill` is 0..100. The colours are the picture's own; only the alpha is made here.
 */
export function cutPicture(rgba: ArrayLike<number>, glyphs: Float32Array, w: number, h: number, spill: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  const reach = (clamp01(spill / 100) * SPILL_REACH * Math.min(w, h)) | 0;
  let zone: Float32Array | null = null;
  let key: Rgb = [0, 0, 0];
  if (reach >= 1) {
    // The glyphs blurred over the spill radius and brightened, so the zone is full next to the letters and gone at the reach.
    const blurred = gaussianBlur(glyphs, w, h, reach / 2);
    zone = new Float32Array(blurred.length);
    for (let i = 0; i < zone.length; i++) zone[i] = clamp01((blurred[i] as number) * 2.2);
    key = keyColor(rgba, w, h);
  }
  for (let i = 0; i < w * h; i++) {
    let a = glyphs[i] as number;
    if (zone && a < 1) {
      const diff = Math.max(Math.abs((rgba[i * 4] as number) - key[0]), Math.abs((rgba[i * 4 + 1] as number) - key[1]), Math.abs((rgba[i * 4 + 2] as number) - key[2])) / 255;
      const soft = clamp01((diff - KEY_RANGE / 2) / KEY_RANGE);
      a = Math.max(a, soft * (zone[i] as number));
    }
    out[i * 4] = rgba[i * 4] as number;
    out[i * 4 + 1] = rgba[i * 4 + 1] as number;
    out[i * 4 + 2] = rgba[i * 4 + 2] as number;
    out[i * 4 + 3] = Math.round(a * 255);
  }
  return out;
}
