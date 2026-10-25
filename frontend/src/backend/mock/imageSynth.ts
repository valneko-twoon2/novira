// Procedural "generation" for the mock backend: draws abstract art deterministically from seed and prompt.
import { hashString, mulberry32 } from './random';

const MAX_RENDER = 1024;

export interface SynthInput {
  width: number;
  height: number;
  seed: number;
  prompt: string;
  /** Source image drawn underneath (img2img, inpaint, upscale). */
  initImageUrl?: string | null;
  /** 0..1, how much the new pattern covers the source image. */
  strength?: number;
  /** Inpaint / outpaint: only where the mask is white (red channel) is redrawn; the source stays elsewhere. */
  maskImageUrl?: string | null;
}

export interface SynthResult {
  canvas: HTMLCanvasElement;
  url: string;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  let p = imageCache.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      // Backend images come from another origin; CORS keeps canvases that draw them readable.
      if (/^https?:/.test(url)) img.crossOrigin = 'anonymous';
      img.onerror = () => reject(new Error(`failed to load ${url}`));
      img.src = url;
    });
    imageCache.set(url, p);
  }
  return p;
}

function renderSize(w: number, h: number): [number, number] {
  const scale = Math.min(1, MAX_RENDER / Math.max(w, h));
  return [Math.max(8, Math.round(w * scale)), Math.max(8, Math.round(h * scale))];
}

function promptHues(prompt: string, rand: () => number): number[] {
  const words = prompt
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2);
  const hues = words.slice(0, 4).map((w) => hashString(w) % 360);
  while (hues.length < 3) hues.push(Math.floor(rand() * 360));
  return hues;
}

function hsl(h: number, s: number, l: number, a = 1): string {
  return `hsla(${Math.round(h) % 360}, ${s}%, ${l}%, ${a})`;
}

export async function synthesize(input: SynthInput): Promise<SynthResult> {
  const [w, h] = renderSize(input.width, input.height);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  const rand = mulberry32(input.seed ^ hashString(input.prompt));
  const hues = promptHues(input.prompt, rand);
  const [h0, h1, h2] = hues as [number, number, number];

  const bg = ctx.createLinearGradient(0, 0, w * rand(), h);
  bg.addColorStop(0, hsl(h0, 55, 18 + rand() * 15));
  bg.addColorStop(0.55, hsl(h1, 60, 30 + rand() * 20));
  bg.addColorStop(1, hsl(h2, 50, 12 + rand() * 12));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Glowing blobs
  ctx.globalCompositeOperation = 'lighter';
  const blobs = 6 + Math.floor(rand() * 8);
  for (let i = 0; i < blobs; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = (0.1 + rand() * 0.45) * Math.max(w, h);
    const hue = hues[i % hues.length] as number;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hsl(hue + rand() * 40, 80, 60, 0.35 + rand() * 0.25));
    g.addColorStop(1, hsl(hue, 80, 50, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.globalCompositeOperation = 'source-over';

  // Layered horizon silhouettes
  const layers = 2 + Math.floor(rand() * 3);
  for (let l = 0; l < layers; l++) {
    const base = h * (0.55 + l * 0.12 + rand() * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, h);
    const freq = 2 + rand() * 5;
    const amp = h * (0.04 + rand() * 0.1);
    const phase = rand() * Math.PI * 2;
    for (let x = 0; x <= w; x += Math.max(2, w / 160)) {
      const y = base + Math.sin((x / w) * Math.PI * freq + phase) * amp + Math.sin((x / w) * 23 + phase) * amp * 0.2;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = hsl(h0 + l * 25, 35, 8 + l * 4, 0.85);
    ctx.fill();
  }

  // Sparkles
  const stars = Math.floor(rand() * 120);
  for (let i = 0; i < stars; i++) {
    ctx.fillStyle = hsl(h1, 90, 85, rand() * 0.8);
    const s = rand() * 2.2;
    ctx.fillRect(rand() * w, rand() * h * 0.6, s, s);
  }

  if (input.initImageUrl) {
    try {
      const img = await loadImage(input.initImageUrl);
      const overlay = Math.min(1, Math.max(0, input.strength ?? 0.7));
      const pattern = document.createElement('canvas');
      pattern.width = w;
      pattern.height = h;
      pattern.getContext('2d')?.drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.globalAlpha = overlay * 0.85;
      ctx.globalCompositeOperation = 'overlay';
      ctx.drawImage(pattern, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = overlay * 0.35;
      ctx.drawImage(pattern, 0, 0);
      ctx.globalAlpha = 1;
    } catch {
      // Keep the pure pattern when the source cannot be loaded.
    }
    if (input.maskImageUrl) await keepSourceOutsideMask(ctx, canvas, input.initImageUrl, input.maskImageUrl);
  }

  const url = await toObjectUrl(canvas);
  return { canvas, url };
}

/** Puts the source back where the mask is black, like the real backend's final composite. */
async function keepSourceOutsideMask(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, sourceUrl: string, maskUrl: string) {
  try {
    const [source, mask] = await Promise.all([loadImage(sourceUrl), loadImage(maskUrl)]);
    const { width: w, height: h } = canvas;
    const alpha = document.createElement('canvas');
    alpha.width = w;
    alpha.height = h;
    const actx = alpha.getContext('2d');
    if (!actx) return;
    actx.drawImage(mask, 0, 0, w, h);
    const data = actx.getImageData(0, 0, w, h);
    for (let i = 0; i < data.data.length; i += 4) data.data[i + 3] = data.data[i] as number;
    actx.putImageData(data, 0, 0);
    const redrawn = document.createElement('canvas');
    redrawn.width = w;
    redrawn.height = h;
    const rctx = redrawn.getContext('2d');
    if (!rctx) return;
    rctx.drawImage(canvas, 0, 0);
    rctx.globalCompositeOperation = 'destination-in';
    rctx.drawImage(alpha, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);
    ctx.drawImage(redrawn, 0, 0);
  } catch {
    // Keep the whole redrawn picture when the mask cannot be loaded.
  }
}

function toObjectUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png')), 'image/png');
  });
}

/** Low-res noisy preview that converges to the final image as `fraction` approaches 1. */
export function progressPreview(final: HTMLCanvasElement, fraction: number, seed: number): string {
  const pw = 64;
  const ph = Math.max(8, Math.round((final.height / final.width) * pw));
  const c = document.createElement('canvas');
  c.width = pw;
  c.height = ph;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.filter = `blur(${Math.round((1 - fraction) * 6)}px)`;
  ctx.drawImage(final, 0, 0, pw, ph);
  ctx.filter = 'none';
  const data = ctx.getImageData(0, 0, pw, ph);
  const rand = mulberry32(seed + Math.round(fraction * 1000));
  const noise = (1 - fraction) * 160;
  for (let i = 0; i < data.data.length; i += 4) {
    const n = (rand() - 0.5) * noise;
    data.data[i] = clamp((data.data[i] as number) * fraction + n + 60 * (1 - fraction));
    data.data[i + 1] = clamp((data.data[i + 1] as number) * fraction + n + 60 * (1 - fraction));
    data.data[i + 2] = clamp((data.data[i + 2] as number) * fraction + n + 60 * (1 - fraction));
  }
  ctx.putImageData(data, 0, 0);
  return c.toDataURL('image/png');
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

export async function imageSize(url: string): Promise<{ width: number; height: number }> {
  const img = await loadImage(url);
  return { width: img.naturalWidth, height: img.naturalHeight };
}
