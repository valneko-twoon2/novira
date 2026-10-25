// The outline of a balloon, in the balloon's own box (0 to 1 both ways; spikes, the tail, the trail of a thought and the
// rays of a flash may reach outside it). Every part is a polygon fine enough to look smooth, so the screen (an SVG path) and
// the saved page (a canvas) draw the very same lines at any size.
//
// A shape is a base outline (an ellipse, a box, a many-sided box, a heart, or the points the user drew) with the shape's
// decoration laid along it: bumps, spikes, waves, hairs, icicles or rays. The line then wavers a little, as a pen's does
// (the balloon's roughness); the wavering follows the balloon's id, so it stays put while the balloon is moved or edited.
import { BUBBLE_KIND_DEFAULTS, BUBBLE_SCALE_RANGE, LETTERING_KINDS, type BubbleKind, type BubbleOutline, type ComicBubble, type ComicPoint } from './document';

export type Poly = ComicPoint[];

export interface BalloonShape {
  /** The body: one closed outline, filled and lined. Null for lettering with no balloon. */
  body: Poly | null;
  /** The tail (a wedge, the dots of a thought, or a lightning bolt), each part closed, filled and lined with the body. */
  tail: Poly[];
  /** Ink that is filled and never lined: the rays of a flash. */
  ink: Poly[];
}

/** What a balloon's outline is drawn from. */
export type BalloonLook = Pick<ComicBubble, 'kind' | 'tail' | 'spikes' | 'depth' | 'rough' | 'tailWidth' | 'tailCurve' | 'outline'>;

/** The base outline each shape's decoration is laid along. */
type Base = 'ellipse' | 'rounded' | 'rect' | 'polygon' | 'heart';
const BASE: Record<BubbleKind, Base> = {
  speech: 'ellipse',
  rounded: 'rounded',
  box: 'rect',
  thought: 'ellipse',
  shout: 'ellipse',
  explosion: 'ellipse',
  wavy: 'ellipse',
  fuzzy: 'ellipse',
  electric: 'polygon',
  icicle: 'ellipse',
  heart: 'heart',
  flash: 'ellipse',
  caption: 'rect',
  sfx: 'ellipse',
  plain: 'ellipse',
  stamp: 'rect',
};

/**
 * The outline is this many times the box of the words, centred on it, so the words stay inside it: the corners of the words'
 * box lie on an ellipse of √2 times its size, while a box needs only a little room round the words.
 */
const OUTLINE_SCALE: Record<Base, number> = { ellipse: Math.SQRT2, rounded: 1.2, rect: 1.12, polygon: 1.3, heart: 1.75 };
export const outlineScale = (kind: BubbleKind) => OUTLINE_SCALE[BASE[kind]];

/** The outline's box for the words' box, stretched by the balloon's width and height (the page's picture and the screen use it). */
export function balloonOutline(box: { x: number; y: number; width: number; height: number }, look: Pick<ComicBubble, 'kind' | 'width' | 'height'>) {
  const sx = outlineScale(look.kind) * look.width;
  const sy = outlineScale(look.kind) * look.height;
  return {
    x: box.x - (box.width * (sx - 1)) / 2,
    y: box.y - (box.height * (sy - 1)) / 2,
    width: box.width * sx,
    height: box.height * sy,
  };
}

const TAU = Math.PI * 2;
/** A tip closer to the centre than this has no direction, so it draws no tail. */
const MIN_TAIL = 0.05;
/** How far apart the points of a line may be before one is put between them (so a wavering line bends smoothly). */
const STEP = 0.025;

