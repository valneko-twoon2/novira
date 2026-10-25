// Edits to the text editor's scene that the AI assistant asks for. Everything it sends is checked here: unknown
// fonts, malformed colours and out-of-range numbers are dropped or clamped, so a bad answer cannot break the scene.
import {
  BUBBLE_SHAPES,
  LOGO_PRESETS,
  SCENE_LIMITS,
  newBubbleLayer,
  newTextLayer,
  presetStyle,
  type BubbleLayer,
  type BubbleShape,
  type FillStyle,
  type Layer,
  type LogoPreset,
  type Outline,
  type Scene,
  type Shadow,
  type TextStyle,
} from '@/state/text/textModel';
import { parseColor, formatColor } from './color';
import { FONTS, snapWeight } from '@/state/fonts';
import { withDefaultFont } from '@/state/text/textEditor';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined;
}

/** A colour string the editor understands (`#rgb`, `#rrggbb`, `rgb()`, `rgba()`), normalised; undefined for anything else. */
function color(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const text = v.trim();
  if (!/^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(\d+\.?\d*|\.\d+)\s*)?\))$/i.test(text)) return undefined;
  return formatColor(parseColor(text));
}

function fill(v: unknown): FillStyle | undefined {
  if (!isRec(v)) return undefined;
  if (v.kind === 'gradient') {
    const top = color(v.top);
    const bottom = color(v.bottom);
    return top && bottom ? { kind: 'gradient', top, bottom } : undefined;
  }
  const c = color(v.color);
  return c ? { kind: 'solid', color: c } : undefined;
}

function outline(v: unknown): Outline | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  const c = color(v.color);
  const w = num(v.width, 0, 200);
  return c && w !== undefined ? { color: c, width: w } : undefined;
}

function shadow(v: unknown): Shadow | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  const c = color(v.color);
  if (!c) return undefined;
  return { color: c, blur: num(v.blur, 0, 200) ?? 0, offsetX: num(v.offsetX, -400, 400) ?? 0, offsetY: num(v.offsetY, -400, 400) ?? 0 };
}

function fontFamily(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const wanted = v.trim().toLowerCase();
  return FONTS.find((f) => f.family.toLowerCase() === wanted || f.label.toLowerCase() === wanted)?.family;
}

/** The style fields the AI may set, checked; the rest of `base` stays. */
export function sanitizeStyle(raw: unknown, base: TextStyle): TextStyle {
  if (!isRec(raw)) return base;
  const style = { ...base };
  const family = fontFamily(raw.fontFamily);
  if (family) style.fontFamily = family;
  const size = num(raw.fontSize, 4, 1200);
  if (size !== undefined) style.fontSize = Math.round(size);
  const weight = num(raw.fontWeight, 100, 900);
  if (weight !== undefined) style.fontWeight = weight;
  style.fontWeight = snapWeight(style.fontFamily, style.fontWeight);
  const f = fill(raw.fill);
  if (f) style.fill = f;
  const stroke = outline(raw.stroke);
  if (stroke !== undefined) style.stroke = stroke && stroke.width > 0 ? stroke : null;
  const outer = outline(raw.outline);
  if (outer !== undefined) style.outline = outer && outer.width > 0 ? outer : null;
  const sh = shadow(raw.shadow);
  if (sh !== undefined) style.shadow = sh;
  const spacing = num(raw.letterSpacing, -50, 200);
  if (spacing !== undefined) style.letterSpacing = spacing;
  const line = num(raw.lineHeight, 0.5, 3);
  if (line !== undefined) style.lineHeight = line;
  if (raw.align === 'left' || raw.align === 'center' || raw.align === 'right') style.align = raw.align;
  if (typeof raw.vertical === 'boolean') style.vertical = raw.vertical;
  return style;
}

function sanitizeTail(raw: unknown, base: BubbleLayer['tail']): BubbleLayer['tail'] {
  if (!isRec(raw)) return base;
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : base.enabled,
    x: num(raw.x, -8000, 8000) ?? base.x,
    y: num(raw.y, -8000, 8000) ?? base.y,
    curve: num(raw.curve, -1, 1) ?? base.curve,
    width: num(raw.width, 4, 2000) ?? base.width,
  };
}

/** Applies the fields of `raw` that fit the layer's kind. */
function sanitizeLayer<L extends Layer>(layer: L, raw: Rec): L {
  const out = { ...layer } as Layer;
  if (typeof raw.text === 'string') out.text = raw.text.slice(0, 600);
  const x = num(raw.x, -8000, 12000);
  if (x !== undefined) out.x = Math.round(x);
  const y = num(raw.y, -8000, 12000);
  if (y !== undefined) out.y = Math.round(y);
  const rotation = num(raw.rotation, -360, 360);
  if (rotation !== undefined) out.rotation = rotation;
  const opacity = num(raw.opacity, 0, 1);
  if (opacity !== undefined) out.opacity = opacity;
  if (typeof raw.visible === 'boolean') out.visible = raw.visible;
  if (typeof raw.locked === 'boolean') out.locked = raw.locked;
  out.style = sanitizeStyle(raw.style, out.style);
  if (out.type === 'text') {
    const bend = num(raw.bend, -100, 100);
    if (bend !== undefined) out.bend = bend;
  } else {
    if (typeof raw.shape === 'string' && (BUBBLE_SHAPES as readonly string[]).includes(raw.shape)) out.shape = raw.shape as BubbleShape;
    const w = num(raw.width, 40, 4000);
    if (w !== undefined) out.width = Math.round(w);
    const h = num(raw.height, 40, 4000);
    if (h !== undefined) out.height = Math.round(h);
    const fillColor = color(raw.fill);
    if (fillColor) out.fill = fillColor;
    if (isRec(raw.border)) {
      const c = color(raw.border.color);
      const bw = num(raw.border.width, 0, 80);
      out.border = { color: c ?? out.border.color, width: bw ?? out.border.width };
    }
    out.tail = sanitizeTail(raw.tail, out.tail);
    if (typeof raw.autoFit === 'boolean') out.autoFit = raw.autoFit;
    const seed = num(raw.seed, 0, 1_000_000);
    if (seed !== undefined) out.seed = Math.round(seed);
  }
  return out as L;
}

