// Poses described by angles: a body built from bone lengths and joint angles (so it is always a whole person), read
// from the AI assistant's answer, written back for it, and drawn at random.
import { POSE_JOINTS, type PoseObject, type Rect } from '@/state/canvas';
import { POSE_MIRROR } from '@/state/poseSkeleton';
import type { Point } from './pose';
import { fitPoints, J, jointBounds, POSE_PARENT, pt } from './pose';

/** A small seeded generator (mulberry32), so a seed always gives the same pose. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One person as the assistant describes them. Angles are in degrees from straight down in the picture, for the bone
 * itself (not relative to the bone above): 0 hangs down, 90 points to the right edge of the picture, 180 points up,
 * -90 to the left edge. `r` is the person's own right, which is on the left of the picture when they face the viewer.
 * Everything is optional; the default is a person standing upright, arms a little away from the body.
 */
export interface PoseSpec {
  /** Where the body's middle is, as fractions of the generation box (default the middle). */
  x?: number;
  y?: number;
  /**
   * Height of a standing figure as a fraction of the box height (default 0.85). Above 1 the figure is larger than the
   * box, for a figure framed from the knees or the chest up (up to 2.5).
   */
  size?: number;
  /**
   * Where the neck is, as fractions of the box; when set it replaces `x` and `y`, so the neck stays put when `size`
   * changes. This frames a figure: a bust-up is a high neck and a large size with the legs left outside the box.
   */
  neck?: { x: number; y: number };
  /**
   * Seen from behind: the nose and eyes are left out and the person's right is on the right of the picture, as OpenPose
   * draws a back. The arm and leg fields keep naming the picture's sides: `rArm` is the arm on the picture's left.
   */
  back?: boolean;
  /** Upper body lean in degrees, positive towards the right of the picture. */
  lean?: number;
  /** How far the body turns from the viewer: 1 faces them, 0.5 is nearly sideways. */
  turn?: number;
  head?: { tilt?: number; turn?: number };
  rArm?: ArmSpec;
  lArm?: ArmSpec;
  rLeg?: LegSpec;
  lLeg?: LegSpec;
}
export interface ArmSpec {
  upper?: number;
  fore?: number;
  /** 0.3 to 1: how much of its length shows (a bone pointing at the viewer is shorter). */
  reach?: number;
}
export interface LegSpec {
  thigh?: number;
  shin?: number;
  reach?: number;
}

const DEG = Math.PI / 180;
/** Bone lengths of the unit body; a standing figure is about 0.92 tall from the eyes to the ankles. */
const BONE = { torso: 0.32, shoulder: 0.11, hip: 0.06, upperArm: 0.17, foreArm: 0.15, thigh: 0.24, shin: 0.24, neckToNose: 0.1, neckToEar: 0.11 };
const STAND_HEIGHT = 0.92;

const dir = (a: number): Point => ({ x: Math.sin(a), y: Math.cos(a) });
const at = (from: Point, a: number, len: number): Point => {
  const d = dir(a);
  return { x: from.x + d.x * len, y: from.y + d.y * len };
};

