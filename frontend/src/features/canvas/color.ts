// Color conversions between RGBA objects and <input type=color> hex values (CSS strings: ui/canvasDraw/rgbaCss).
import type { RGBA } from '@/state/canvas';

const hex2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');

export const toHex = (c: RGBA) => `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;

export function fromHex(hex: string, a = 1): RGBA {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return { r: 0, g: 0, b: 0, a };
  return { r: parseInt(m[1] as string, 16), g: parseInt(m[2] as string, 16), b: parseInt(m[3] as string, 16), a };
}

/** Swatches shown in the fill color popover (InvokeAI-like set). */
export const PRESET_COLORS: RGBA[] = [
  { r: 0, g: 0, b: 0, a: 1 },
  { r: 255, g: 255, b: 255, a: 1 },
  { r: 128, g: 128, b: 128, a: 1 },
  { r: 240, g: 68, b: 106, a: 1 },
  { r: 255, g: 169, b: 77, a: 1 },
  { r: 252, g: 213, b: 53, a: 1 },
  { r: 79, g: 223, b: 168, a: 1 },
  { r: 63, g: 196, b: 255, a: 1 },
  { r: 11, g: 91, b: 176, a: 1 },
  { r: 169, g: 139, b: 255, a: 1 },
  { r: 245, g: 122, b: 182, a: 1 },
  { r: 139, g: 90, b: 60, a: 1 },
];
