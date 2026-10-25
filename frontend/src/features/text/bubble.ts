// Speech-bubble outlines as plain path commands (the renderer turns them into canvas paths), in layer-local pixels
// around the bubble centre.
import type { BubbleLayer, BubbleShape, BubbleTail } from '@/state/text/textModel';

export type Cmd =
  | readonly ['M', number, number]
  | readonly ['L', number, number]
  | readonly ['Q', number, number, number, number]
  | readonly ['C', number, number, number, number, number, number]
  | readonly ['Z'];

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface BubbleGeometry {
  body: Cmd[];
  /** The pointer, drawn merged with the body; null when there is none. */
  tail: Cmd[] | null;
  /** Small circles that trail from a thought cloud toward its target. */
  circles: Circle[];
  dashed: boolean;
  /** Room for the text inside the bubble. */
  textBox: { width: number; height: number };
}

const KAPPA = 0.5522847498;

function ellipse(rx: number, ry: number): Cmd[] {
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  return [
    ['M', rx, 0],
    ['C', rx, ky, kx, ry, 0, ry],
    ['C', -kx, ry, -rx, ky, -rx, 0],
    ['C', -rx, -ky, -kx, -ry, 0, -ry],
    ['C', kx, -ry, rx, -ky, rx, 0],
    ['Z'],
  ];
}

function roundRect(hw: number, hh: number, radius: number): Cmd[] {
  const r = Math.max(0, Math.min(radius, hw, hh));
  const k = r * KAPPA;
  return [
    ['M', -hw + r, -hh],
    ['L', hw - r, -hh],
    ['C', hw - r + k, -hh, hw, -hh + r - k, hw, -hh + r],
    ['L', hw, hh - r],
    ['C', hw, hh - r + k, hw - r + k, hh, hw - r, hh],
    ['L', -hw + r, hh],
    ['C', -hw + r - k, hh, -hw, hh - r + k, -hw, hh - r],
    ['L', -hw, -hh + r],
    ['C', -hw, -hh + r - k, -hw + r - k, -hh, -hw + r, -hh],
    ['Z'],
  ];
}

/** Deterministic random numbers in [0, 1) from a seed (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A scalloped outline: a ring of bumps, like a thought cloud. */
function cloud(rx: number, ry: number): Cmd[] {
  const bumps = Math.max(8, Math.min(22, Math.round((Math.PI * (rx + ry)) / (Math.min(rx, ry) * 0.62 + 1))));
  const ax = rx * 0.9;
  const ay = ry * 0.9;
  const point = (i: number, scale: number): [number, number] => {
    const a = (2 * Math.PI * i) / bumps;
    return [Math.cos(a) * ax * scale, Math.sin(a) * ay * scale];
  };
  const out: Cmd[] = [['M', ...point(0, 1)]];
  for (let i = 0; i < bumps; i += 1) {
    const [cx, cy] = point(i + 0.5, 1.34);
    const [x, y] = point(i + 1, 1);
    out.push(['Q', cx, cy, x, y]);
  }
  out.push(['Z']);
  return out;
}

