// The rough's set as triangles, for its depth map and for which joints the camera sees (roughBake.ts): each person a
// mannequin of simple shapes round its joints (a ball for the head, a box for the torso, cylinders for the limbs, boxes
// for the feet), each prop its shape, and the floor. Triangles are flat lists of nine numbers (three corners, x y z).
import { add, cross, dot, length3, scale, sub, unit, v3, type Vec3 } from '@/state/pose/math3d';
import { J } from '@/state/pose/pose';
import type { ComicRough, RoughPerson, RoughProp } from './rough';
import { facing, personJoints, placeLocal } from './roughView';

/** Half the side of the floor, in metres: far enough that it runs to the horizon. */
export const FLOOR_HALF = 60;

const push = (out: number[], a: Vec3, b: Vec3, c: Vec3) => out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
const quad = (out: number[], a: Vec3, b: Vec3, c: Vec3, d: Vec3) => {
  push(out, a, b, c);
  push(out, a, c, d);
};

/** A box round `center` along three axes (unit vectors, at right angles), with half its size along each. */
export function boxTriangles(out: number[], center: Vec3, axes: [Vec3, Vec3, Vec3], half: [number, number, number]) {
  const corner = (i: number, j: number, k: number) =>
    add(center, add(scale(axes[0], i * half[0]), add(scale(axes[1], j * half[1]), scale(axes[2], k * half[2]))));
  const c = [-1, 1].flatMap((i) => [-1, 1].flatMap((j) => [-1, 1].map((k) => corner(i, j, k))));
  const [a, b, d, e, f, g, h, k] = c as [Vec3, Vec3, Vec3, Vec3, Vec3, Vec3, Vec3, Vec3];
  // Corners by (i, j, k): a(-,-,-) b(-,-,+) d(-,+,-) e(-,+,+) f(+,-,-) g(+,-,+) h(+,+,-) k(+,+,+).
  quad(out, a, b, e, d);
  quad(out, f, h, k, g);
  quad(out, a, f, g, b);
  quad(out, d, e, k, h);
  quad(out, a, d, h, f);
  quad(out, b, g, k, e);
}

/** Two unit vectors at right angles to `axis` (a unit vector) and to each other. */
function across(axis: Vec3): [Vec3, Vec3] {
  const helper = Math.abs(axis.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0);
  const u = unit(cross(axis, helper));
  return [u, cross(axis, u)];
}

/** A closed cylinder from `a` to `b`. */
export function cylinderTriangles(out: number[], a: Vec3, b: Vec3, radius: number, segments = 12) {
  const axis = unit(sub(b, a));
  if (length3(axis) === 0 || radius <= 0) return;
  const [u, w] = across(axis);
  const ring = (centre: Vec3) =>
    Array.from({ length: segments }, (_, i) => {
      const angle = (i / segments) * Math.PI * 2;
      return add(centre, add(scale(u, Math.cos(angle) * radius), scale(w, Math.sin(angle) * radius)));
    });
  const [bottom, top] = [ring(a), ring(b)];
  for (let i = 0; i < segments; i++) {
    const n = (i + 1) % segments;
    quad(out, bottom[i] as Vec3, bottom[n] as Vec3, top[n] as Vec3, top[i] as Vec3);
    push(out, a, bottom[n] as Vec3, bottom[i] as Vec3);
    push(out, b, top[i] as Vec3, top[n] as Vec3);
  }
}

/** A ball. */
export function sphereTriangles(out: number[], centre: Vec3, radius: number, rings = 8, segments = 12) {
  const at = (r: number, s: number) => {
    const polar = (r / rings) * Math.PI;
    const angle = (s / segments) * Math.PI * 2;
    return add(centre, v3(Math.sin(polar) * Math.cos(angle) * radius, Math.cos(polar) * radius, Math.sin(polar) * Math.sin(angle) * radius));
  };
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) quad(out, at(r, s), at(r + 1, s), at(r + 1, s + 1), at(r, s + 1));
  }
}

const middle = (a: Vec3, b: Vec3) => scale(add(a, b), 0.5);
/** A standing person's torso length (neck to the middle of the hips), which the mannequin's thickness follows. */
const ADULT_TORSO = 0.528;

