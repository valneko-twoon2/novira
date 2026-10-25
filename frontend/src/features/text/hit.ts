// Picking and dragging layers on the canvas: coordinates between the image and a layer, and what is under the pointer.
import type { Layer, TextStyle } from '@/state/text/textModel';

export interface Point {
  x: number;
  y: number;
}

/** A point of the image expressed in the layer's own (unrotated, centre-origin) space. */
export function toLocal(layer: Pick<Layer, 'x' | 'y' | 'rotation'>, p: Point): Point {
  const a = (-layer.rotation * Math.PI) / 180;
  const dx = p.x - layer.x;
  const dy = p.y - layer.y;
  return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
}

/** The inverse of `toLocal`. */
export function toImage(layer: Pick<Layer, 'x' | 'y' | 'rotation'>, p: Point): Point {
  const a = (layer.rotation * Math.PI) / 180;
  return { x: layer.x + p.x * Math.cos(a) - p.y * Math.sin(a), y: layer.y + p.x * Math.sin(a) + p.y * Math.cos(a) };
}

export type Handle = { kind: 'tail' } | { kind: 'corner'; sx: 1 | -1; sy: 1 | -1 };

export interface Half {
  hw: number;
  hh: number;
}

/** The handle under `p` (an image point) within `radius` image pixels, if any. */
export function handleAt(layer: Layer, half: Half, p: Point, radius: number): Handle | null {
  const local = toLocal(layer, p);
  if (layer.type === 'bubble' && layer.tail.enabled && Math.hypot(local.x - layer.tail.x, local.y - layer.tail.y) <= radius) {
    return { kind: 'tail' };
  }
  for (const sx of [1, -1] as const) {
    for (const sy of [1, -1] as const) {
      if (Math.hypot(local.x - sx * half.hw, local.y - sy * half.hh) <= radius) return { kind: 'corner', sx, sy };
    }
  }
  return null;
}

/** Whether `p` (an image point) is inside the layer's box. */
export function containsPoint(layer: Layer, half: Half, p: Point): boolean {
  const local = toLocal(layer, p);
  return Math.abs(local.x) <= half.hw && Math.abs(local.y) <= half.hh;
}

/** The top-most visible, unlocked layer under `p`. */
export function layerAt(layers: Layer[], halves: Map<string, Half>, p: Point): Layer | null {
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const layer = layers[i]!;
    const half = halves.get(layer.id);
    if (layer.visible && !layer.locked && half && containsPoint(layer, half, p)) return layer;
  }
  return null;
}

/** The style with every size (font, outlines, shadow, spacing) multiplied by `k`. */
export function scaleStyle(style: TextStyle, k: number): TextStyle {
  const r = (n: number) => Math.round(n * k * 10) / 10;
  return {
    ...style,
    fontSize: Math.max(4, Math.round(style.fontSize * k)),
    letterSpacing: r(style.letterSpacing),
    stroke: style.stroke && { ...style.stroke, width: r(style.stroke.width) },
    outline: style.outline && { ...style.outline, width: r(style.outline.width) },
    shadow: style.shadow && { ...style.shadow, blur: r(style.shadow.blur), offsetX: r(style.shadow.offsetX), offsetY: r(style.shadow.offsetY) },
  };
}
