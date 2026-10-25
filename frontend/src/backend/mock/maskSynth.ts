// The mock's stand-in for a segmentation model: a round blob around each clicked point (none around the ones to
// leave out), as the black-and-white picture ComfyUI's mask output becomes. The same clicks give the same mask.
import type { ComfyGraph } from '../types';

export interface MaskPoint {
  x: number;
  y: number;
  include: boolean;
}

/** The clicked points of a segmentation prompt (`coordinates_positive` / `coordinates_negative` are JSON texts). */
export function pointsOf(graph: ComfyGraph): MaskPoint[] {
  const node = Object.values(graph.prompt).find((n) => n.class_type === 'Sam2Segmentation');
  const read = (key: string, include: boolean): MaskPoint[] => {
    try {
      const raw = JSON.parse(String(node?.inputs[key] ?? '[]')) as { x: number; y: number }[];
      return raw.map((p) => ({ x: p.x, y: p.y, include }));
    } catch {
      return [];
    }
  };
  return [...read('coordinates_positive', true), ...read('coordinates_negative', false)];
}

/** The name of the picture a segmentation prompt reads. */
export function sourceOf(graph: ComfyGraph): string | null {
  const load = Object.values(graph.prompt).find((n) => n.class_type === 'LoadImage');
  const image = load?.inputs.image as { $image?: string } | undefined;
  return image?.$image ?? null;
}

/** A white-on-black mask picture of the given size. */
export function synthMask(width: number, height: number, points: MaskPoint[]): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('no canvas'));
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  const radius = Math.min(width, height) * 0.18;
  const blob = (p: MaskPoint, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const p of points.filter((q) => q.include)) blob(p, '#fff');
  for (const p of points.filter((q) => !q.include)) blob(p, '#000');
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ? URL.createObjectURL(b) : canvas.toDataURL('image/png')), 'image/png'));
}
