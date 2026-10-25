// The partial redraw being marked on the page: which panel, what is painted over its picture, the brush, the words for the
// part and how far it may change. It lives only while the person paints (it is not part of the saved comic); Redraw queues
// it (see redrawPart) and ends it.
import { create } from 'zustand';
import { extendFix, FIX_BRUSH, FIX_LIMITS, FIX_STRENGTH, type FixStroke } from './panelFix';

interface FixState {
  /** The panel whose picture is being painted over; null when nothing is being marked. */
  panelId: string | null;
  strokes: FixStroke[];
  /** The brush's width, as a share of the panel's width. */
  brush: number;
  /** What to draw in the part; empty draws it from the panel's own prompt. */
  words: string;
  strength: number;
  /** Starts marking a panel's picture (anything marked on another panel is dropped). */
  start: (panelId: string) => void;
  /** Ends marking without redrawing. */
  stop: () => void;
  /** Starts a stroke at a point of the panel (fractions of the panel). */
  begin: (x: number, y: number) => void;
  /** Adds a point to the stroke being drawn; `panelAspect` is the panel's height over its width. */
  extend: (x: number, y: number, panelAspect: number) => void;
  /** Takes the last stroke away. */
  undoStroke: () => void;
  clear: () => void;
  setBrush: (width: number) => void;
  setWords: (words: string) => void;
  setStrength: (strength: number) => void;
}

const clamp = (v: number, range: { min: number; max: number }) => Math.min(range.max, Math.max(range.min, Number.isFinite(v) ? v : range.min));

export const useComicFix = create<FixState>((set, get) => ({
  panelId: null,
  strokes: [],
  brush: FIX_BRUSH.default,
  words: '',
  strength: FIX_STRENGTH.default,
  start: (panelId) => set((s) => (s.panelId === panelId ? {} : { panelId, strokes: [], words: '' })),
  stop: () => set({ panelId: null, strokes: [], words: '' }),
  begin: (x, y) => {
    const s = get();
    if (!s.panelId || s.strokes.length >= FIX_LIMITS.strokes) return;
    set({ strokes: [...s.strokes, extendFix({ points: [], width: s.brush }, x, y, 1)] });
  },
  extend: (x, y, panelAspect) => {
    const strokes = get().strokes;
    const last = strokes[strokes.length - 1];
    if (!last) return;
    const next = extendFix(last, x, y, panelAspect);
    if (next !== last) set({ strokes: [...strokes.slice(0, -1), next] });
  },
  undoStroke: () => set((s) => ({ strokes: s.strokes.slice(0, -1) })),
  clear: () => set({ strokes: [] }),
  setBrush: (width) => set({ brush: clamp(width, FIX_BRUSH) }),
  setWords: (words) => set({ words: words.slice(0, 1000) }),
  setStrength: (strength) => set({ strength: clamp(strength, FIX_STRENGTH) }),
}));
