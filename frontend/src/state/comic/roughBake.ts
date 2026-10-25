// What the rough's camera sees, worked out without a graphics library so it gives the same pictures everywhere: the set's
// triangles are drawn into a depth buffer at the panel's picture size, which gives the depth map (near is light, far is
// dark, as a depth estimator draws it) and tells which of the people's joints something hides. The people's OpenPose
// figures are their joints as the camera sees them, without the hidden ones.
import { J } from '@/state/pose/pose';
import { add, length3, scale, sub, type Vec3 } from '@/state/pose/math3d';
import type { ComicRough } from './rough';
import { roughTriangles } from './roughMesh';
import { cameraFrame, halfHeight, personJoints, toView, viewToPicture, type CameraFrame } from './roughView';

/** Nothing nearer to the camera than this (metres) is drawn: the floor runs on behind the camera and is cut here. */
export const NEAR = 0.05;

/** The depth buffer: per pixel, one over the distance of the nearest surface in front of the camera (0 where there is none). */
export interface DepthBuffer {
  width: number;
  height: number;
  inverse: Float32Array;
}

interface Screen {
  x: number;
  y: number;
  /** One over the distance in front of the camera, which runs straight across the picture. */
  w: number;
}

/** The part of a triangle (in the camera's space) at least NEAR in front of the camera: 0, 3 or 4 corners. */
function clipNear(corners: Vec3[]): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i] as Vec3;
    const b = corners[(i + 1) % corners.length] as Vec3;
    const aIn = a.z >= NEAR;
    const bIn = b.z >= NEAR;
    if (aIn) out.push(a);
    if (aIn !== bIn) out.push(add(a, scale(sub(b, a), (NEAR - a.z) / (b.z - a.z))));
  }
  return out;
}

function fill(buffer: DepthBuffer, a: Screen, b: Screen, c: Screen) {
  const { width, height, inverse } = buffer;
  const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (Math.abs(area) < 1e-12) return;
  const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
  const x1 = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
  const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
  const y1 = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      // Barycentric weights of the pixel's middle; all of one sign inside, whichever way the corners turn.
      const wa = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) / area;
      const wb = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) / area;
      const wc = 1 - wa - wb;
      if (wa < 0 || wb < 0 || wc < 0) continue;
      const w = wa * a.w + wb * b.w + wc * c.w;
      const i = y * width + x;
      if (w > (inverse[i] as number)) inverse[i] = w;
    }
  }
}

/** The set drawn into a depth buffer of the given size, through the rough's camera. */
export function depthBuffer(rough: ComicRough, width: number, height: number, triangles = roughTriangles(rough)): DepthBuffer {
  const buffer: DepthBuffer = { width, height, inverse: new Float32Array(width * height) };
  const frame = cameraFrame(rough.camera);
  const t = halfHeight(rough.camera);
  const aspect = width / height;
  const screen = (v: Vec3): Screen => {
    const p = viewToPicture(v, t, aspect);
    return { x: p.x * width, y: p.y * height, w: 1 / v.z };
  };
  for (let i = 0; i + 8 < triangles.length; i += 9) {
    const corner = (k: number) => toView(frame, { x: triangles[i + k] as number, y: triangles[i + k + 1] as number, z: triangles[i + k + 2] as number });
    const kept = clipNear([corner(0), corner(3), corner(6)]).map(screen);
    for (let k = 1; k + 1 < kept.length; k++) fill(buffer, kept[0] as Screen, kept[k] as Screen, kept[k + 1] as Screen);
  }
  return buffer;
}

/**
 * The depth map as grey RGBA pixels: one over the distance, stretched from the farthest surface (black) to the nearest
 * (white), as a depth estimator draws a photo; where nothing is, black.
 */
export function depthPixels(buffer: DepthBuffer): Uint8ClampedArray<ArrayBuffer> {
  let lo = Infinity;
  let hi = 0;
  for (const w of buffer.inverse) {
    if (w <= 0) continue;
    if (w < lo) lo = w;
    if (w > hi) hi = w;
  }
  const span = hi - lo;
  const out = new Uint8ClampedArray(buffer.inverse.length * 4);
  buffer.inverse.forEach((w, i) => {
    const v = w <= 0 ? 0 : span < 1e-9 ? 255 : Math.round(((w - lo) / span) * 255);
    out[i * 4] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  });
  return out;
}

/**
 * How much nearer than a joint a surface must be to hide it, in metres for an adult (it grows with the person): more than
 * the mannequin's own flesh round a joint (the torso is 0.11 deep each side of its joints), less than the head's depth, so
 * the far arm behind the body and the face of a person seen from behind are hidden, and the near ones are not.
 */
const HIDE_MARGIN = 0.15;

/** Of the joints `among`, the one nearest joint `i` on the set; null when there is none. */
function nearestOf(joints: readonly Vec3[], i: number, among: readonly number[]): number | null {
  let best: number | null = null;
  let far = Infinity;
  for (const k of among) {
    const d = length3(sub(joints[k] as Vec3, joints[i] as Vec3));
    if (d < far) {
      far = d;
      best = k;
    }
  }
  return best;
}

/** One person as the camera sees it: its joints in pixels of the picture, and the ones something hides or that are behind the camera. */
export interface SeenPerson {
  points: number[];
  hidden: number[];
}

/**
 * The people's joints as the camera sees them in a picture of the depth buffer's size. A joint outside the picture is kept:
 * the figure runs out of the frame. A joint behind the camera has no place in the picture: it is hidden, and its point is
 * that of the nearest joint the camera sees, so the person's box and head stay where the person is; a person wholly
 * behind the camera stands outside the picture, past its top left.
 */
export function seenPeople(rough: ComicRough, buffer: DepthBuffer, frame: CameraFrame = cameraFrame(rough.camera)): SeenPerson[] {
  const { width, height, inverse } = buffer;
  const t = halfHeight(rough.camera);
  const aspect = width / height;
  return rough.people.map((person) => {
    const joints = personJoints(person);
    const torso = length3(sub(joints[J.neck] as Vec3, scale(add(joints[J.rHip] as Vec3, joints[J.lHip] as Vec3), 0.5)));
    const margin = HIDE_MARGIN * Math.min(2, Math.max(0.3, torso / 0.528));
    const views = joints.map((p) => toView(frame, p));
    const seen = views.flatMap((v, i) => (v.z >= NEAR ? [i] : []));
    const points: number[] = [];
    const hidden: number[] = [];
    views.forEach((v, i) => {
      if (v.z < NEAR) {
        const stand = nearestOf(joints, i, seen);
        const p = stand === null ? { x: -1, y: -1 } : viewToPicture(views[stand] as Vec3, t, aspect);
        points.push(Math.round(p.x * width * 10) / 10, Math.round(p.y * height * 10) / 10);
        hidden.push(i);
        return;
      }
      const { x: fx, y: fy } = viewToPicture(v, t, aspect);
      const x = fx * width;
      const y = fy * height;
      points.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
      const px = Math.floor(x);
      const py = Math.floor(y);
      if (px < 0 || py < 0 || px >= width || py >= height) return;
      const nearest = inverse[py * width + px] as number;
      if (nearest > 0 && 1 / nearest < v.z - margin) hidden.push(i);
    });
    return { points, hidden };
  });
}