/** The person in unit space (neck at the origin), as 18 points and the joints left out. */
export function poseFromSpec(spec: PoseSpec): { points: number[]; hidden: number[] } {
  const p: Point[] = new Array<Point>(POSE_JOINTS).fill({ x: 0, y: 0 });
  const spine = -(spec.lean ?? 0) * DEG;
  const neck = { x: 0, y: 0 };
  p[J.neck] = neck;
  const hipMid = at(neck, spine, BONE.torso);
  const turn = spec.turn ?? 1;
  const across = spine + 90 * DEG;
  p[J.rShoulder] = at(neck, across, -BONE.shoulder * turn);
  p[J.lShoulder] = at(neck, across, BONE.shoulder * turn);
  p[J.rHip] = at(hipMid, across, -BONE.hip * turn);
  p[J.lHip] = at(hipMid, across, BONE.hip * turn);

  const arm = (shoulder: number, elbow: number, wrist: number, s: ArmSpec | undefined, hang: number) => {
    const reach = s?.reach ?? 1;
    const upper = (s?.upper ?? hang) * DEG;
    const fore = (s?.fore ?? hang / 2) * DEG;
    p[elbow] = at(p[shoulder] as Point, upper, BONE.upperArm * reach);
    p[wrist] = at(p[elbow] as Point, fore, BONE.foreArm * reach);
  };
  arm(J.rShoulder, J.rElbow, J.rWrist, spec.rArm, -10);
  arm(J.lShoulder, J.lElbow, J.lWrist, spec.lArm, 10);
  const leg = (hip: number, knee: number, ankle: number, s: LegSpec | undefined, hang: number) => {
    const reach = s?.reach ?? 1;
    const thigh = (s?.thigh ?? hang) * DEG;
    const shin = (s?.shin ?? hang / 2) * DEG;
    p[knee] = at(p[hip] as Point, thigh, BONE.thigh * reach);
    p[ankle] = at(p[knee] as Point, shin, BONE.shin * reach);
  };
  leg(J.rHip, J.rKnee, J.rAnkle, spec.rLeg, -5);
  leg(J.lHip, J.lKnee, J.lAnkle, spec.lLeg, 5);

  // The head: tilt around the neck, and a turn that slides the face sideways and hides the far ear.
  const headAngle = (180 - (spec.head?.tilt ?? 0)) * DEG;
  const yaw = Math.max(-1, Math.min(1, spec.head?.turn ?? 0));
  const nose = at(neck, headAngle, BONE.neckToNose);
  p[J.nose] = { x: nose.x + yaw * 0.02, y: nose.y };
  const side = headAngle - 90 * DEG;
  const eye = (s: 1 | -1) => at(at(p[J.nose] as Point, headAngle, 0.02), side, s * 0.025 * (1 - s * yaw * 0.5));
  p[J.rEye] = eye(-1);
  p[J.lEye] = eye(1);
  const ear = (s: 1 | -1) => at(at(neck, headAngle, BONE.neckToEar), side, s * 0.06 * (1 - s * yaw * 0.4));
  p[J.rEar] = ear(-1);
  p[J.lEar] = ear(1);
  // Turning towards their left (the picture's right) puts the left ear behind the head.
  const hidden = yaw > 0.6 ? [J.lEar] : yaw < -0.6 ? [J.rEar] : [];
  if (spec.back) {
    // The labels swap sides (the geometry stays), and the face is out of sight.
    return { points: POSE_MIRROR.flatMap((from) => [(p[from] as Point).x, (p[from] as Point).y]), hidden: [J.nose, J.rEye, J.lEye] };
  }
  return { points: p.flatMap((q) => [q.x, q.y]), hidden };
}

/** The person placed in the generation box `area` (layer space): `size` and the middle come from the description. */
export function placePose(id: string, spec: PoseSpec, area: Rect, width: number): PoseObject {
  const { points, hidden } = poseFromSpec(spec);
  const k = ((spec.size ?? 0.85) * area.height) / STAND_HEIGHT;
  const b = jointBounds({ points, hidden }) ?? { x: 0, y: 0, width: 0, height: 0 };
  const [bx, by] = [b.x + b.width / 2, b.y + b.height / 2];
  // The unit body has its neck at the origin, so a neck anchor puts the middle of the bounds one offset away from it.
  const cx = spec.neck ? area.x + spec.neck.x * area.width + bx * k : area.x + (spec.x ?? 0.5) * area.width;
  const cy = spec.neck ? area.y + spec.neck.y * area.height + by * k : area.y + (spec.y ?? 0.5) * area.height;
  const placed = points.map((v, i) => Math.round(((v - (i % 2 === 0 ? bx : by)) * k + (i % 2 === 0 ? cx : cy)) * 10) / 10);
  return { kind: 'pose', id, points: placed, hidden, width };
}

/**
 * A person found in a picture (0 to 1 of its width and height), placed in the generation box `area` (layer space) with
 * the picture fitted inside it whole, so the figure stands where it stood in the picture. A joint that was not found
 * is hidden and rests on the joint it hangs from.
 */
