// A part of a panel's picture drawn again (inpaint). The person paints over what to redraw, or the assistant names boxes,
// in fractions of the panel; the mask is drawn at the picture's own size through the inverse of how the picture sits in
// its panel (moved, sized, turned, mirrored, as pageRender draws it), so the part painted on the page is the part redrawn.
import type { ComicImageView } from './document';
import { pictureBox, type Size } from './imageView';

/** A brush stroke over a panel: x, y pairs in fractions of the panel, and the brush's width as a share of the panel's width. */
export interface FixStroke {
  points: number[];
  width: number;
}

/** A box of the panel to redraw, in fractions of the panel. */
export interface FixBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What to redraw of a panel's picture: what was painted and the boxes named. */
export interface FixMask {
  strokes: FixStroke[];
  boxes: FixBox[];
}

/** The brush's width, as a share of the panel's width. */
export const FIX_BRUSH = { min: 0.01, max: 0.25, step: 0.01, default: 0.06 } as const;
/** How far the painted part may change from the picture (the inpaint strength). */
export const FIX_STRENGTH = { min: 0.3, max: 1, step: 0.05, default: 0.75 } as const;
/** The most of each a mask keeps. */
export const FIX_LIMITS = { strokes: 200, points: 4000, boxes: 8 } as const;
/** The least distance between two points of a stroke, as a share of the panel's width: closer points are skipped. */
const MIN_STEP = 0.004;

/** a, b, c, d, e, f of a 2D transform, as a canvas's setTransform takes them: (x, y) goes to (a x + c y + e, b x + d y + f). */
export type Matrix = [number, number, number, number, number, number];

/**
 * The transform from a point of the panel (in the units of `panel`) to a pixel of the picture: the picture is drawn at its
 * centre, turned and then mirrored, at the size its view gives it, so a point goes back through the mirror, the turn and the
 * shift, and is scaled from the shown size to the picture's own.
 */
export function panelToPicture(view: ComicImageView, image: Size, panel: Size): Matrix {
  const box = pictureBox(view, image, panel);
  const k = box.width ? image.width / box.width : 1;
  const turn = (view.rotation * Math.PI) / 180;
  const fx = view.flipX ? -1 : 1;
  const fy = view.flipY ? -1 : 1;
  const a = k * fx * Math.cos(turn);
  const c = k * fx * Math.sin(turn);
  const b = -k * fy * Math.sin(turn);
  const d = k * fy * Math.cos(turn);
  return [a, b, c, d, image.width / 2 - (a * box.cx + c * box.cy), image.height / 2 - (b * box.cx + d * box.cy)];
}

/** A point through a transform. */
export function applyMatrix(m: Matrix, x: number, y: number): { x: number; y: number } {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

/** Whether the mask asks for anything to be redrawn. */
export const hasFix = (mask: FixMask): boolean => mask.boxes.length > 0 || mask.strokes.some((s) => s.points.length >= 2);

const unit = (v: number) => Math.min(1, Math.max(0, v));

/** A stroke with one more point, unless it is too close to the last one or the stroke is full. */
export function extendFix(stroke: FixStroke, x: number, y: number, panelAspect: number): FixStroke {
  const { points } = stroke;
  const n = points.length;
  if (n >= FIX_LIMITS.points * 2) return stroke;
  const px = unit(x);
  const py = unit(y);
  // The step is measured in panel widths across and down alike, so a tall panel does not thin out its strokes.
  if (n >= 2 && Math.hypot(px - points[n - 2]!, (py - points[n - 1]!) * panelAspect) < MIN_STEP) return stroke;
  return { ...stroke, points: [...points, px, py] };
}

/**
 * The boxes the assistant named, each inside the panel and big enough to redraw, at most `FIX_LIMITS.boxes`; anything that is
 * not four numbers is left out.
 */
export function readFixBoxes(v: unknown): FixBox[] {
  const list = Array.isArray(v) ? v : v && typeof v === 'object' ? [v] : [];
  const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : null);
  return list
    .flatMap((raw) => {
      const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      const [x, y, w, h] = [num(o.x), num(o.y), num(o.w), num(o.h)];
      if (x === null || y === null || w === null || h === null) return [];
      const bx = unit(x);
      const by = unit(y);
      const bw = Math.min(unit(w), 1 - bx);
      const bh = Math.min(unit(h), 1 - by);
      return bw >= 0.02 && bh >= 0.02 ? [{ x: bx, y: by, w: bw, h: bh }] : [];
    })
    .slice(0, FIX_LIMITS.boxes);
}

/**
 * The mask as a picture the size of the panel's picture: white where it is redrawn, on black. `panel` is the panel's size
 * in any unit, with its own proportions (its width and its height as the page shows them).
 */
export async function fixMaskPicture(mask: FixMask, view: ComicImageView, image: Size, panel: Size): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width));
  canvas.height = Math.max(1, Math.round(image.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(...panelToPicture(view, image, panel));
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const b of mask.boxes) ctx.fillRect(b.x * panel.width, b.y * panel.height, b.w * panel.width, b.h * panel.height);
  for (const s of mask.strokes) {
    const at = (i: number) => [s.points[i]! * panel.width, s.points[i + 1]! * panel.height] as const;
    const width = s.width * panel.width;
    if (s.points.length === 2) {
      const [x, y] = at(0);
      ctx.beginPath();
      ctx.arc(x, y, width / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    if (s.points.length < 2) continue;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(...at(0));
    for (let i = 2; i + 1 < s.points.length; i += 2) ctx.lineTo(...at(i));
    ctx.stroke();
  }
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('empty image'))), 'image/png'));
}