/** A jagged outline: alternating long and short spikes, as for shouting. `tip` replaces the spike closest to it. */
function burst(rx: number, ry: number, seed: number, tip: { x: number; y: number } | null): Cmd[] {
  const spikes = 16;
  const rand = seeded(seed);
  const pts: [number, number][] = [];
  for (let k = 0; k < spikes * 2; k += 1) {
    const a = (Math.PI * k) / spikes;
    const outer = k % 2 === 0;
    const r = outer ? 0.86 + rand() * 0.14 : 0.62 + rand() * 0.08;
    pts.push([Math.cos(a) * rx * r, Math.sin(a) * ry * r]);
  }
  if (tip) {
    let best = 0;
    let bestDist = Infinity;
    pts.forEach(([x, y], i) => {
      if (i % 2 !== 0) return;
      const d = Math.hypot(x - tip.x, y - tip.y);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    pts[best] = [tip.x, tip.y];
  }
  return [['M', ...pts[0]!], ...pts.slice(1).map(([x, y]) => ['L', x, y] as const), ['Z']];
}

/** Distance from the centre to the outline of an ellipse or rectangle of half sizes (rx, ry) in direction `angle`. */
export function boundaryRadius(shape: BubbleShape, rx: number, ry: number, angle: number): number {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  if (shape === 'box' || shape === 'narration') {
    return Math.min(Math.abs(c) < 1e-9 ? Infinity : rx / Math.abs(c), Math.abs(s) < 1e-9 ? Infinity : ry / Math.abs(s));
  }
  return 1 / Math.sqrt((c / rx) ** 2 + (s / ry) ** 2);
}

function tailPath(shape: BubbleShape, rx: number, ry: number, tail: BubbleTail): Cmd[] | null {
  const dist = Math.hypot(tail.x, tail.y);
  const phi = Math.atan2(tail.y, tail.x);
  const r0 = boundaryRadius(shape, rx, ry, phi);
  if (dist <= r0 * 0.96) return null;
  const half = Math.min(1.1, Math.atan2(Math.max(2, tail.width) / 2, r0));
  const base = (angle: number): [number, number] => {
    // Slightly inside the outline so the pointer overlaps the body.
    const r = boundaryRadius(shape, rx, ry, angle) * 0.92;
    return [Math.cos(angle) * r, Math.sin(angle) * r];
  };
  const [b1x, b1y] = base(phi - half);
  const [b2x, b2y] = base(phi + half);
  const len = dist - r0;
  const nx = -Math.sin(phi);
  const ny = Math.cos(phi);
  const bend = tail.curve * len * 0.35;
  return [
    ['M', b1x, b1y],
    ['Q', (b1x + tail.x) / 2 + nx * bend, (b1y + tail.y) / 2 + ny * bend, tail.x, tail.y],
    ['Q', (b2x + tail.x) / 2 + nx * bend, (b2y + tail.y) / 2 + ny * bend, b2x, b2y],
    ['Z'],
  ];
}

function thoughtCircles(rx: number, ry: number, tail: BubbleTail): Circle[] {
  const phi = Math.atan2(tail.y, tail.x);
  const r0 = boundaryRadius('round', rx, ry, phi) * 1.02;
  const sx = Math.cos(phi) * r0;
  const sy = Math.sin(phi) * r0;
  const dx = tail.x - sx;
  const dy = tail.y - sy;
  if (Math.hypot(dx, dy) < 6) return [];
  const base = Math.max(3, tail.width * 0.42);
  return [0, 1, 2].map((i) => {
    const t = (i + 0.7) / 3.2;
    return { x: sx + dx * t, y: sy + dy * t, r: base * (1 - i * 0.27) };
  });
}

/** Share of the bubble's width and height that text may use, by shape. */
const TEXT_ROOM: Record<BubbleShape, [number, number]> = {
  round: [0.72, 0.72],
  whisper: [0.72, 0.72],
  cloud: [0.62, 0.62],
  burst: [0.6, 0.6],
  box: [0.88, 0.82],
  narration: [0.92, 0.8],
};

export function bubbleGeometry(layer: Pick<BubbleLayer, 'shape' | 'width' | 'height' | 'tail' | 'seed'>): BubbleGeometry {
  const { shape, width, height, tail, seed } = layer;
  const rx = width / 2;
  const ry = height / 2;
  const [kx, ky] = TEXT_ROOM[shape];
  const textBox = { width: width * kx, height: height * ky };
  const hasTail = tail.enabled && shape !== 'narration';
  switch (shape) {
    case 'box':
      return { body: roundRect(rx, ry, Math.min(rx, ry) * 0.35), tail: hasTail ? tailPath(shape, rx, ry, tail) : null, circles: [], dashed: false, textBox };
    case 'narration':
      return { body: roundRect(rx, ry, 0), tail: null, circles: [], dashed: false, textBox };
    case 'cloud':
      return { body: cloud(rx, ry), tail: null, circles: hasTail ? thoughtCircles(rx, ry, tail) : [], dashed: false, textBox };
    case 'burst':
      return { body: burst(rx, ry, seed, hasTail ? tail : null), tail: null, circles: [], dashed: false, textBox };
    case 'whisper':
      return { body: ellipse(rx, ry), tail: hasTail ? tailPath(shape, rx, ry, tail) : null, circles: [], dashed: true, textBox };
    case 'round':
      return { body: ellipse(rx, ry), tail: hasTail ? tailPath(shape, rx, ry, tail) : null, circles: [], dashed: false, textBox };
  }
}

/** Axis-aligned bounds of the commands' points (control points included), for tests and hit areas. */
export function commandBounds(cmds: Cmd[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of cmds) {
    for (let i = 1; i < c.length; i += 2) {
      const x = c[i] as number;
      const y = c[i + 1] as number;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
}
