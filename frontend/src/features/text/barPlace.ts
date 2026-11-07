// Where the floating bar of the selected layer goes: above the layer's box, below it when there is no room above, and
// never outside the sheet. Everything here is in CSS pixels of the sheet.
import type { Half } from './hit';

export interface BarLayer {
  x: number;
  y: number;
  rotation: number;
}

export interface BarPlace {
  left: number;
  top: number;
}

/** The bounding box of the layer's rotated box, in sheet pixels. */
export function layerBounds(layer: BarLayer, half: Half, scale: number): { left: number; top: number; right: number; bottom: number } {
  const a = (layer.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(a));
  const sin = Math.abs(Math.sin(a));
  const w = (half.hw * cos + half.hh * sin) * scale;
  const h = (half.hw * sin + half.hh * cos) * scale;
  const cx = layer.x * scale;
  const cy = layer.y * scale;
  return { left: cx - w, top: cy - h, right: cx + w, bottom: cy + h };
}

/**
 * Centred over the layer, `gap` above its top edge. When the bar would leave the sheet at the top it goes under the layer
 * instead; when neither fits (a layer taller than the sheet) it sits at the top edge. The sides are clamped.
 */
export function placeBar(layer: BarLayer, half: Half, scale: number, sheet: { width: number; height: number }, bar: { width: number; height: number }, gap = 8): BarPlace {
  const b = layerBounds(layer, half, scale);
  const centre = (b.left + b.right) / 2;
  const maxLeft = Math.max(0, sheet.width - bar.width);
  const left = Math.min(maxLeft, Math.max(0, centre - bar.width / 2));
  const above = b.top - gap - bar.height;
  const below = b.bottom + gap;
  const top = above >= 0 ? above : below + bar.height <= sheet.height ? below : 0;
  return { left, top };
}
