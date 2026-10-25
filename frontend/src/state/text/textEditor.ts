// Text editor: the scene being edited (kept between sessions), the selected layer and the undo history.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  EMPTY_SCENE,
  SCENE_LIMITS,
  newBubbleLayer,
  newLayerId,
  newTextLayer,
  type Background,
  type BubbleLayer,
  type BubbleShape,
  type Layer,
  type Scene,
  type TextLayer,
  type TextStyle,
} from './textModel';
import { overDefaults } from '../persistDefaults';
import { undoLimit, useSettings } from '../settings';

/** A new text layer in the font chosen in Settings, when one is. */
export function withDefaultFont<T extends TextLayer>(layer: T): T {
  const font = useSettings.getState().textFont;
  return font ? { ...layer, style: { ...layer.style, fontFamily: font } } : layer;
}

/** Edits with the same key within this time (a slider being dragged) become one undo step. */
const COALESCE_MS = 700;

let lastKey: string | null = null;
let lastAt = 0;

export type LayerPatch = Partial<Omit<TextLayer, 'type' | 'id'>> & Partial<Omit<BubbleLayer, 'type' | 'id'>>;
export type Order = 'up' | 'down' | 'top' | 'bottom';

interface TextEditorState {
  scene: Scene;
  selectedId: string | null;
  past: Scene[];
  future: Scene[];
  select: (id: string | null) => void;
  /** Starts an undo step; call before a drag whose moves are applied with `live`. */
  checkpoint: () => void;
  addText: (text: string) => string;
  addBubble: (shape: BubbleShape, text: string) => string;
  /** `key` joins consecutive edits of one control into one undo step; `live` skips history (the caller made a checkpoint). */
  update: (id: string, patch: LayerPatch, opts?: { key?: string; live?: boolean }) => void;
  updateStyle: (id: string, patch: Partial<TextStyle>, opts?: { key?: string }) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  reorder: (id: string, order: Order) => void;
  setBackground: (background: Background, size?: { width: number; height: number }) => void;
  resize: (width: number, height: number) => void;
  clear: () => void;
  undo: () => void;
  redo: () => void;
}

function clampSize(n: number): number {
  const { min, max } = SCENE_LIMITS.size;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export const useTextEditor = create<TextEditorState>()(
  persist(
    (set, get) => {
      /** Pushes the current scene to the undo history unless this edit continues the previous one. */
      const remember = (key?: string) => {
        const now = Date.now();
        const continues = key !== undefined && key === lastKey && now - lastAt < COALESCE_MS;
        lastKey = key ?? null;
        lastAt = now;
        if (continues) return;
        set({ past: [...get().past, get().scene].slice(-undoLimit()), future: [] });
      };
      const mapLayer = (id: string, f: (l: Layer) => Layer) =>
        set({ scene: { ...get().scene, layers: get().scene.layers.map((l) => (l.id === id ? f(l) : l)) } });
      return {
        scene: EMPTY_SCENE,
        selectedId: null,
        past: [],
        future: [],
        select: (selectedId) => set({ selectedId }),
        checkpoint: () => {
          lastKey = null;
          set({ past: [...get().past, get().scene].slice(-undoLimit()), future: [] });
        },
        addText: (text) => {
          remember();
          const layer = withDefaultFont(newTextLayer(get().scene, text));
          set({ scene: { ...get().scene, layers: [...get().scene.layers, layer] }, selectedId: layer.id });
          return layer.id;
        },
        addBubble: (shape, text) => {
          remember();
          const layer = newBubbleLayer(get().scene, shape, text);
          set({ scene: { ...get().scene, layers: [...get().scene.layers, layer] }, selectedId: layer.id });
          return layer.id;
        },
        update: (id, patch, opts) => {
          if (!opts?.live) remember(opts?.key);
          mapLayer(id, (l) => ({ ...l, ...patch }) as Layer);
        },
        updateStyle: (id, patch, opts) => {
          remember(opts?.key);
          mapLayer(id, (l) => ({ ...l, style: { ...l.style, ...patch } }));
        },
        remove: (id) => {
          remember();
          const s = get();
          set({ scene: { ...s.scene, layers: s.scene.layers.filter((l) => l.id !== id) }, selectedId: s.selectedId === id ? null : s.selectedId });
        },
        duplicate: (id) => {
          const s = get();
          const src = s.scene.layers.find((l) => l.id === id);
          if (!src) return;
          remember();
          const copy = { ...structuredClone(src), id: newLayerId(), x: src.x + 24, y: src.y + 24 } as Layer;
          const at = s.scene.layers.indexOf(src) + 1;
          const layers = [...s.scene.layers.slice(0, at), copy, ...s.scene.layers.slice(at)];
          set({ scene: { ...s.scene, layers }, selectedId: copy.id });
        },
        reorder: (id, order) => {
          const layers = [...get().scene.layers];
          const i = layers.findIndex((l) => l.id === id);
          if (i < 0) return;
          const to = order === 'up' ? i + 1 : order === 'down' ? i - 1 : order === 'top' ? layers.length - 1 : 0;
          if (to < 0 || to >= layers.length || to === i) return;
          remember();
          const [layer] = layers.splice(i, 1);
          layers.splice(to, 0, layer!);
          set({ scene: { ...get().scene, layers } });
        },
        setBackground: (background, size) => {
          remember();
          const scene = get().scene;
          set({ scene: { ...scene, background, ...(size ? { width: clampSize(size.width), height: clampSize(size.height) } : {}) } });
        },
        resize: (width, height) => {
          remember('resize');
          set({ scene: { ...get().scene, width: clampSize(width), height: clampSize(height) } });
        },
        clear: () => {
          remember();
          set({ scene: { ...get().scene, layers: [] }, selectedId: null });
        },
        undo: () => {
          const { past, scene, future, selectedId } = get();
          const prev = past.at(-1);
          if (!prev) return;
          lastKey = null;
          set({ scene: prev, past: past.slice(0, -1), future: [scene, ...future], selectedId: prev.layers.some((l) => l.id === selectedId) ? selectedId : null });
        },
        redo: () => {
          const { past, scene, future, selectedId } = get();
          const next = future[0];
          if (!next) return;
          lastKey = null;
          set({ scene: next, past: [...past, scene], future: future.slice(1), selectedId: next.layers.some((l) => l.id === selectedId) ? selectedId : null });
        },
      };
    },
    { name: 'novira.text', version: 1, partialize: (s) => ({ scene: s.scene }), merge: overDefaults('scene', EMPTY_SCENE) },
  ),
);