/** A person as a mannequin round its joints, its parts as thick as its torso is long. */
export function personTriangles(out: number[], person: RoughPerson) {
  const j = personJoints(person);
  const at = (i: number) => j[i] as Vec3;
  const shoulders = middle(at(J.rShoulder), at(J.lShoulder));
  const hips = middle(at(J.rHip), at(J.lHip));
  const s = Math.min(2, Math.max(0.3, length3(sub(at(J.neck), hips)) / ADULT_TORSO));
  // The torso: a box from the hips to the shoulders, as wide as the wider of the two, turned the way the shoulders are.
  const up = unit(sub(shoulders, hips));
  if (length3(up) > 0) {
    const side = sub(at(J.lShoulder), at(J.rShoulder));
    const wide = unit(sub(side, scale(up, dot(side, up))));
    const ahead = length3(wide) > 0 ? cross(wide, up) : facing(person.yaw);
    const width = Math.max(length3(sub(at(J.lShoulder), at(J.rShoulder))), length3(sub(at(J.lHip), at(J.rHip))));
    const half: [number, number, number] = [width / 2 + 0.04 * s, length3(sub(shoulders, hips)) / 2 + 0.05 * s, 0.11 * s];
    boxTriangles(out, middle(shoulders, hips), [length3(wide) > 0 ? wide : unit(cross(up, ahead)), up, ahead], half);
  }
  const head = middle(at(J.rEar), at(J.lEar));
  sphereTriangles(out, head, 0.11 * s);
  cylinderTriangles(out, at(J.neck), head, 0.05 * s, 8);
  const limbs: [number, number, number][] = [
    [J.rShoulder, J.rElbow, 0.045],
    [J.rElbow, J.rWrist, 0.04],
    [J.lShoulder, J.lElbow, 0.045],
    [J.lElbow, J.lWrist, 0.04],
    [J.rHip, J.rKnee, 0.07],
    [J.rKnee, J.rAnkle, 0.05],
    [J.lHip, J.lKnee, 0.07],
    [J.lKnee, J.lAnkle, 0.05],
  ];
  for (const [a, b, radius] of limbs) cylinderTriangles(out, at(a), at(b), radius * s, 10);
  for (const wrist of [J.rWrist, J.lWrist]) sphereTriangles(out, at(wrist), 0.05 * s, 5, 8);
  // The feet point the way the person faces, flat on the ground below the ankles.
  const ahead = facing(person.yaw);
  const right = v3(ahead.z, 0, -ahead.x);
  for (const ankle of [J.rAnkle, J.lAnkle]) {
    const centre = add(at(ankle), v3(ahead.x * 0.06 * s, -0.035 * s, ahead.z * 0.06 * s));
    boxTriangles(out, centre, [right, v3(0, 1, 0), ahead], [0.045 * s, 0.04 * s, 0.12 * s]);
  }
}

/** A prop as its shape: a box, an upright plane (both sides) or an upright cylinder, standing on its position. */
export function propTriangles(out: number[], prop: RoughProp) {
  const ahead = facing(prop.yaw);
  const right = v3(ahead.z, 0, -ahead.x);
  const base = v3(prop.x, prop.y, prop.z);
  if (prop.shape === 'box') {
    boxTriangles(out, add(base, v3(0, prop.h / 2, 0)), [right, v3(0, 1, 0), ahead], [prop.w / 2, prop.h / 2, prop.d / 2]);
  } else if (prop.shape === 'plane') {
    const corner = (x: number, y: number) => placeLocal(prop, v3(x * prop.w, y * prop.h, 0));
    quad(out, corner(-0.5, 0), corner(0.5, 0), corner(0.5, 1), corner(-0.5, 1));
  } else {
    cylinderTriangles(out, base, add(base, v3(0, prop.h, 0)), prop.w / 2, 24);
  }
}

/** Every triangle of the set. */
export function roughTriangles(rough: ComicRough): number[] {
  const out: number[] = [];
  if (rough.floor) {
    const f = (x: number, z: number) => v3(x * FLOOR_HALF, 0, z * FLOOR_HALF);
    quad(out, f(-1, -1), f(1, -1), f(1, 1), f(-1, 1));
  }
  for (const prop of rough.props) propTriangles(out, prop);
  for (const person of rough.people) personTriangles(out, person);
  return out;
}
