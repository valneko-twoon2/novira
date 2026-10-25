// Panel shapes: the panels of a page as polygons, for a page whose panels the user has reshaped. A polygon is a list of
// corners in fractions of the page (x of its width, y of its height). The panels of a page tile it: a corner that two
// panels share is one point, moved for both, and a corner that lies on another panel's edge is a corner of that panel
// too (see stitch), so moving a corner never opens a gap or an overlap. Every change here returns null when the result
// would not be a valid page.
import type { ComicPoint } from './document';
import type { Box } from './layout';

export type Shape = ComicPoint[];

/** The fewest and the most corners a panel has. */
export const MIN_SHAPE_CORNERS = 3;
export const MAX_SHAPE_CORNERS = 12;
/** The smallest panel, as a share of the page (a panel smaller than this cannot be cut out). */
export const MIN_SHAPE_AREA = 0.003;
/** Two points closer than this are the same point. */
const EPS = 1e-6;

/** Whether two points are the same point. */
export const samePoint = (a: ComicPoint, b: ComicPoint) => Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
const cross = (u: ComicPoint, v: ComicPoint) => u.x * v.y - u.y * v.x;
const sub = (a: ComicPoint, b: ComicPoint): ComicPoint => ({ x: a.x - b.x, y: a.y - b.y });

/** The area of a polygon, by the shoelace formula (always positive). */
export function shapeArea(shape: Shape): number {
  let twice = 0;
  for (let i = 0; i < shape.length; i++) twice += cross(shape[i]!, shape[(i + 1) % shape.length]!);
  return Math.abs(twice) / 2;
}

