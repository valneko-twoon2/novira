// A manga-like panel layout for a free page, made up the way a manga artist cuts a page rather than as a grid: the page is cut
// into tiers of unequal height, each tier into one to three panels of unequal width (or one tall panel beside a stack of two),
// one panel may dominate, cuts may slant for action, and the dominant panel may run off the page (a bleed). The space between
// tiers is wider than the space between panels side by side, as in printed manga. The same options and seed give the same page.
import type { ComicPoint, ReadingDirection } from './document';
import type { Shape } from './shapes';

/** How the page should feel: calm pages keep square cuts, action pages slant them, dramatic pages give one panel most of it. */
export type MangaMood = 'calm' | 'action' | 'dramatic';
export const MANGA_MOODS: readonly MangaMood[] = ['calm', 'action', 'dramatic'];

/** The most panels a manga layout makes: real pages rarely hold more. */
export const MANGA_MAX_PANELS = 12;

export interface MangaLayoutOptions {
  panelCount: number;
  /** The panel (from 1, in reading order) to make dominant; null lets the layout choose (none for a calm page). */
  focus?: number | null;
  mood?: MangaMood;
  direction?: ReadingDirection;
  /** The page's height over its width. */
  aspect: number;
  seed?: number;
}

/** Space between two tiers, and between two panels side by side, as fractions of the page's width. */
export const TIER_GUTTER = 0.034;
export const PANEL_GUTTER = 0.017;
/** The white margin round the panels, as a fraction of the page's width. */
const SIDE = 0.06;

type Quad = [ComicPoint, ComicPoint, ComicPoint, ComicPoint]; // top-left, top-right, bottom-right, bottom-left

/** A small seeded random generator (mulberry32), so a seed always gives the same page. */
function random(seed: number): () => number {
  let a = Math.floor(seed) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: ComicPoint, b: ComicPoint, f: number): ComicPoint => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
const clamp = (v: number, low: number, high: number) => Math.min(high, Math.max(low, v));

/** Cut points along a length: running sums of the weights, each cut moved by its slant but kept `min` from its neighbours. */
function cuts(weights: number[], slants: number[], min: number): { a: number[]; b: number[] } {
  const total = weights.reduce((s, w) => s + w, 0);
  const at: number[] = [];
  let run = 0;
  for (const w of weights.slice(0, -1)) at.push((run += w / total));
  const side = (sign: number) => {
    const out: number[] = [];
    at.forEach((f, i) => out.push(clamp(f + (sign * slants[i]!) / 2, (out[i - 1] ?? 0) + min, 1 - min * (at.length - i))));
    return out;
  };
  return { a: side(-1), b: side(1) };
}

/** A quad cut across into strips: each cut runs from a point on the left edge to one on the right, with a gap between strips. */
function splitAcross(q: Quad, weights: number[], slants: number[], gap: number): Quad[] {
  const height = Math.max(q[3].y - q[0].y, q[2].y - q[1].y);
  const { a: left, b: right } = cuts(weights, slants, 0.12);
  const half = gap / 2 / height;
  const strips: Quad[] = [];
  for (let i = 0; i <= left.length; i++) {
    const l0 = i === 0 ? 0 : left[i - 1]! + half;
    const r0 = i === 0 ? 0 : right[i - 1]! + half;
    const l1 = i === left.length ? 1 : left[i]! - half;
    const r1 = i === left.length ? 1 : right[i]! - half;
    strips.push([lerp(q[0], q[3], l0), lerp(q[1], q[2], r0), lerp(q[1], q[2], r1), lerp(q[0], q[3], l1)]);
  }
  return strips;
}

/** A quad cut down into cells: each cut runs from a point on the top edge to one on the bottom, with a gap between cells. */
function splitDown(q: Quad, weights: number[], slants: number[], gap: number): Quad[] {
  const width = Math.max(q[1].x - q[0].x, q[2].x - q[3].x);
  const { a: top, b: bottom } = cuts(weights, slants, 0.15);
  const half = gap / 2 / width;
  const cells: Quad[] = [];
  for (let i = 0; i <= top.length; i++) {
    const t0 = i === 0 ? 0 : top[i - 1]! + half;
    const b0 = i === 0 ? 0 : bottom[i - 1]! + half;
    const t1 = i === top.length ? 1 : top[i]! - half;
    const b1 = i === top.length ? 1 : bottom[i]! - half;
    cells.push([lerp(q[0], q[1], t0), lerp(q[0], q[1], t1), lerp(q[3], q[2], b1), lerp(q[3], q[2], b0)]);
  }
  return cells;
}

/** A tier's plan: how many panels it holds, and whether its panels are one tall panel beside a stack. */
interface Tier {
  count: number;
  stack: 'first' | 'last' | null;
}

/** How many tiers a page of n panels has. */
function tierCount(n: number, rnd: () => number): number {
  if (n <= 2) return n;
  if (n <= 4) return rnd() < 0.5 ? 2 : 3;
  if (n <= 6) return 3;
  if (n <= 8) return rnd() < 0.5 ? 3 : 4;
  return Math.min(6, Math.ceil(n / 2.6));
}

/**
 * The tiers of a page: n panels shared out at random, one to three a tier (four when there are many), with the focus panel's
 * tier holding at most two (or a tall panel beside a stack of two). Tries a few draws to meet that.
 */
