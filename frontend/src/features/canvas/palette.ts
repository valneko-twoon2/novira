// Colors for 2D canvas drawing, read from the theme tokens so the stage follows tokens.css.
export interface StagePalette {
  checkerA: string;
  checkerB: string;
  grid: string;
  gridStrong: string;
  bbox: string;
  bboxHandle: string;
  outside: string;
  cursor: string;
  cursorShadow: string;
  labelBg: string;
  labelText: string;
  accent: string;
}

const FALLBACK: StagePalette = {
  checkerA: '#0f1d3a',
  checkerB: '#172a4e',
  grid: 'rgba(110, 170, 255, 0.08)',
  gridStrong: 'rgba(110, 170, 255, 0.18)',
  bbox: '#3fc4ff',
  bboxHandle: '#f2f7ff',
  outside: 'rgba(2, 8, 24, 0.45)',
  cursor: '#f2f7ff',
  cursorShadow: '#060e22',
  labelBg: '#0b5bb0',
  labelText: '#f2f7ff',
  accent: '#3fc4ff',
};

// Grid colors stay translucent constants; tokens only provide opaque colors for them.
const VARS: Partial<Record<keyof StagePalette, string>> = {
  checkerA: '--checker-a',
  checkerB: '--checker-b',
  bbox: '--blue-400',
  bboxHandle: '--base-50',
  outside: '--overlay-light',
  cursor: '--base-50',
  cursorShadow: '--base-950',
  labelBg: '--blue-700',
  labelText: '--base-50',
  accent: '--accent',
};

export function readPalette(el: Element): StagePalette {
  const cs = getComputedStyle(el);
  const out = { ...FALLBACK };
  for (const k of Object.keys(VARS) as (keyof StagePalette)[]) {
    const name = VARS[k];
    const v = name ? cs.getPropertyValue(name).trim() : '';
    if (v) out[k] = v;
  }
  return out;
}
