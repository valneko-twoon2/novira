// OpenPose body skeletons (the 18 COCO keypoints): drawing, hit testing, dragging, mirroring and turning.
import { POSE_JOINTS, type PoseObject, type Rect } from '@/state/canvas';
import { POSE_COLORS, POSE_LIMBS, poseLimbColor, poseStick } from '@/state/poseSkeleton';

/** A point in the same units as the thing it belongs to (canvas pixels, or fractions of a panel). */
export interface Point {
  x: number;
  y: number;
}

export const J = {
  nose: 0,
  neck: 1,
  rShoulder: 2,
  rElbow: 3,
  rWrist: 4,
  lShoulder: 5,
  lElbow: 6,
  lWrist: 7,
  rHip: 8,
  rKnee: 9,
  rAnkle: 10,
  lHip: 11,
  lKnee: 12,
  lAnkle: 13,
  rEye: 14,
  lEye: 15,
  rEar: 16,
  lEar: 17,
} as const;

/** The joint each joint hangs from; the neck is the root. */
export const POSE_PARENT: readonly number[] = [1, -1, 1, 2, 3, 1, 5, 6, 1, 8, 9, 1, 11, 12, 0, 0, 14, 15];

const CHILDREN: number[][] = POSE_PARENT.map((_, i) => POSE_PARENT.flatMap((p, c) => (p === i ? [c] : [])));

/** The joint and every joint below it. */
export function subtree(joint: number): number[] {
  const out = [joint];
  for (let i = 0; i < out.length; i++) out.push(...(CHILDREN[out[i] as number] ?? []));
  return out;
}

export const pt = (points: readonly number[], i: number): Point => ({ x: points[i * 2] as number, y: points[i * 2 + 1] as number });

/** A standing person facing the viewer, neck at the origin, about one unit tall. Their right side is on the left. */
const STANDING: readonly number[] = [
  0, -0.1, 0, 0, -0.11, 0, -0.14, 0.17, -0.16, 0.32, 0.11, 0, 0.14, 0.17, 0.16, 0.32,
  -0.06, 0.32, -0.065, 0.56, -0.07, 0.8, 0.06, 0.32, 0.065, 0.56, 0.07, 0.8,
  -0.025, -0.12, 0.025, -0.12, -0.06, -0.11, 0.06, -0.11,
];

function boundsOf(points: readonly number[], hidden: readonly number[]): Rect | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < POSE_JOINTS; i++) {
    if (hidden.includes(i)) continue;
    const p = pt(points, i);
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return x0 === Infinity ? null : { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Bounds of the visible joints, without the line width. */
export function jointBounds(o: Pick<PoseObject, 'points' | 'hidden'>): Rect | null {
  return boundsOf(o.points, o.hidden);
}

/** Scales and moves unit-space points so their bounds sit centred in `rect`, as large as fits. */
export function fitPoints(points: readonly number[], hidden: readonly number[], rect: Rect): number[] {
  const b = boundsOf(points, hidden) ?? { x: 0, y: 0, width: 1, height: 1 };
  const k = Math.min(rect.width / Math.max(b.width, 1e-6), rect.height / Math.max(b.height, 1e-6));
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const rx = rect.x + rect.width / 2;
  const ry = rect.y + rect.height / 2;
  return points.map((v, i) => Math.round(((i % 2 === 0 ? (v - cx) * k + rx : (v - cy) * k + ry)) * 10) / 10);
}

/** The line width OpenPose uses for a picture the size of `area`. */
export function poseLineWidth(area: Rect): number {
  return poseStick(area.width, area.height);
}

/** A standing pose centred on `center`, `height` tall. */
export function standingPose(id: string, center: Point, height: number, width: number): PoseObject {
  const rect = { x: center.x - height, y: center.y - height / 2, width: height * 2, height };
  return { kind: 'pose', id, points: fitPoints(STANDING, [], rect), hidden: [], width };
}

// Editing ------------------------------------------------------------------------------------------------------

/** The joint under `p` (layer space), nearest first, within `tolerance`. Hidden joints count when `withHidden`. */
export function hitJoint(o: PoseObject, p: Point, tolerance: number, withHidden = true): number | null {
  let best: number | null = null;
  let bestD = tolerance;
  for (let i = 0; i < POSE_JOINTS; i++) {
    if (!withHidden && o.hidden.includes(i)) continue;
    const q = pt(o.points, i);
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= bestD) {
      best = i;
      bestD = d;
    }
  }
  return best;
}

/**
 * The pose with `joint` dragged to `to`. The neck moves the whole body. Any other joint turns around its parent with
 * everything below it, so bone lengths stay; `free` moves only that joint (to change a length).
 */
export function dragJoint(o: PoseObject, joint: number, to: Point, free: boolean): PoseObject {
  const points = [...o.points];
  const from = pt(o.points, joint);
  const parent = POSE_PARENT[joint] ?? -1;
  if (parent < 0) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return { ...o, points: points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy)) };
  }
  if (free) {
    points[joint * 2] = to.x;
    points[joint * 2 + 1] = to.y;
    return { ...o, points };
  }
  const c = pt(o.points, parent);
  const a = Math.atan2(to.y - c.y, to.x - c.x) - Math.atan2(from.y - c.y, from.x - c.x);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  for (const j of subtree(joint)) {
    const q = pt(o.points, j);
    points[j * 2] = c.x + (q.x - c.x) * cos - (q.y - c.y) * sin;
    points[j * 2 + 1] = c.y + (q.x - c.x) * sin + (q.y - c.y) * cos;
  }
  return { ...o, points };
}