export interface TextOpsResult {
  scene: Scene;
  /** The layer to select afterwards: the last one added or changed. */
  selectedId: string | null;
  /** Operations that took effect. */
  applied: number;
}

/** Applies the operations in order to a copy of the scene. Operations that name a missing layer or are malformed are skipped. */
export function applyTextOps(scene: Scene, ops: unknown[], selectedId: string | null = null): TextOpsResult {
  let current: Scene = { ...scene, layers: [...scene.layers] };
  let selected = selectedId;
  let applied = 0;
  // Layers the AI added get its own ids; later operations may refer to them.
  const alias = new Map<string, string>();
  const resolve = (id: unknown) => (typeof id === 'string' ? (alias.get(id) ?? id) : '');
  const indexOf = (id: string) => current.layers.findIndex((l) => l.id === id);
  const replaceAt = (i: number, layer: Layer) => {
    current = { ...current, layers: current.layers.map((l, k) => (k === i ? layer : l)) };
  };

  for (const op of ops) {
    if (!isRec(op) || typeof op.op !== 'string') continue;
    switch (op.op) {
      case 'add': {
        if (!isRec(op.layer) || current.layers.length >= 60) break;
        const kind = op.layer.type === 'bubble' ? 'bubble' : op.layer.type === 'text' ? 'text' : null;
        if (!kind) break;
        const text = typeof op.layer.text === 'string' ? op.layer.text.slice(0, 600) : '';
        const base = kind === 'bubble' ? newBubbleLayer(current, 'round', text) : withDefaultFont(newTextLayer(current, text));
        const layer = sanitizeLayer(base, op.layer);
        if (typeof op.layer.id === 'string') alias.set(op.layer.id, layer.id);
        current = { ...current, layers: [...current.layers, layer] };
        selected = layer.id;
        applied += 1;
        break;
      }
      case 'update': {
        const id = resolve(op.id);
        const i = indexOf(id);
        if (i < 0 || !isRec(op.set)) break;
        replaceAt(i, sanitizeLayer(current.layers[i]!, op.set));
        selected = id;
        applied += 1;
        break;
      }
      case 'remove': {
        const id = resolve(op.id);
        if (indexOf(id) < 0) break;
        current = { ...current, layers: current.layers.filter((l) => l.id !== id) };
        if (selected === id) selected = null;
        applied += 1;
        break;
      }
      case 'preset': {
        const id = resolve(op.id);
        const i = indexOf(id);
        const layer = current.layers[i];
        if (!layer || layer.type !== 'text' || !(LOGO_PRESETS as readonly string[]).includes(String(op.preset))) break;
        replaceAt(i, { ...layer, style: presetStyle(op.preset as LogoPreset, layer.style) });
        selected = id;
        applied += 1;
        break;
      }
      case 'reorder': {
        const id = resolve(op.id);
        const i = indexOf(id);
        const to = op.order === 'up' ? i + 1 : op.order === 'down' ? i - 1 : op.order === 'top' ? current.layers.length - 1 : op.order === 'bottom' ? 0 : -1;
        if (i < 0 || to < 0 || to >= current.layers.length || to === i) break;
        const layers = [...current.layers];
        const [moved] = layers.splice(i, 1);
        layers.splice(to, 0, moved!);
        current = { ...current, layers };
        applied += 1;
        break;
      }
      case 'background': {
        const { min, max } = SCENE_LIMITS.size;
        const width = num(op.width, min, max);
        const height = num(op.height, min, max);
        let next = current;
        if ('color' in op) {
          const c = op.color === null ? null : color(op.color);
          if (c !== undefined) next = { ...next, background: { kind: 'color', color: c } };
        }
        if (width !== undefined) next = { ...next, width: Math.round(width) };
        if (height !== undefined) next = { ...next, height: Math.round(height) };
        if (next === current) break;
        current = next;
        applied += 1;
        break;
      }
      case 'clear':
        current = { ...current, layers: [] };
        selected = null;
        applied += 1;
        break;
    }
  }
  return { scene: current, selectedId: selected, applied };
}

/** What the assistant is told about the editor: the scene plus the choices it may use. */
export function textContext(scene: Scene, selectedId: string | null): unknown {
  return {
    selectedLayerId: selectedId,
    scene: { width: scene.width, height: scene.height, background: scene.background, layers: scene.layers },
    fonts: FONTS.map((f) => f.family),
    presets: [...LOGO_PRESETS],
    bubbleShapes: [...BUBBLE_SHAPES],
  };
}