/** A small random number generator, the same for the same seed. */
function random(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** A number from a balloon's id, so its wavering and its uneven spikes are its own and stay the same. */
export function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

const ellipseAt = (a: number, r = 1): ComicPoint => ({ x: 0.5 + 0.5 * r * Math.cos(a), y: 0.5 + 0.5 * r * Math.sin(a) });

/** A closed smooth curve through the points (Catmull-Rom), as a polygon with `per` points between each two of them. */
export function smoothClosed(points: Poly, per = 10): Poly {
  const n = points.length;
  const out: Poly = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]!;
    const p1 = points[i]!;
    const p2 = points[(i + 1) % n]!;
    const p3 = points[(i + 2) % n]!;
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const at = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: at(p0.x, p1.x, p2.x, p3.x), y: at(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  return out;
}

/** The polygon with points put between any two that are farther apart than `step`. */
function densify(poly: Poly, step = STEP, closed = true): Poly {
  const out: Poly = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    out.push(a);
    if (!closed && i === n - 1) break;
    const b = poly[(i + 1) % n]!;
    const parts = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step);
    for (let k = 1; k < parts; k++) out.push({ x: a.x + ((b.x - a.x) * k) / parts, y: a.y + ((b.y - a.y) * k) / parts });
  }
  return out;
}

/** A box with rounded corners (radius as a share of the box), going clockwise from the top. */
function roundedRect(radius: number): Poly {
  const r = radius;
  const corners: [number, number, number][] = [
    [1 - r, r, -Math.PI / 2],
    [1 - r, 1 - r, 0],
    [r, 1 - r, Math.PI / 2],
    [r, r, Math.PI],
  ];
  const out: Poly = [];
  for (const [cx, cy, from] of corners) {
    for (let k = 0; k <= 8; k++) {
      const a = from + (k / 8) * (Math.PI / 2);
      out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  }
  return out;
}

/** A heart filling the box: two round lobes at the top, a point at the bottom. */
function heart(): Poly {
  const raw: Poly = [];
  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * TAU;
    raw.push({ x: 16 * Math.sin(t) ** 3, y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) });
  }
  // The curve runs from -16 to 16 across and about -12 to 17 down; it is fitted to the box.
  return raw.map((p) => ({ x: 0.5 + p.x / 32, y: (p.y + 12) / 29 }));
}

/** The shape's own base outline, as the points a hand-drawn outline starts from, and whether they are joined smoothly. */
export function baseOutline(look: Pick<ComicBubble, 'kind' | 'spikes'>): BubbleOutline {
  switch (BASE[look.kind]) {
    case 'rect':
      return { points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], smooth: false };
    case 'rounded':
      return { points: roundedRect(0.28).filter((_, i) => i % 3 === 1), smooth: true };
    case 'polygon': {
      // The sides' middles touch the ellipse, so the words fit as they do in an ellipse.
      const sides = Math.min(16, Math.max(3, Math.round(look.spikes)));
      const r = 1 / Math.cos(Math.PI / sides);
      return { points: Array.from({ length: sides }, (_, i) => ellipseAt(-Math.PI / 2 + Math.PI / sides + (i / sides) * TAU, r)), smooth: false };
    }
    case 'heart':
      return { points: heart().filter((_, i) => i % 6 === 0), smooth: true };
    case 'ellipse':
    default:
      return { points: Array.from({ length: 12 }, (_, i) => ellipseAt(-Math.PI / 2 + (i / 12) * TAU)), smooth: true };
  }
}

/** The base as a fine polygon: the shape's own, or the outline the user drew. */
function basePolygon(look: BalloonLook): Poly {
  if (look.outline) return densify(look.outline.smooth ? smoothClosed(look.outline.points) : look.outline.points);
  switch (BASE[look.kind]) {
    case 'ellipse':
      return Array.from({ length: 144 }, (_, i) => ellipseAt(-Math.PI / 2 + (i / 144) * TAU));
    case 'rounded':
      return densify(roundedRect(0.28));
    case 'heart':
      return densify(heart());
    case 'rect':
    case 'polygon':
    default:
      return densify(baseOutline(look).points);
  }
}

/** A closed polygon measured along its length: where a share of the way round is, and which way is out from there. */
function walker(poly: Poly) {
  const n = poly.length;
  const lengths = [0];
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    lengths.push(lengths[i]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = lengths[n]! || 1;
  // Which way round the polygon runs, so "out" is the same side for every shape.
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    area += a.x * b.y - b.x * a.y;
  }
  const turn = area >= 0 ? 1 : -1;
  return (share: number) => {
    const at = (((share % 1) + 1) % 1) * total;
    let i = 0;
    while (i < n - 1 && lengths[i + 1]! < at) i++;
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    const seg = lengths[i + 1]! - lengths[i]! || 1;
    const t = (at - lengths[i]!) / seg;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    // Outward is to the left of the way along for a polygon turning clockwise on screen (y runs down).
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, nx: (turn * (b.y - a.y)) / len, ny: (-turn * (b.x - a.x)) / len };
  };
}