export function placeExtractedPerson(id: string, person: { points: number[]; hidden: number[] }, aspect: number, area: Rect, width: number): PoseObject {
  const w = Math.min(area.width, area.height * aspect);
  const h = w / aspect;
  const [ox, oy] = [area.x + (area.width - w) / 2, area.y + (area.height - h) / 2];
  const points = person.points.map((v, i) => Math.round((i % 2 === 0 ? ox + v * w : oy + v * h) * 10) / 10);
  for (const j of [...person.hidden].sort((a, b) => a - b)) {
    const at = POSE_PARENT[j] ?? -1;
    const [x, y] = at >= 0 ? [points[at * 2], points[at * 2 + 1]] : [ox + w / 2, oy + h / 2];
    points[j * 2] = x ?? 0;
    points[j * 2 + 1] = y ?? 0;
  }
  return { kind: 'pose', id, points, hidden: [...person.hidden], width };
}

// What the assistant sends and is told --------------------------------------------------------------------------

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, lo: number, hi: number): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined);
const drop = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

function readLimb<K extends string>(raw: unknown, keys: readonly [K, K]): ({ reach?: number } & Partial<Record<K, number>>) | undefined {
  if (!isObject(raw)) return undefined;
  const out = drop({ [keys[0]]: num(raw[keys[0]], -360, 360), [keys[1]]: num(raw[keys[1]], -360, 360), reach: num(raw.reach, 0.3, 1) });
  return out as { reach?: number } & Partial<Record<K, number>>;
}

/** A person from the assistant's JSON, with every number kept in range and anything unknown dropped; null when it is not an object. */
export function readPoseSpec(raw: unknown): PoseSpec | null {
  if (!isObject(raw)) return null;
  const head = isObject(raw.head) ? drop({ tilt: num(raw.head.tilt, -90, 90), turn: num(raw.head.turn, -1, 1) }) : undefined;
  // The neck anchors a framed figure (a bust-up keeps its head in the panel); both of its numbers are needed.
  const neckX = isObject(raw.neck) ? num(raw.neck.x, -0.2, 1.2) : undefined;
  const neckY = isObject(raw.neck) ? num(raw.neck.y, -0.2, 1.2) : undefined;
  return drop({
    x: num(raw.x, -0.2, 1.2),
    y: num(raw.y, -0.2, 1.2),
    neck: neckX !== undefined && neckY !== undefined ? { x: neckX, y: neckY } : undefined,
    back: raw.back === true ? true : undefined,
    size: num(raw.size, 0.1, 2.5),
    lean: num(raw.lean, -90, 90),
    turn: num(raw.turn, 0.4, 1),
    head,
    rArm: readLimb(raw.rArm, ['upper', 'fore']),
    lArm: readLimb(raw.lArm, ['upper', 'fore']),
    rLeg: readLimb(raw.rLeg, ['thigh', 'shin']),
    lLeg: readLimb(raw.lLeg, ['thigh', 'shin']),
  });
}

const angleOf = (from: Point, to: Point) => {
  const a = Math.atan2(to.x - from.x, to.y - from.y) / DEG;
  return Math.round(a === -180 ? 180 : a);
};
const clean = (v: number, lo: number, hi: number) => Math.round(Math.min(hi, Math.max(lo, v)) * 100) / 100;

