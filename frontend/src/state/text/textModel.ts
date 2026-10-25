// The text editor document: a canvas size, a background and a stack of text and speech-bubble layers.

export type FillStyle = { kind: 'solid'; color: string } | { kind: 'gradient'; top: string; bottom: string };

/** An outline drawn outside the glyph edge; `width` is the visible thickness in image pixels. */
export interface Outline {
  color: string;
  width: number;
}

export interface Shadow {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fill: FillStyle;
  /** Inner outline, next to the glyph. */
  stroke: Outline | null;
  /** Second outline outside `stroke`, for the double-outline look of logos. */
  outline: Outline | null;
  shadow: Shadow | null;
  /** Extra space between characters, in image pixels. */
  letterSpacing: number;
  /** Line (or, in vertical text, column) distance as a multiple of the font size. */
  lineHeight: number;
  align: 'left' | 'center' | 'right';
  /** Vertical writing: characters run top to bottom, columns right to left. */
  vertical: boolean;
}

interface LayerBase {
  id: string;
  /** Centre of the layer in image pixels. */
  x: number;
  y: number;
  /** Degrees, clockwise. */
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
}

export interface TextLayer extends LayerBase {
  type: 'text';
  text: string;
  style: TextStyle;
  /** Arc of a horizontal text line: -100 (smile) to 100 (arch); 0 is straight. */
  bend: number;
}

export const BUBBLE_SHAPES = ['round', 'box', 'cloud', 'burst', 'whisper', 'narration'] as const;
export type BubbleShape = (typeof BUBBLE_SHAPES)[number];

export interface BubbleTail {
  enabled: boolean;
  /** Where the tail points, relative to the bubble centre, in image pixels. */
  x: number;
  y: number;
  /** -1..1 bends the tail sideways. */
  curve: number;
  /** Width of the tail at the bubble, in image pixels. */
  width: number;
}

export interface BubbleLayer extends LayerBase {
  type: 'bubble';
  shape: BubbleShape;
  width: number;
  height: number;
  text: string;
  style: TextStyle;
  /** Shrinks the text until it fits inside the bubble. */
  autoFit: boolean;
  fill: string;
  border: Outline;
  tail: BubbleTail;
  /** Drives the jagged spikes of a burst. */
  seed: number;
}

export type Layer = TextLayer | BubbleLayer;

export type Background = { kind: 'image'; imageName: string } | { kind: 'color'; color: string | null };

export interface Scene {
  width: number;
  height: number;
  background: Background;
  layers: Layer[];
}

export const SCENE_LIMITS = { size: { min: 64, max: 4096 } };

export const EMPTY_SCENE: Scene = { width: 1024, height: 1024, background: { kind: 'color', color: null }, layers: [] };

let counter = 0;
export function newLayerId(): string {
  counter += 1;
  return `l${Date.now().toString(36)}${counter.toString(36)}`;
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Noto Sans JP Variable',
  fontSize: 96,
  fontWeight: 700,
  fill: { kind: 'solid', color: '#ffffff' },
  stroke: { color: '#111111', width: 6 },
  outline: null,
  shadow: null,
  letterSpacing: 0,
  lineHeight: 1.2,
  align: 'center',
  vertical: false,
};

/** Style of the text inside a bubble: black on the white bubble, no decoration. */
const BUBBLE_TEXT_STYLE: TextStyle = {
  ...DEFAULT_TEXT_STYLE,
  fontFamily: 'Zen Maru Gothic',
  fontSize: 44,
  fontWeight: 700,
  fill: { kind: 'solid', color: '#111111' },
  stroke: null,
  lineHeight: 1.25,
  vertical: true,
};