function planTiers(n: number, focus: number | null, rnd: () => number): Tier[] {
  const cap = n > 9 ? 4 : 3;
  let best: Tier[] = [];
  for (let attempt = 0; attempt < 60; attempt++) {
    const counts = new Array<number>(tierCount(n, rnd)).fill(1);
    for (let left = n - counts.length; left > 0; ) {
      const i = Math.floor(rnd() * counts.length);
      if (counts[i]! < cap) {
        counts[i]!++;
        left--;
      } else if (counts.every((c) => c >= cap)) break;
    }
    if (counts.reduce((s, c) => s + c, 0) !== n) continue;
    // A tier of three may be one tall panel and a stack of two; the tall one comes first or last in the reading order.
    const tiers: Tier[] = counts.map((count) => ({ count, stack: count === 3 && rnd() < 0.35 ? (rnd() < 0.5 ? 'first' : 'last') : null }));
    best = tiers;
    if (focus === null) return tiers;
    const at = tierOf(tiers, focus);
    const tier = tiers[at.tier]!;
    if (tier.count <= 2 || (tier.stack !== null && at.index === (tier.stack === 'first' ? 0 : 2))) return tiers;
  }
  return best;
}

/** The tier a panel (from 0, in reading order) is in, and its place in that tier. */
function tierOf(tiers: Tier[], panel: number): { tier: number; index: number } {
  let run = 0;
  for (let i = 0; i < tiers.length; i++) {
    if (panel < run + tiers[i]!.count) return { tier: i, index: panel - run };
    run += tiers[i]!.count;
  }
  return { tier: tiers.length - 1, index: 0 };
}

const MOOD = {
  calm: { spread: 0.12, focusTier: 1.35, focusCell: 1.5, slantCut: 0, slantTier: 0, bleed: 0 },
  action: { spread: 0.3, focusTier: 1.7, focusCell: 1.9, slantCut: 0.16, slantTier: 0.09, bleed: 0.25 },
  dramatic: { spread: 0.25, focusTier: 2.6, focusCell: 2.4, slantCut: 0.1, slantTier: 0.07, bleed: 0.6 },
} as const;

/**
 * The panels of a manga-like page, in reading order, as free shapes in fractions of the page (0 to 1 across and down). A page
 * read from the right has its first panel at the top right.
 */
export function mangaLayout(options: MangaLayoutOptions): Shape[] {
  const n = clamp(Math.round(options.panelCount), 1, MANGA_MAX_PANELS);
  const mood = MOOD[options.mood ?? 'action'];
  const rnd = random(options.seed ?? 1);
  const pick = (low: number, high: number) => low + (high - low) * rnd();
  const wiggle = () => pick(1 - mood.spread, 1 + mood.spread);
  const given = options.focus !== undefined && options.focus !== null ? clamp(Math.round(options.focus), 1, n) - 1 : null;
  const focus = n === 1 ? null : (given ?? (options.mood === 'calm' ? null : Math.floor(rnd() * n)));
  const tiers = planTiers(n, focus, rnd);
  const at = focus === null ? null : tierOf(tiers, focus);

  // Everything is in page widths here (y runs to the aspect), so the gaps are the same size across and down.
  const h = options.aspect;
  const page: Quad = [
    { x: SIDE, y: SIDE },
    { x: 1 - SIDE, y: SIDE },
    { x: 1 - SIDE, y: h - SIDE },
    { x: SIDE, y: h - SIDE },
  ];
  // A tier of one wide panel or of a stack is taller, and the focus panel's tier much taller.
  const tierWeights = tiers.map((t, i) => wiggle() * (t.stack ? 1.5 : t.count === 1 ? 1.1 : 1) * (at?.tier === i ? mood.focusTier : 1));
  const tierSlants = tiers.slice(1).map(() => (rnd() < 0.6 ? pick(-mood.slantTier, mood.slantTier) : 0));
  const strips = splitAcross(page, tierWeights, tierSlants, TIER_GUTTER);

  const shapes: Quad[] = [];
  tiers.forEach((tier, ti) => {
    const strip = strips[ti]!;
    const focusIndex = at?.tier === ti ? at.index : -1;
    const slant = () => (rnd() < 0.7 ? pick(-mood.slantCut, mood.slantCut) : 0);
    if (tier.stack) {
      // One tall panel beside a stack of two: the tall one is first in the reading order or last.
      const tallFirst = tier.stack === 'first';
      const tallWeight = wiggle() * (focusIndex === (tallFirst ? 0 : 2) ? mood.focusCell : 1.15);
      const [a, b] = splitDown(strip, tallFirst ? [tallWeight, 1] : [1, tallWeight], [slant()], PANEL_GUTTER);
      const stacked = splitAcross(tallFirst ? b! : a!, [wiggle(), wiggle()], [slant() / 2], TIER_GUTTER);
      shapes.push(...(tallFirst ? [a!, ...stacked] : [...stacked, b!]));
      return;
    }
    const weights = Array.from({ length: tier.count }, (_, i) => wiggle() * (i === focusIndex ? mood.focusCell : 1));
    shapes.push(...splitDown(strip, weights, weights.slice(1).map(slant), PANEL_GUTTER));
  });

  // The dominant panel of a dramatic page may run off the paper on the sides it touches the margin (a bleed).
  if (focus !== null && rnd() < mood.bleed) {
    const q = shapes[focus];
    if (q) {
      for (const p of q) {
        if (Math.abs(p.x - SIDE) < 1e-9) p.x = 0;
        if (Math.abs(p.x - (1 - SIDE)) < 1e-9) p.x = 1;
        if (Math.abs(p.y - SIDE) < 1e-9) p.y = 0;
        if (Math.abs(p.y - (h - SIDE)) < 1e-9) p.y = h;
      }
    }
  }

  // The cells were laid out from the left; a page read from the right mirrors them, keeping the reading order.
  const rtl = (options.direction ?? 'rtl') === 'rtl';
  return shapes.map((q) => q.map((p) => ({ x: rtl ? 1 - p.x : p.x, y: p.y / h })));
}
