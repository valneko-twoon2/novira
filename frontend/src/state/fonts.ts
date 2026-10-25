// Fonts: the ones that ship with the app (Fontsource), so logos and balloons look the same on every PC, and the ones
// installed on this computer (read from the backend once, when a font list first opens). The text editor and the comic
// choose from both. The app's own fonts are a stylesheet of their own (appFontFaces.ts), loaded the first time a screen
// that draws with them opens (useAppFonts) or a canvas needs one (ensureFont).
import { useEffect } from 'react';
import { create } from 'zustand';
import { backend } from '@/backend';
import { describeError, devLog } from './devLog';

export interface FontDef {
  /** CSS family name; also what is shown (font names are not translated). */
  family: string;
  label: string;
  /** Weights the font file has; the style's weight snaps to the nearest one. */
  weights: number[];
}

export const FONTS: FontDef[] = [
  { family: 'Noto Sans JP Variable', label: 'Noto Sans JP', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Zen Maru Gothic', label: 'Zen Maru Gothic', weights: [400, 700, 900] },
  { family: 'Shippori Mincho', label: 'Shippori Mincho', weights: [400, 800] },
  { family: 'Dela Gothic One', label: 'Dela Gothic One', weights: [400] },
  { family: 'RocknRoll One', label: 'RocknRoll One', weights: [400] },
  { family: 'Reggae One', label: 'Reggae One', weights: [400] },
  { family: 'Rampart One', label: 'Rampart One', weights: [400] },
  { family: 'Potta One', label: 'Potta One', weights: [400] },
  { family: 'Hachi Maru Pop', label: 'Hachi Maru Pop', weights: [400] },
  { family: 'DotGothic16', label: 'DotGothic16', weights: [400] },
  { family: 'Bangers', label: 'Bangers', weights: [400] },
  { family: 'Anton', label: 'Anton', weights: [400] },
  { family: 'Permanent Marker', label: 'Permanent Marker', weights: [400] },
];

/** Whether a family is one of the app's own fonts. */
export function isAppFont(family: string): boolean {
  return FONTS.some((f) => f.family === family);
}

export function fontOf(family: string): FontDef {
  return FONTS.find((f) => f.family === family) ?? FONTS[0]!;
}

/** The weight the font really has that is closest to `wanted`. */
export function snapWeight(family: string, wanted: number): number {
  const weights = fontOf(family).weights;
  return weights.reduce((best, w) => (Math.abs(w - wanted) < Math.abs(best - wanted) ? w : best), weights[0]!);
}

/** The CSS `font` value for canvas drawing. */
export function fontCss(family: string, weight: number, sizePx: number): string {
  return `${snapWeight(family, weight)} ${sizePx}px "${family}", "Noto Sans JP Variable", sans-serif`;
}

/**
 * Loads the font files that `text` needs (Fontsource splits Japanese fonts by character range), so a canvas draws real
 * glyphs instead of a fallback. Resolves even when loading fails; drawing then uses the fallback font.
 */
export async function ensureFont(family: string, weight: number, text: string): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await loadAppFonts();
  try {
    await document.fonts.load(`${snapWeight(family, weight)} 32px "${family}"`, text || 'A');
  } catch {
    // keep the fallback
  }
}

const useAppFontFaces = create<{ ready: boolean }>()(() => ({ ready: false }));
let faces: Promise<void> | null = null;

/** Loads the @font-face rules of the app's own fonts, once. Resolves also when they cannot be loaded (the fallback font draws). */
export function loadAppFonts(): Promise<void> {
  faces ??= import('./appFontFaces').then(
    () => useAppFontFaces.setState({ ready: true }),
    (err: unknown) => {
      faces = null;
      devLog('error', 'fonts', `the app's fonts could not be loaded: ${describeError(err)}`);
    },
  );
  return faces;
}

/** Starts loading the app's own fonts; true once their rules are in, so what is measured or shown uses the right font. */
export function useAppFonts(): boolean {
  useEffect(() => void loadAppFonts(), []);
  return useAppFontFaces((s) => s.ready);
}

interface InstalledFonts {
  /** The families installed on this computer, sorted; empty until loaded, or when they cannot be read. */
  families: string[];
  loaded: boolean;
  /** Reads the list from the backend, once. */
  load: () => void;
}

let loading: Promise<void> | null = null;

export const useInstalledFonts = create<InstalledFonts>()((set) => ({
  families: [],
  loaded: false,
  load: () => {
    loading ??= backend
      .listFonts()
      .then((families) => set({ families: families.filter((f) => !isAppFont(f)), loaded: true }))
      .catch((err: unknown) => {
        devLog('error', 'fonts', `installed fonts could not be read: ${describeError(err)}`);
        set({ loaded: true });
      });
  },
}));

/** The CSS font-family for a chosen family: it first, then the app's fallbacks (an installed font missing here falls back). */
export function fontStack(family: string | null | undefined): string | undefined {
  return family ? `"${family}", "Noto Sans JP Variable", sans-serif` : undefined;
}
