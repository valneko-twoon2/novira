// Saved text styles for the Text tab: the look of a text layer (font, fill, outlines, shadow, spacing), applied to the
// selected text layer. A whole-scene preset would carry the layers' words and the background picture, which are the
// content rather than settings, so the reusable part of the Text tab is the style. The logo looks are the built-ins.
import { useTextEditor } from '../text/textEditor';
import { DEFAULT_TEXT_STYLE, LOGO_PRESETS, presetStyle, type LogoPreset, type TextLayer, type TextStyle } from '../text/textModel';
import { createPresetStore, type Preset, type PresetKind } from './presetStore';

export type TextStylePresetData = TextStyle;

const LOGO_NAMES: Record<LogoPreset, string> = {
  plain: 'Plain',
  pop: 'Pop',
  sfx: 'Sound effect',
  gold: 'Gold',
  sticker: 'Sticker',
  soft: 'Soft',
};

/** Id of the built-in preset made from a logo look. */
export const logoPresetId = (look: LogoPreset) => `seed-text-${look}`;

const SEED: Preset<TextStylePresetData>[] = LOGO_PRESETS.map((look) => ({
  id: logoPresetId(look),
  name: LOGO_NAMES[look],
  data: presetStyle(look, DEFAULT_TEXT_STYLE),
}));

export const useTextStylePresets = createPresetStore<TextStylePresetData>({ name: 'novira.textStylePresets', seed: SEED });

/** The selected layer when it is a text layer (styles are saved from and applied to text layers). */
export function selectedTextLayer(): TextLayer | null {
  const { scene, selectedId } = useTextEditor.getState();
  const layer = scene.layers.find((l) => l.id === selectedId);
  return layer?.type === 'text' ? layer : null;
}

/** A saved style at another font size: the target keeps its size and every pixel measure scales with it. */
export function scaleStyle(style: TextStyle, fontSize: number): TextStyle {
  const k = style.fontSize > 0 ? fontSize / style.fontSize : 1;
  const px = (n: number) => Math.round(n * k);
  const width = (n: number) => Math.max(1, px(n));
  return {
    ...style,
    fontSize,
    stroke: style.stroke && { ...style.stroke, width: width(style.stroke.width) },
    outline: style.outline && { ...style.outline, width: width(style.outline.width) },
    shadow: style.shadow && { ...style.shadow, blur: px(style.shadow.blur), offsetX: px(style.shadow.offsetX), offsetY: px(style.shadow.offsetY) },
    letterSpacing: px(style.letterSpacing),
  };
}

export const textStylePresets: PresetKind<TextStylePresetData> = {
  store: useTextStylePresets,
  snapshot: () => structuredClone(selectedTextLayer()?.style ?? DEFAULT_TEXT_STYLE),
  apply: (data) => {
    const layer = selectedTextLayer();
    if (layer) useTextEditor.getState().updateStyle(layer.id, scaleStyle(data, layer.style.fontSize));
  },
};