/** The rectangle a polygon fits in, as fractions of the page. */
export function shapeBox(shape: Shape): Box {
  const xs = shape.map((p) => p.x);
  const ys = shape.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Whether a point lies inside a polygon (ray casting). Points on the edge may go either way. */
export function pointInShape(shape: Shape, p: ComicPoint): boolean {
  let inside = false;
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const a = shape[i]!;
    const b = shape[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const orient = (a: ComicPoint, b: ComicPoint, c: ComicPoint) => cross(sub(b, a), sub(c, a));

/** Whether c lies on the segment ab (it is assumed to be on the line through a and b). */
const within = (a: ComicPoint, b: ComicPoint, c: ComicPoint) =>
  Math.min(a.x, b.x) - EPS <= c.x && c.x <= Math.max(a.x, b.x) + EPS && Math.min(a.y, b.y) - EPS <= c.y && c.y <= Math.max(a.y, b.y) + EPS;

/** Whether the segments ab and cd meet, touching included. */
function segmentsMeet(a: ComicPoint, b: ComicPoint, c: ComicPoint, d: ComicPoint): boolean {
  const d1 = orient(c, d, a);
  const d2 = orient(c, d, b);
  const d3 = orient(a, b, c);
  const d4 = orient(a, b, d);
  if (d1 * d2 < -EPS * EPS && d3 * d4 < -EPS * EPS) return true;
  if (Math.abs(d1) < EPS && within(c, d, a)) return true;
  if (Math.abs(d2) < EPS && within(c, d, b)) return true;
  if (Math.abs(d3) < EPS && within(a, b, c)) return true;
  if (Math.abs(d4) < EPS && within(a, b, d)) return true;
  return false;
}

/** Whether a polygon's edges do not cross or touch each other, and no edge has no length. */
export function isSimple(shape: Shape): boolean {
  const n = shape.length;
  for (let i = 0; i < n; i++) {
    const a = shape[i]!;
    const b = shape[(i + 1) % n]!;
    if (samePoint(a, b)) return false;
    for (let j = i + 2; j < n; j++) {
      // The last edge and the first are neighbours, so they are not compared.
      if (i === 0 && j === n - 1) continue;
      if (segmentsMeet(a, b, shape[j]!, shape[(j + 1) % n]!)) return false;
    }
  }
  return true;
}

/** Whether a panel's shape may stand: enough corners, not crossing itself, and not too small. */
export function isValidShape(shape: Shape): boolean {
  return shape.length >= MIN_SHAPE_CORNERS && shape.length <= MAX_SHAPE_CORNERS && isSimple(shape) && shapeArea(shape) >= MIN_SHAPE_AREA;
}

/** The index of the edge of `shape` that p lies on, between its corners; -1 when p is a corner of the shape or on no edge. */
function edgeAt(shape: Shape, p: ComicPoint): number {
  if (shape.some((q) => samePoint(q, p))) return -1;
  for (let k = 0; k < shape.length; k++) {
    const a = shape[k]!;
    const b = shape[(k + 1) % shape.length]!;
    if (within(a, b, p) && Math.abs(orient(a, b, p)) < EPS * Math.hypot(b.x - a.x, b.y - a.y)) return k;
  }
  return -1;
}

/**
 * Whether part of a's outline lies inside b, with the inside of a just beside it. The outline is cut wherever b's outline
 * crosses or touches it, and each piece is tested a hair inside a, so a shared edge (with a on the other side) is not an overlap.
 */
function outlineInside(a: Shape, b: Shape): boolean {
  const twice = a.reduce((total, p, i) => total + cross(p, a[(i + 1) % a.length]!), 0);
  const turn = twice >= 0 ? 1 : -1;
  const nudge = 1e-5;
  for (let i = 0; i < a.length; i++) {
    const p = a[i]!;
    const q = a[(i + 1) % a.length]!;
    const e = sub(q, p);
    const length2 = e.x * e.x + e.y * e.y;
    const length = Math.sqrt(length2);
    const cuts = [0, 1];
    for (const c of b) {
      const t = ((c.x - p.x) * e.x + (c.y - p.y) * e.y) / length2;
      if (t > 0 && t < 1 && Math.abs(orient(p, q, c)) < EPS * length) cuts.push(t);
    }
    for (let j = 0; j < b.length; j++) {
      const r = b[j]!;
      const f = sub(b[(j + 1) % b.length]!, r);
      const denominator = cross(e, f);
      if (Math.abs(denominator) < EPS) continue;
      const t = cross(sub(r, p), f) / denominator;
      const u = cross(sub(r, p), e) / denominator;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
    }
    cuts.sort((x, y) => x - y);
    for (let k = 0; k + 1 < cuts.length; k++) {
      const t0 = cuts[k]!;
      const t1 = cuts[k + 1]!;
      if (t1 - t0 < 1e-9) continue;
      const mid = (t0 + t1) / 2;
      const inward = { x: (-turn * e.y) / length, y: (turn * e.x) / length };
      const at = { x: p.x + e.x * mid + inward.x * nudge, y: p.y + e.y * mid + inward.y * nudge };
      if (pointInShape(b, at)) return true;
    }
  }
  return false;
}

/** Whether two shapes overlap: part of the outline of one lies inside the other. */
export function shapesOverlap(a: Shape, b: Shape): boolean {
  return outlineInside(a, b) || outlineInside(b, a);
}

/** Whether every shape of a page stands, and no two of them overlap. */
export function allValid(shapes: Shape[]): boolean {
  return shapes.every(isValidShape) && shapes.every((s, i) => shapes.slice(i + 1).every((t) => !shapesOverlap(s, t)));
}

/**
 * Makes every corner that lies on another panel's edge a corner of that panel too, so the panels keep sharing their
 * edges point by point. Returns new shapes; the given ones are not changed.
 */
export function stitch(shapes: Shape[]): Shape[] {
  const result = shapes.map((s) => s.map((p) => ({ ...p })));
  // Each pass adds at most one corner, and a pass that adds none ends the work.
  for (let added = true, pass = 0; added && pass < 200; pass++) {
    added = false;
    for (const own of result) {
      for (const other of result) {
        if (other === own || added) continue;
        for (const p of other) {
          const at = edgeAt(own, p);
          if (at < 0) continue;
          own.splice(at + 1, 0, { ...p });
          added = true;
          break;
        }
      }
    }
  }
  return result;
}

/** The point on a polygon's boundary nearest to p, and the index of the edge it lies on (the edge from that corner on). */
export function nearestEdge(shape: Shape, p: ComicPoint): { edge: number; point: ComicPoint } {
  let best = { edge: 0, point: shape[0]!, distance: Infinity };
  for (let i = 0; i < shape.length; i++) {
    const a = shape[i]!;
    const b = shape[(i + 1) % shape.length]!;
    const ab = sub(b, a);
    const length2 = ab.x * ab.x + ab.y * ab.y || 1;
    const t = Math.min(1, Math.max(0, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / length2));
    const point = { x: a.x + ab.x * t, y: a.y + ab.y * t };
    const distance = Math.hypot(point.x - p.x, point.y - p.y);
    if (distance < best.distance) best = { edge: i, point, distance };
  }
  return { edge: best.edge, point: best.point };
}

/**
 * Cuts a panel in two along the straight line through a and b. The line must meet the panel's outline at exactly two
 * places, which may be corners of the panel (a diagonal cut); otherwise, or when a half would be too small or not valid,
 * the cut is refused (null).
 */
export function splitShape(shape: Shape, a: ComicPoint, b: ComicPoint): [Shape, Shape] | null {
  const d = sub(b, a);
  if (Math.hypot(d.x, d.y) < EPS) return null;
  const n = shape.length;
  // Where the line meets the outline: at a corner (listed once), or in the middle of an edge.
  const hits: { point: ComicPoint; corner: number | null; edge: number; t: number }[] = [];
  for (let i = 0; i < n; i++) {
    const p = shape[i]!;
    const e = sub(shape[(i + 1) % n]!, p);
    const denominator = cross(e, d);
    if (Math.abs(denominator) < EPS) continue;
    const t = cross(sub(a, p), d) / denominator;
    if (t < -EPS || t > 1 + EPS) continue;
    if (t <= EPS || t >= 1 - EPS) {
      const corner = t <= EPS ? i : (i + 1) % n;
      if (!hits.some((h) => h.corner === corner)) hits.push({ point: { ...shape[corner]! }, corner, edge: -1, t: 0 });
    } else {
      hits.push({ point: { x: p.x + e.x * t, y: p.y + e.y * t }, corner: null, edge: i, t });
    }
  }
  if (hits.length !== 2) return null;
  const [first, second] = hits as [(typeof hits)[number], (typeof hits)[number]];
  if (samePoint(first.point, second.point)) return null;
  // The outline with the two cut points in it, in order around the panel.
  const ring: { point: ComicPoint; hit: number }[] = [];
  for (let i = 0; i < n; i++) {
    ring.push({ point: { ...shape[i]! }, hit: hits.findIndex((h) => h.corner === i) });
    const onEdge = hits.map((h, k) => ({ h, k })).filter(({ h }) => h.edge === i).sort((x, y) => x.h.t - y.h.t);
    for (const { h, k } of onEdge) ring.push({ point: { ...h.point }, hit: k });
  }
  const at = (k: number) => ring.findIndex((r) => r.hit === k);
  const piece = (from: number, to: number) => {
    const out: ComicPoint[] = [];
    for (let i = from; ; i = (i + 1) % ring.length) {
      out.push({ ...ring[i]!.point });
      if (i === to) break;
    }
    return out;
  };
  const one = piece(at(0), at(1));
  const two = piece(at(1), at(0));
  if (!isValidShape(one) || !isValidShape(two)) return null;
  return [one, two];
}

/**
 * Moves the corner `corner` of panel `panel` to `to`, and every corner that is at the same place (the corners the panels
 * share), so the panels stay together. Null when the move would leave a panel invalid or overlapping another.
 */
export function moveCorner(shapes: Shape[], panel: number, corner: number, to: ComicPoint): Shape[] | null {
  const from = shapes[panel]?.[corner];
  if (!from) return null;
  const moved = shapes.map((s) => s.map((p) => (samePoint(p, from) ? { x: to.x, y: to.y } : { ...p })));
  return allValid(moved) ? stitch(moved) : null;
}

/**
 * Moves the edge that starts at corner `edge` of panel `panel` by `delta` (both of its corners, and the corners the panels
 * share with them), so a border between panels slides as a whole. Null when the move would leave a panel invalid or
 * overlapping another.
 */
export function moveEdge(shapes: Shape[], panel: number, edge: number, delta: ComicPoint): Shape[] | null {
  const shape = shapes[panel];
  const a = shape?.[edge];
  const b = shape?.[(edge + 1) % (shape?.length ?? 1)];
  if (!a || !b || samePoint(a, b)) return null;
  const moved = shapes.map((s) =>
    s.map((p) => (samePoint(p, a) || samePoint(p, b) ? { x: p.x + delta.x, y: p.y + delta.y } : { ...p })),
  );
  return allValid(moved) ? stitch(moved) : null;
}

/**
 * The line that cuts a panel in half across its longer side (measured on the paper, so `aspect` is the page's height over
 * its width): through the middle of the box it fits in. The second line is the other way across, to try when the first
 * does not give two valid halves.
 */
export function halvingLines(shape: Shape, aspect: number): [ComicPoint, ComicPoint][] {
  const box = shapeBox(shape);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const across: [ComicPoint, ComicPoint] = [{ x: cx, y: box.y - 1 }, { x: cx, y: box.y + box.height + 1 }];
  const down: [ComicPoint, ComicPoint] = [{ x: box.x - 1, y: cy }, { x: box.x + box.width + 1, y: cy }];
  // A panel wider than it is tall is cut by an upright line, a tall one by a level line.
  return box.width >= box.height * aspect ? [across, down] : [down, across];
}

/** Adds a corner at `point` on the edge that starts at corner `edge` of panel `panel`, on the panels that share the edge too. */
export function insertCorner(shapes: Shape[], panel: number, edge: number, point: ComicPoint): Shape[] | null {
  const shape = shapes[panel];
  if (!shape || shape.length >= MAX_SHAPE_CORNERS) return null;
  const next = shapes.map((s) => s.map((p) => ({ ...p })));
  next[panel]!.splice(edge + 1, 0, { ...point });
  const stitched = stitch(next);
  return allValid(stitched) ? stitched : null;
}

/**
 * Removes corner `corner` of panel `panel`, and the same corner of the panels that share it. Only a straight corner goes:
 * a bent one is part of the outline the panels share, and removing it would open a gap or an overlap. Null otherwise.
 */
export function removeCorner(shapes: Shape[], panel: number, corner: number): Shape[] | null {
  const from = shapes[panel]?.[corner];
  if (!from) return null;
  for (const s of shapes) {
    const i = s.findIndex((p) => samePoint(p, from));
    if (i < 0) continue;
    const before = s[(i - 1 + s.length) % s.length]!;
    const after = s[(i + 1) % s.length]!;
    if (Math.abs(cross(sub(from, before), sub(after, from))) > EPS) return null;
  }
  const next = shapes.map((s) => s.filter((p) => !samePoint(p, from)).map((p) => ({ ...p })));
  return allValid(next) ? stitch(next) : null;
}

/** Twice the signed area of a polygon: positive when its corners run one way round, negative the other way. */
const signedTwice = (shape: Shape) => shape.reduce((sum, p, i) => sum + cross(p, shape[(i + 1) % shape.length]!), 0);

/**
 * The one panel made of two panels that share a border: their outlines with the shared edges taken out. Null when they
 * share no edge, meet in more than one stretch (the join would hold a hole), or the joined outline is not a valid panel.
 */
export function mergeShapes(a: Shape, b: Shape): Shape | null {
  const around = (shape: Shape) => (signedTwice(shape) < 0 ? [...shape].reverse() : shape);
  const first = around(a);
  const second = around(b);
  const edges = (shape: Shape) => shape.map((p, i) => ({ from: p, to: shape[(i + 1) % shape.length]! }));
  const mine = edges(first);
  const theirs = edges(second);
  // An edge both panels hold, one in each direction, is the border between them.
  const shared = (e: { from: ComicPoint; to: ComicPoint }, list: typeof theirs) => list.some((o) => samePoint(o.from, e.to) && samePoint(o.to, e.from));
  const kept = [...mine.filter((e) => !shared(e, theirs)), ...theirs.filter((e) => !shared(e, mine))];
  if (kept.length === mine.length + theirs.length || kept.length === 0) return null;
  const loop: ComicPoint[] = [];
  const left = [...kept];
  let at = left.shift()!;
  loop.push(at.from);
  while (!samePoint(at.to, loop[0]!)) {
    const i = left.findIndex((e) => samePoint(e.from, at.to));
    if (i < 0) return null;
    loop.push(left[i]!.from);
    at = left.splice(i, 1)[0]!;
  }
  // Edges left over belong to a second loop: the panels met in two places, or the join has a hole.
  if (left.length > 0) return null;
  const straight = loop.filter((p, i) => {
    const before = loop[(i - 1 + loop.length) % loop.length]!;
    const after = loop[(i + 1) % loop.length]!;
    return Math.abs(cross(sub(p, before), sub(after, p))) > EPS;
  });
  return isValidShape(straight) ? straight.map((p) => ({ ...p })) : null;
}

/** The shapes flipped left to right, for a page that is read from the other side. */
export function mirrorShapes(shapes: Shape[]): Shape[] {
  return shapes.map((s) => s.map((p) => ({ x: 1 - p.x, y: p.y })));
}
