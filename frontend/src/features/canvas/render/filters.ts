// Simulated control-image preprocessors (canny, depth, ...) using plain 2D canvas pixel operations.
import type { FilterType } from '@/state/canvas';
import { createCanvas } from '@/ui/canvasDraw/entityRender';

function grayscale(src: ImageData): Float32Array {
  const d = src.data;
  const g = new Float32Array(src.width * src.height);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const a = (d[i + 3] as number) / 255;
    g[p] = (0.299 * (d[i] as number) + 0.587 * (d[i + 1] as number) + 0.114 * (d[i + 2] as number)) * a;
  }
  return g;
}

function sobel(g: Float32Array, w: number, h: number): { mag: Float32Array; gx: Float32Array; gy: Float32Array } {
  const mag = new Float32Array(w * h);
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
  const at = (x: number, y: number) => g[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))] as number;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) + at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
      const sy = -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
      const i = y * w + x;
      gx[i] = sx;
      gy[i] = sy;
      mag[i] = Math.sqrt(sx * sx + sy * sy);
    }
  }
  return { mag, gx, gy };
}

function blurred(source: HTMLCanvasElement, px: number): HTMLCanvasElement {
  const c = createCanvas(source.width, source.height);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.filter = `blur(${px}px)`;
  ctx.drawImage(source, 0, 0);
  return c;
}

/** Apply a simulated preprocessor. Output is opaque and the same size as the input. */
export function applyFilter(type: FilterType, source: HTMLCanvasElement): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const out = createCanvas(w, h);
  const octx = out.getContext('2d') as CanvasRenderingContext2D;
  if (type === 'none') {
    octx.drawImage(source, 0, 0);
    return out;
  }
  if (type === 'color_map') {
    const small = createCanvas(Math.max(1, Math.round(w / 48)), Math.max(1, Math.round(h / 48)));
    const sctx = small.getContext('2d') as CanvasRenderingContext2D;
    sctx.drawImage(source, 0, 0, small.width, small.height);
    octx.imageSmoothingEnabled = false;
    octx.drawImage(small, 0, 0, w, h);
    return out;
  }
  const input = type === 'depth' ? blurred(source, Math.max(2, Math.round(Math.min(w, h) / 64))) : type === 'hed' ? blurred(source, 1) : source;
  const ictx = input.getContext('2d') as CanvasRenderingContext2D;
  const g = grayscale(ictx.getImageData(0, 0, w, h));
  const img = octx.createImageData(w, h);
  const d = img.data;
  if (type === 'depth') {
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of g) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    const span = Math.max(1, hi - lo);
    for (let p = 0; p < g.length; p++) {
      const v = Math.round((((g[p] as number) - lo) / span) * 255);
      d[p * 4] = v;
      d[p * 4 + 1] = v;
      d[p * 4 + 2] = v;
      d[p * 4 + 3] = 255;
    }
  } else {
    const { mag, gx, gy } = sobel(g, w, h);
    for (let p = 0; p < g.length; p++) {
      const m = mag[p] as number;
      let r: number;
      let gg: number;
      let b: number;
      if (type === 'canny') {
        r = gg = b = m > 120 ? 255 : 0;
      } else if (type === 'hed') {
        r = gg = b = Math.min(255, m * 0.9);
      } else if (type === 'lineart') {
        r = gg = b = 255 - Math.min(255, m * 1.2);
      } else {
        const nx = -(gx[p] as number) / 255;
        const ny = -(gy[p] as number) / 255;
        const len = Math.sqrt(nx * nx + ny * ny + 1);
        r = ((nx / len) * 0.5 + 0.5) * 255;
        gg = ((ny / len) * 0.5 + 0.5) * 255;
        b = ((1 / len) * 0.5 + 0.5) * 255;
      }
      d[p * 4] = r;
      d[p * 4 + 1] = gg;
      d[p * 4 + 2] = b;
      d[p * 4 + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}
