// 3D maths without a graphics library, shared by the canvas's 3D pose editor and the comic's 3D rough: vectors, a pose
// lifted into 3D, a bone aimed at the pointer, a part of the body turned around its parent, the view turned and baked back
// into a flat pose with depth. World space: x to the right, y up, z towards the viewer; the canvas editor's units are the
// layer's pixels, the rough's are metres.
import { POSE_JOINTS, type PoseObject } from '@/state/canvas';
import { jointBounds, POSE_PARENT, pt, subtree } from '@/state/pose/pose';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const scale = (a: Vec3, k: number): Vec3 => v3(a.x * k, a.y * k, a.z * k);
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const length3 = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
export const unit = (a: Vec3): Vec3 => {
  const l = length3(a);
  return l < 1e-9 ? v3(0, 0, 0) : scale(a, 1 / l);
};

/** A pose in 3D and where its flat picture sits, so the result can go back to the same place. */
export interface Lifted {
  joints: Vec3[];
  /** The middle of the visible joints in the layer, which is the world's origin. */
  center: { x: number; y: number };
}

/** The pose in world space around its own middle; a flat pose has all joints at depth 0. */
export function liftPose(o: Pick<PoseObject, 'points' | 'hidden' | 'depth'>): Lifted {
  const b = jointBounds(o) ?? { x: 0, y: 0, width: 0, height: 0 };
  const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const joints = Array.from({ length: POSE_JOINTS }, (_, i) => {
    const p = pt(o.points, i);
    return v3(p.x - center.x, -(p.y - center.y), o.depth?.[i] ?? 0);
  });
  return { joints, center };
}

/** Rotation of the view: turn around the vertical axis by `yaw`, then tip around the horizontal axis by `pitch` (radians). */
export function turnView(p: Vec3, yaw: number, pitch: number): Vec3 {
  const [cy, sy] = [Math.cos(yaw), Math.sin(yaw)];
  const a = v3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
  const [cp, sp] = [Math.cos(pitch), Math.sin(pitch)];
  return v3(a.x, a.y * cp - a.z * sp, a.y * sp + a.z * cp);
}

/**
 * The flat pose seen from the turned view: x and y from the picture plane and the depth from the distance to the
 * viewer, with the visible joints' middle kept where it was. Sizes are not changed, so a bone turned away from the
 * viewer comes out shorter, as a drawing of it would.
 */
export function bakeView(lifted: Lifted, hidden: readonly number[], yaw: number, pitch: number): { points: number[]; depth: number[] } {
  const turned = lifted.joints.map((p) => turnView(p, yaw, pitch));
  const shown = turned.filter((_, i) => !hidden.includes(i));
  const xs = (shown.length ? shown : turned).map((p) => p.x);
  const ys = (shown.length ? shown : turned).map((p) => p.y);
  const mx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const my = (Math.min(...ys) + Math.max(...ys)) / 2;
  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    points: turned.flatMap((p) => [round(p.x - mx + lifted.center.x), round(-(p.y - my) + lifted.center.y)]),
    depth: turned.map((p) => round(p.z)),
  };
}

/** A ray: where it starts and which way it goes (a unit vector). */
export interface Ray {
  origin: Vec3;
  dir: Vec3;
}

/**
 * Where the tip of a bone goes when the pointer's ray is the aim: on the sphere around the parent that the bone's length
 * draws, at the point of the ray nearest to where the tip is now (so the tip stays on its side of the body). A ray that
 * misses the sphere gives the sphere's point nearest to the ray.
 */
export function aimBone(parent: Vec3, tip: Vec3, ray: Ray): Vec3 {
  const len = length3(sub(tip, parent));
  const oc = sub(ray.origin, parent);
  const b = dot(oc, ray.dir);
  const disc = b * b - (dot(oc, oc) - len * len);
  if (disc >= 0) {
    const root = Math.sqrt(disc);
    const hits = [-b - root, -b + root].map((t) => add(ray.origin, scale(ray.dir, t)));
    const [a, c] = hits as [Vec3, Vec3];
    return length3(sub(a, tip)) <= length3(sub(c, tip)) ? a : c;
  }
  const nearest = add(ray.origin, scale(ray.dir, -b));
  const dir = unit(sub(nearest, parent));
  return length3(dir) === 0 ? tip : add(parent, scale(dir, len));
}

/** `v` turned by `angle` around the unit `axis` (Rodrigues). */
function turnAround(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const [c, s] = [Math.cos(angle), Math.sin(angle)];
  return add(add(scale(v, c), scale(cross(axis, v), s)), scale(axis, dot(axis, v) * (1 - c)));
}

/**
 * The joints with `joint` swung round its parent to `target`, taking everything below it along, so no bone changes
 * length. The neck has no parent: it moves the whole body by the same step.
 */
export function swingJoint(joints: readonly Vec3[], joint: number, target: Vec3): Vec3[] {
  const tip = joints[joint] as Vec3;
  const parentIndex = POSE_PARENT[joint] ?? -1;
  if (parentIndex < 0) {
    const d = sub(target, tip);
    return joints.map((p) => add(p, d));
  }
  const parent = joints[parentIndex] as Vec3;
  const from = unit(sub(tip, parent));
  const to = unit(sub(target, parent));
  const next = [...joints];
  const axis = cross(from, to);
  const sin = length3(axis);
  const angle = Math.atan2(sin, dot(from, to));
  if (angle < 1e-9) return next;
  // Turned half way round, any axis across the bone will do.
  const k = sin < 1e-9 ? unit(cross(from, Math.abs(from.x) < 0.9 ? v3(1, 0, 0) : v3(0, 1, 0))) : scale(axis, 1 / sin);
  for (const j of subtree(joint)) next[j] = add(parent, turnAround(sub(joints[j] as Vec3, parent), k, angle));
  return next;
}

/** A standing pose's joints around the middle, for a person with nothing placed yet. */
export function lengths(joints: readonly Vec3[]): number[] {
  return joints.map((p, i) => {
    const parent = POSE_PARENT[i] ?? -1;
    return parent < 0 ? 0 : length3(sub(p, joints[parent] as Vec3));
  });
}
