// Canvas drawing helpers of the text editor's preview: text measuring, the transparency checkerboard and the selection frame.
import type { Layer } from '@/state/text/textModel';
import type { Half } from './hit';

/** Size of a handle square on screen, in CSS pixels. */
export const HANDLE_PX = 7;

let measureContext: CanvasRenderingContext2D | null = null;

/** A canvas context used only for measuring text, shared by hit-testing and layout. */
export function measureCtx(): CanvasRenderingContext2D {
  if (!measureContext) measureContext = document.createElement('canvas').getContext('2d')!;
  return measureContext;
}

/** Preview checkerboard for transparent areas, in device pixels. */
export function checkerboard(ctx: CanvasRenderingContext2D): void {
  const css = getComputedStyle(document.documentElement);
  const a = css.getPropertyValue('--checker-a').trim() || '#222222';
  const b = css.getPropertyValue('--checker-b').trim() || '#2c2c2c';
  const size = 12 * (window.devicePixelRatio || 1);
  for (let y = 0; y * size < ctx.canvas.height; y += 1) {
    for (let x = 0; x * size < ctx.canvas.width; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? a : b;
      ctx.fillRect(x * size, y * size, size, size);
    }
  }
}

/** The selected layer's frame, corner handles and (for a bubble) the pointer handle, on the overlay canvas. */
export function paintSelection(octx: CanvasRenderingContext2D, layer: Layer, half: Half, cssScale: number, dpr: number): void {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--blue-400').trim() || '#4c8dff';
  const k = cssScale * dpr;
  octx.save();
  octx.setTransform(k, 0, 0, k, 0, 0);
  octx.translate(layer.x, layer.y);
  octx.rotate((layer.rotation * Math.PI) / 180);
  octx.strokeStyle = accent;
  octx.lineWidth = 1.5 / cssScale;
  octx.strokeRect(-half.hw, -half.hh, half.hw * 2, half.hh * 2);
  const hs = HANDLE_PX / cssScale;
  octx.fillStyle = accent;
  for (const sx of [1, -1]) for (const sy of [1, -1]) octx.fillRect(sx * half.hw - hs / 2, sy * half.hh - hs / 2, hs, hs);
  if (layer.type === 'bubble' && layer.tail.enabled) {
    octx.setLineDash([4 / cssScale, 4 / cssScale]);
    octx.beginPath();
    octx.moveTo(0, 0);
    octx.lineTo(layer.tail.x, layer.tail.y);
    octx.stroke();
    octx.setLineDash([]);
    octx.beginPath();
    octx.arc(layer.tail.x, layer.tail.y, hs * 0.9, 0, Math.PI * 2);
    octx.fill();
  }
  octx.restore();
}