/** The body: the base with the shape's decoration laid along it (the sizes are shares of the box). */
function decoratedBody(look: BalloonLook, base: Poly, rand: () => number): Poly {
  const along = walker(base);
  const n = Math.round(look.spikes);
  const d = look.depth * 0.5;
  const at = (share: number, out: number) => {
    const p = along(share);
    return { x: p.x + p.nx * out, y: p.y + p.ny * out };
  };
  switch (look.kind) {
    case 'thought': {
      // Round bumps that meet in sharp dips, as a cloud's.
      const steps = Math.max(n * 12, 96);
      return Array.from({ length: steps }, (_, i) => at(i / steps, d * (Math.sqrt(Math.abs(Math.sin((i / steps) * n * Math.PI))) - 0.3)));
    }
    case 'wavy': {
      const steps = Math.max(n * 12, 96);
      return Array.from({ length: steps }, (_, i) => at(i / steps, d * Math.sin((i / steps) * n * TAU)));
    }
    case 'shout':
    case 'explosion':
    case 'fuzzy': {
      // Tips and dips in turn; an explosion's are uneven, a shout's a little, the hairs of a fuzzy one a little more.
      const uneven = look.kind === 'explosion' ? 0.7 : look.kind === 'fuzzy' ? 0.5 : 0.25;
      const out: Poly = [];
      for (let i = 0; i < n; i++) {
        const jitter = (rand() - 0.5) * uneven * 0.6;
        out.push(at((i + jitter * 0.5) / n, -d * 0.3 * (1 - uneven * rand() * 0.5)));
        out.push(at((i + 0.5 + jitter) / n, d * (1 - uneven * rand())));
      }
      return out;
    }
    case 'icicle': {
      // Icicles hang straight down from the part of the outline that faces down.
      const steps = Math.max(n * 16, 144);
      const out: Poly = [];
      for (let i = 0; i < steps; i++) {
        const p = along(i / steps);
        out.push({ x: p.x, y: p.y });
      }
      const lower = out.map((p, i) => ({ p, i, down: along(i / steps).ny })).filter((q) => q.down > 0.35);
      if (lower.length < 2) return out;
      const first = lower[0]!.i;
      const last = lower[lower.length - 1]!.i;
      const span = last - first;
      const result: Poly = [];
      for (let i = 0; i < steps; i++) {
        if (i < first || i > last) {
          result.push(out[i]!);
          continue;
        }
        // Within the lower part, every icicle is a narrow point between two places on the outline.
        const k = ((i - first) / span) * n;
        const local = k - Math.floor(k);
        const length = d * 1.2 * (0.6 + 0.4 * Math.abs(Math.sin(Math.floor(k) * 7.3)));
        const drop = local < 0.5 ? local * 2 : (1 - local) * 2;
        result.push({ x: out[i]!.x, y: out[i]!.y + length * drop ** 1.6 });
      }
      return result;
    }
    // These keep the base as it is here (flash and electric get their ink further down).
    case 'plain':
    case 'speech':
    case 'rounded':
    case 'box':
    case 'caption':
    case 'heart':
    case 'electric':
    case 'flash':
    case 'sfx':
    case 'stamp':
    default:
      return base;
  }
}

/** The rays of a flash: thin ink wedges round the base, wide at their outer end and sharp at the inner. */
function rays(look: BalloonLook, base: Poly, rand: () => number): Poly[] {
  const along = walker(base);
  const n = Math.round(look.spikes);
  const out: Poly[] = [];
  for (let i = 0; i < n; i++) {
    const p = along((i + (rand() - 0.5) * 0.6) / n);
    const inner = 0.04;
    const outer = inner + look.depth * 0.5 * (0.45 + 0.55 * rand());
    const half = 0.006 + 0.008 * rand();
    const ox = p.x + p.nx * outer;
    const oy = p.y + p.ny * outer;
    out.push([
      { x: p.x + p.nx * inner, y: p.y + p.ny * inner },
      { x: ox - p.ny * half, y: oy + p.nx * half },
      { x: ox + p.ny * half, y: oy - p.nx * half },
    ]);
  }
  return out;
}