/** The description of a pose on the canvas, for the assistant to read and change (angles to the nearest degree). */
export function poseToSpec(o: PoseObject, area: Rect): PoseSpec {
  // A person seen from behind keeps its sides swapped and its face hidden (see poseFromSpec): read it as it was made.
  const back = [J.nose, J.rEye, J.lEye].every((j) => o.hidden.includes(j));
  const P = (j: number) => pt(o.points, back ? (POSE_MIRROR[j] ?? j) : j);
  const neck = P(J.neck);
  const hipMid = { x: (P(J.rHip).x + P(J.lHip).x) / 2, y: (P(J.rHip).y + P(J.lHip).y) / 2 };
  const torso = Math.hypot(hipMid.x - neck.x, hipMid.y - neck.y);
  const k = Math.max(torso / BONE.torso, 1e-6);
  const b = jointBounds(o) ?? { x: 0, y: 0, width: 0, height: 0 };
  const dist = (a: number, c: number) => Math.hypot(P(a).x - P(c).x, P(a).y - P(c).y);
  const arm = (s: number, e: number, w: number): ArmSpec => ({ upper: angleOf(P(s), P(e)), fore: angleOf(P(e), P(w)), reach: clean(dist(s, e) / (BONE.upperArm * k), 0.3, 1) });
  const leg = (h: number, kn: number, a: number): LegSpec => ({ thigh: angleOf(P(h), P(kn)), shin: angleOf(P(kn), P(a)), reach: clean(dist(h, kn) / (BONE.thigh * k), 0.3, 1) });
  const headTilt = 180 - angleOf(neck, P(J.nose));
  return {
    ...(back ? { back: true } : {}),
    x: clean((b.x + b.width / 2 - area.x) / area.width, -0.2, 1.2),
    y: clean((b.y + b.height / 2 - area.y) / area.height, -0.2, 1.2),
    size: clean((k * STAND_HEIGHT) / area.height, 0.1, 2.5),
    lean: 0 - angleOf(neck, hipMid),
    turn: clean(dist(J.rShoulder, J.lShoulder) / (2 * BONE.shoulder * k), 0.4, 1),
    head: { tilt: Math.round(((headTilt + 540) % 360) - 180), turn: o.hidden.includes(J.lEar) ? 0.8 : o.hidden.includes(J.rEar) ? -0.8 : 0 },
    rArm: arm(J.rShoulder, J.rElbow, J.rWrist),
    lArm: arm(J.lShoulder, J.lElbow, J.lWrist),
    rLeg: leg(J.rHip, J.rKnee, J.rAnkle),
    lLeg: leg(J.lHip, J.lKnee, J.lAnkle),
  };
}

// Random poses ------------------------------------------------------------------------------------------------

/**
 * A random person: each bone keeps its length and turns within a range a body can reach, so the result is always
 * plausible. The spine leans, the head tilts and turns, arms and legs swing and bend, and some limbs are shortened as
 * if pointing at the viewer. The feet stay below the knees.
 */
export function randomPoseSpec(rand: () => number): PoseSpec {
  const between = (lo: number, hi: number) => lo + (hi - lo) * rand();
  const depth = () => (rand() < 0.3 ? between(0.55, 1) : 1);
  const lean = between(-18, 18);
  const spine = -lean;
  const arm = (side: 1 | -1): ArmSpec => {
    const upper = spine + side * between(-30, 170);
    return { upper, fore: upper + side * between(-150, 20), reach: depth() };
  };
  const crouch = rand() < 0.35;
  const leg = (side: 1 | -1): LegSpec => {
    const thigh = spine + side * (crouch ? between(20, 95) : between(-15, 45));
    const bent = thigh - side * (crouch ? between(60, 150) : between(-10, 70));
    return { thigh, shin: Math.max(-80, Math.min(80, bent)), reach: depth() };
  };
  return { lean, turn: between(0.55, 1), head: { tilt: lean + between(-25, 25), turn: between(-1, 1) }, rArm: arm(-1), lArm: arm(1), rLeg: leg(-1), lLeg: leg(1) };
}

/** A random body in unit space. */
export function randomPosePoints(rand: () => number): { points: number[]; hidden: number[] } {
  return poseFromSpec(randomPoseSpec(rand));
}

/** A random pose fitted into `rect`. */
export function randomPose(id: string, rand: () => number, rect: Rect, width: number): PoseObject {
  const { points, hidden } = randomPosePoints(rand);
  return { kind: 'pose', id, points: fitPoints(points, hidden, rect), hidden, width };
}

/** The same pose shape replaced by a new random one, in the place and size of the old one. */
export function rerollPose(o: PoseObject, rand: () => number): PoseObject {
  const b = jointBounds(o) ?? { x: 0, y: 0, width: 256, height: 256 };
  const side = Math.max(b.width, b.height);
  const rect = { x: b.x + b.width / 2 - side / 2, y: b.y + b.height / 2 - side / 2, width: side, height: side };
  return { ...randomPose(o.id, rand, rect, o.width) };
}
