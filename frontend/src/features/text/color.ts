// Colour strings of the text editor: a native colour picker only knows `#rrggbb`, while shadows need an opacity too.

export interface Rgba {
  /** `#rrggbb`. */
  hex: string;
  /** 0..1. */
  alpha: number;
}

const HEX6 = /^#([0-9a-f]{6})$/i;
const HEX3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const RGBA = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d+\.?\d*|\.\d+)\s*)?\)$/i;

const byte = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

/** Reads `#rgb`, `#rrggbb`, `rgb()` and `rgba()`; anything else is black. */
export function parseColor(css: string): Rgba {
  const six = HEX6.exec(css);
  if (six) return { hex: `#${six[1]!.toLowerCase()}`, alpha: 1 };
  const three = HEX3.exec(css);
  if (three) return { hex: `#${three[1]!}${three[1]!}${three[2]!}${three[2]!}${three[3]!}${three[3]!}`.toLowerCase(), alpha: 1 };
  const m = RGBA.exec(css);
  if (m) return { hex: `#${byte(Number(m[1]))}${byte(Number(m[2]))}${byte(Number(m[3]))}`, alpha: m[4] === undefined ? 1 : Math.max(0, Math.min(1, Number(m[4]))) };
  return { hex: '#000000', alpha: 1 };
}

/** `#rrggbb` when opaque, otherwise `rgba(r, g, b, a)`. */
export function formatColor({ hex, alpha }: Rgba): string {
  if (alpha >= 1) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(alpha * 100) / 100})`;
}