export function newTextLayer(scene: Pick<Scene, 'width' | 'height'>, text: string): TextLayer {
  const fontSize = Math.round(Math.min(scene.width, scene.height) / 9);
  return {
    id: newLayerId(),
    type: 'text',
    x: scene.width / 2,
    y: scene.height / 2,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    text,
    style: { ...DEFAULT_TEXT_STYLE, fontSize, stroke: { color: '#111111', width: Math.max(2, Math.round(fontSize / 14)) } },
    bend: 0,
  };
}

export function newBubbleLayer(scene: Pick<Scene, 'width' | 'height'>, shape: BubbleShape, text: string): BubbleLayer {
  const base = Math.min(scene.width, scene.height);
  const width = Math.round(base * (shape === 'narration' ? 0.5 : 0.34));
  const height = Math.round(base * (shape === 'narration' ? 0.22 : 0.42));
  const fontSize = Math.max(16, Math.round(base / 24));
  return {
    id: newLayerId(),
    type: 'bubble',
    x: scene.width / 2,
    y: scene.height / 2,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    shape,
    width,
    height,
    text,
    style: { ...BUBBLE_TEXT_STYLE, fontSize, vertical: shape !== 'narration' },
    autoFit: true,
    fill: '#ffffff',
    border: { color: '#111111', width: Math.max(2, Math.round(base / 300)) },
    tail: {
      enabled: shape === 'round' || shape === 'box' || shape === 'burst',
      x: Math.round(-width * 0.2),
      y: Math.round(height * 0.75),
      curve: 0.25,
      width: Math.round(width * 0.2),
    },
    seed: 7,
  };
}

/** Looks for logos: each replaces the whole style of a text layer. */
export const LOGO_PRESETS = ['plain', 'pop', 'sfx', 'gold', 'sticker', 'soft'] as const;
export type LogoPreset = (typeof LOGO_PRESETS)[number];

export function presetStyle(preset: LogoPreset, base: TextStyle): TextStyle {
  const size = base.fontSize;
  const px = (k: number) => Math.max(1, Math.round((size * k) / 100));
  const common = { ...base, shadow: null, outline: null, letterSpacing: base.letterSpacing };
  switch (preset) {
    case 'plain':
      return { ...common, fill: { kind: 'solid', color: '#ffffff' }, stroke: null };
    case 'pop':
      return {
        ...common,
        fontFamily: 'Dela Gothic One',
        fontWeight: 400,
        fill: { kind: 'solid', color: '#ffd23f' },
        stroke: { color: '#2b2b6b', width: px(8) },
        outline: { color: '#ffffff', width: px(6) },
        shadow: { color: 'rgba(0,0,0,0.45)', blur: px(6), offsetX: px(6), offsetY: px(8) },
      };
    case 'sfx':
      return {
        ...common,
        fontFamily: 'Reggae One',
        fontWeight: 400,
        fill: { kind: 'solid', color: '#e5252a' },
        stroke: { color: '#ffffff', width: px(8) },
        outline: { color: '#111111', width: px(5) },
      };
    case 'gold':
      return {
        ...common,
        fontFamily: 'Shippori Mincho',
        fontWeight: 800,
        fill: { kind: 'gradient', top: '#fff3b0', bottom: '#c88a14' },
        stroke: { color: '#5a3a05', width: px(4) },
        shadow: { color: 'rgba(0,0,0,0.5)', blur: px(4), offsetX: 0, offsetY: px(5) },
      };
    case 'sticker':
      return {
        ...common,
        fontFamily: 'Zen Maru Gothic',
        fontWeight: 900,
        fill: { kind: 'solid', color: '#ff5d8f' },
        stroke: { color: '#ffffff', width: px(10) },
        shadow: { color: 'rgba(0,0,0,0.35)', blur: px(8), offsetX: 0, offsetY: px(4) },
      };
    case 'soft':
      return {
        ...common,
        fontFamily: 'Hachi Maru Pop',
        fontWeight: 400,
        fill: { kind: 'solid', color: '#fffaf0' },
        stroke: { color: '#7a4b2a', width: px(6) },
      };
  }
}