/** Shows a hidden joint, or hides a shown one. */
export function toggleJoint(o: PoseObject, joint: number): PoseObject {
  return { ...o, hidden: o.hidden.includes(joint) ? o.hidden.filter((j) => j !== joint) : [...o.hidden, joint].sort((a, b) => a - b) };
}

/** A quarter turn or a scale by 2 or 1/2 around `center`, as the layer menu does for pictures. */
export function transformPose(o: PoseObject, op: 'rotateRight' | 'rotateLeft' | 'scaleUp' | 'scaleDown', center: Point): PoseObject {
  const k = op === 'scaleUp' ? 2 : op === 'scaleDown' ? 0.5 : 1;
  const points = [...o.points];
  for (let i = 0; i < POSE_JOINTS; i++) {
    const dx = (o.points[i * 2] as number) - center.x;
    const dy = (o.points[i * 2 + 1] as number) - center.y;
    const [x, y] = op === 'rotateRight' ? [-dy, dx] : op === 'rotateLeft' ? [dy, -dx] : [dx * k, dy * k];
    points[i * 2] = center.x + x;
    points[i * 2 + 1] = center.y + y;
  }
  return { ...o, points, ...(o.depth ? { depth: o.depth.map((z) => z * k) } : {}), width: Math.max(1, Math.round(o.width * k)) };
}

// Drawing ------------------------------------------------------------------------------------------------------

/** Draws the skeleton as the OpenPose preprocessor does: bones as ellipses at 60 % of their colour, then joints over them. */
export function drawPose(ctx: CanvasRenderingContext2D, o: PoseObject, maskMode: boolean) {
  const w = o.width;
  const shown = (i: number) => !o.hidden.includes(i);
  POSE_LIMBS.forEach(([a, b], i) => {
    if (!shown(a) || !shown(b)) return;
    const p1 = pt(o.points, a);
    const p2 = pt(o.points, b);
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) / 2;
    if (len <= 0) return;
    ctx.fillStyle = maskMode ? '#ffffff' : poseLimbColor(i);
    ctx.beginPath();
    ctx.ellipse((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, len, w, Math.atan2(p2.y - p1.y, p2.x - p1.x), 0, Math.PI * 2);
    ctx.fill();
  });
  for (let i = 0; i < POSE_JOINTS; i++) {
    if (!shown(i)) continue;
    const q = pt(o.points, i);
    ctx.fillStyle = maskMode ? '#ffffff' : (POSE_COLORS[i] as string);
    ctx.beginPath();
    ctx.arc(q.x, q.y, w, 0, Math.PI * 2);
    ctx.fill();
  }
}
