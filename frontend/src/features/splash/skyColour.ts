// A colour token (`#rgb` or `#rrggbb`) read for the start-up sky's shader.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** `#rgb` or `#rrggbb` to numbers; anything else gives `fallback`. */
export function parseHex(value: string, fallback: Rgb): Rgb {
  const hex = value.trim().replace(/^#/, '');
  const full = hex.length === 3 ? [...hex].map((ch) => ch + ch).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return fallback;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
