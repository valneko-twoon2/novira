// Saved text screen scenes ("templates"): the layers as they are laid out (words, positions, styles, bubbles, the AI fills)
// and the size of the sheet. A picture used as the background is never part of one: a template is the lettering to put
// on whatever picture is there. Applying it replaces the layers; on a picture it scales them to that picture's size.
import { useTextEditor } from '../text/textEditor';
import { newLayerId, type Layer, type Scene } from '../text/textModel';
import { createPresetStore, type PresetKind } from './presetStore';
import { scaleStyle } from './textStylePresets';

export interface TextScenePresetData {
  width: number;
  height: number;
  /** The color of a plain background (null: transparent); absent when the scene was on a picture. */
  background?: { color: string | null };
  layers: Layer[];
}

/** The smallest a bubble may be made (the property boxes' own minimum). */
const BUBBLE_MIN = 40;

export const useTextScenePresets = createPresetStore<TextScenePresetData>({ name: 'novira.textScenePresets', seed: [] });

/**
 * The layer moved and resized for a sheet `kx` times as wide and `ky` times as high: the centre follows each axis, every
 * size (letters, bubble, outlines, shadow, tail) follows the smaller factor so the shapes keep their proportions. A layer's
 * AI fill needs no change: it scales with the font size.
 */
export function scaleLayer(layer: Layer, kx: number, ky: number): Layer {
  const k = Math.min(kx, ky);
  const px = (n: number) => Math.round(n * k);
  const moved = { x: Math.round(layer.x * kx), y: Math.round(layer.y * ky), style: scaleStyle(layer.style, Math.max(1, layer.style.fontSize * k)) };
  if (layer.type === 'text') return { ...layer, ...moved };
  return {
    ...layer,
    ...moved,
    width: Math.max(BUBBLE_MIN, px(layer.width)),
    height: Math.max(BUBBLE_MIN, px(layer.height)),
    border: { ...layer.border, width: px(layer.border.width) },
    tail: { ...layer.tail, x: px(layer.tail.x), y: px(layer.tail.y), width: Math.max(1, px(layer.tail.width)) },
  };
}

/** The scene a template makes on the current one: its layers (new ids, scaled to a picture), and its sheet unless a picture is under it. */
export function sceneFromTemplate(data: TextScenePresetData, current: Scene): Scene {
  const onPicture = current.background.kind === 'image' || !data.background;
  const target = onPicture ? { width: current.width, height: current.height } : { width: data.width, height: data.height };
  const kx = data.width > 0 ? target.width / data.width : 1;
  const ky = data.height > 0 ? target.height / data.height : 1;
  const layers = data.layers.map((l) => ({ ...scaleLayer(l, kx, ky), id: newLayerId() }) as Layer);
  if (onPicture) return { ...current, layers };
  return { ...current, ...target, background: { kind: 'color', color: data.background!.color }, layers };
}

export const textScenePresets: PresetKind<TextScenePresetData> = {
  store: useTextScenePresets,
  snapshot: () => {
    const { scene } = useTextEditor.getState();
    return {
      width: scene.width,
      height: scene.height,
      ...(scene.background.kind === 'color' ? { background: { color: scene.background.color } } : {}),
      layers: structuredClone(scene.layers),
    };
  },
  apply: (data) => {
    const s = useTextEditor.getState();
    s.checkpoint();
    useTextEditor.setState({ scene: sceneFromTemplate(data, s.scene), selectedId: null });
  },
};