/** A point on a curved line from `a` to `b` that bulges sideways by `bend` (a share of its length) in its middle. */
function bent(a: ComicPoint, b: ComicPoint, bend: number, t: number): ComicPoint {
  const mx = (a.x + b.x) / 2 - (b.y - a.y) * bend;
  const my = (a.y + b.y) / 2 + (b.x - a.x) * bend;
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * mx + t * t * b.x, y: u * u * a.y + 2 * u * t * my + t * t * b.y };
}

/** The tail: a wedge from inside the balloon to the tip, the dots of a thought, or a lightning bolt. */
function tailParts(look: BalloonLook): Poly[] {
  const kind = BUBBLE_KIND_DEFAULTS[look.kind].tail ? look.kind : null;
  const tip = look.tail;
  if (!kind || !tip) return [];
  const centre = { x: 0.5, y: 0.5 };
  const dx = tip.x - centre.x;
  const dy = tip.y - centre.y;
  const length = Math.hypot(dx, dy);
  if (length < MIN_TAIL) return [];
  const ux = dx / length;
  const uy = dy / length;
  const width = look.tailWidth;
  const bend = look.tailCurve * 0.35;
  if (kind === 'thought') {
    // Three dots, smaller towards the tip, from the edge of the balloon on.
    const edge = { x: centre.x + ux * 0.5, y: centre.y + uy * 0.5 };
    return [0.22, 0.55, 0.88].map((t, i) => {
      const c = bent(edge, tip, bend, t);
      const r = [0.07, 0.05, 0.034][i]! * width;
      return Array.from({ length: 20 }, (_, k) => ({ x: c.x + r * Math.cos((k / 20) * TAU), y: c.y + r * Math.sin((k / 20) * TAU) }));
    });
  }
  const base = { x: centre.x + ux * 0.25, y: centre.y + uy * 0.25 };
  const half = 0.1 * width;
  const px = -uy * half;
  const py = ux * half;
  if (kind === 'electric') {
    // A bolt: a line that zigzags to the tip, thick at the balloon and thin at the tip.
    const steps = 5;
    const left: Poly = [];
    const right: Poly = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const c = bent(base, tip, bend, t);
      const side = i === 0 || i === steps ? 0 : (i % 2 ? 1 : -1) * 0.07 * width;
      const w = half * 0.8 * (1 - t);
      left.push({ x: c.x - uy * side + px * (w / half), y: c.y + ux * side + py * (w / half) });
      right.push({ x: c.x - uy * side - px * (w / half), y: c.y + ux * side - py * (w / half) });
    }
    return [[...left, ...right.slice(0, -1).reverse()]];
  }
  // A wedge whose two sides bend the same way, so the tail curves.
  const a = { x: base.x + px, y: base.y + py };
  const b = { x: base.x - px, y: base.y - py };
  const sideA = Array.from({ length: 13 }, (_, i) => bent(a, tip, bend, i / 12));
  const sideB = Array.from({ length: 12 }, (_, i) => bent(b, tip, bend, (11 - i) / 12));
  return [[...sideA, ...sideB]];
}

/** The line moved in and out a little along its length, as a hand-drawn line wavers (closed, so it meets itself). */
function waver(poly: Poly, amount: number, rand: () => number): Poly {
  if (amount <= 0 || poly.length < 3) return poly;
  const fine = densify(poly);
  const n = fine.length;
  const waves = [2, 5, 11, 23].map((f, i) => ({ f, phase: rand() * TAU, size: [0.55, 0.3, 0.12, 0.06][i]! }));
  return fine.map((p, i) => {
    const a = fine[(i - 1 + n) % n]!;
    const b = fine[(i + 1) % n]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const s = i / n;
    const off = amount * 0.03 * waves.reduce((sum, w) => sum + w.size * Math.sin(s * w.f * TAU + w.phase), 0);
    return { x: p.x + ((b.y - a.y) / len) * off, y: p.y - ((b.x - a.x) / len) * off };
  });
}

/** The outline of a balloon of this look, wavering as its seed says. */
export function balloonShape(look: BalloonLook, seed = 1): BalloonShape {
  if (LETTERING_KINDS.includes(look.kind)) return { body: null, tail: [], ink: [] };
  const rand = random(seed);
  const base = basePolygon(look);
  const body = waver(decoratedBody(look, base, rand), look.rough, rand);
  // The dots of a thought are too small to waver; a wedge or a bolt wavers less than the body, as a short stroke does.
  const tail = tailParts(look).map((p) => (look.kind === 'thought' ? p : waver(p, look.rough * 0.5, rand)));
  const ink = look.kind === 'flash' ? rays(look, base, rand) : [];
  return { body, tail, ink };
}

/** Polygons as SVG path data, closed. */
export function polyPath(polys: Poly[]): string {
  return polys
    .filter((p) => p.length > 1)
    .map((p) => `M${p.map((q) => `${q.x.toFixed(4)} ${q.y.toFixed(4)}`).join('L')}Z`)
    .join('');
}

/** The balloon text's size as a share of its panel's width, at the default size (the page's picture and the editor use it). */
export const BUBBLE_TEXT_SHARE = 0.045;

/** The largest share of its panel's width or height a fitted balloon takes (see fitStep). */
export const FIT_PANEL_SHARE = 0.95;
/** How much one step of fitting shrinks the words. */
const FIT_SHRINK = 0.9;

/**
 * One step of fitting a balloon to its words and its panel, from what the screen measured: whether the words run out of the
 * balloon, the balloon's box as shares of its panel, and how much larger than the box its outline is (see outlineScale). A
 * balloon whose words run out, or whose outline is too large for its panel, gets smaller words (down to the smallest size);
 * then it is moved so its outline lies inside its panel, and is done.
 */
export function fitStep(
  bubble: Pick<ComicBubble, 'scale' | 'x' | 'y'>,
  measured: { wordsOverflow: boolean; width: number; height: number; outlineX: number; outlineY: number },
): { patch: Partial<Pick<ComicBubble, 'scale' | 'x' | 'y'>>; done: boolean } {
  const { width, height, outlineX, outlineY } = measured;
  const tooBig = measured.wordsOverflow || width * outlineX > FIT_PANEL_SHARE || height * outlineY > FIT_PANEL_SHARE;
  if (tooBig && bubble.scale > BUBBLE_SCALE_RANGE.min) {
    return { patch: { scale: Math.max(BUBBLE_SCALE_RANGE.min, Math.round(bubble.scale * FIT_SHRINK * 100) / 100) }, done: false };
  }
  // The outline reaches past the box by half its extra size on each side; a box too large for that sits in the middle.
  const inside = (at: number, size: number, scale: number) => {
    const reach = (Math.max(1, scale) - 1) / 2 * size;
    const lo = reach;
    const hi = 1 - size - reach;
    return lo > hi ? Math.max(0, (1 - size) / 2) : Math.min(hi, Math.max(lo, at));
  };
  const x = inside(bubble.x, width, outlineX);
  const y = inside(bubble.y, height, outlineY);
  return { patch: { ...(x !== bubble.x ? { x } : {}), ...(y !== bubble.y ? { y } : {}) }, done: true };
}

/**
 * How the line is laid down, in the line's own widths: each stroke is drawn centred on the outline, at this many widths and
 * in this colour, and then the balloon is filled over its inner half. One line is a stroke of two widths; two lines are
 * black, white and black strokes of six, four and two widths, which leave a black, a white and a black band outside.
 */
export function lineStrokes(line: ComicBubble['line']): { widths: number; ink: boolean }[] {
  if (line === 'none') return [];
  if (line === 'double') return [{ widths: 6, ink: true }, { widths: 4, ink: false }, { widths: 2, ink: true }];
  return [{ widths: 2, ink: true }];
}

/** The dash and the gap of a dashed line, in line widths (a line width is a tenth of the text's size). */
export const DASH = [5.5, 4] as const;
