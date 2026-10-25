// How the rough's camera sees the set: where the camera is, where a point lands in the panel's picture, the people's
// joints on the set, and the people of a panel's flat pose stood up in front of the camera. Pure maths, no graphics library.
import { add, cross, dot, scale, sub, unit, v3, type Vec3 } from '@/state/pose/math3d';
import { J } from '@/state/pose/pose';
import { newPerson, standingJoints, type RoughCamera, type RoughPerson } from './rough';

/** Where the camera is and which ways its picture's right, up and forward point (unit vectors). */
export interface CameraFrame {
  position: Vec3;
  right: Vec3;
  up: Vec3;
  forward: Vec3;
}

export function cameraFrame(c: RoughCamera): CameraFrame {
  const cp = Math.cos(c.pitch);
  const back = v3(Math.sin(c.yaw) * cp, Math.sin(c.pitch), Math.cos(c.yaw) * cp);
  const forward = scale(back, -1);
  const right = unit(cross(forward, v3(0, 1, 0)));
  return { position: add(c.target, scale(back, c.distance)), right, up: cross(right, forward), forward };
}

/** A point in the camera's own space: x to the picture's right, y up, z the distance in front of the camera. */
export function toView(frame: CameraFrame, p: Vec3): Vec3 {
  const d = sub(p, frame.position);
  return v3(dot(d, frame.right), dot(d, frame.up), dot(d, frame.forward));
}

/** Half the picture's height at one metre in front of the camera, in metres. */
export const halfHeight = (c: Pick<RoughCamera, 'fov'>) => Math.tan((c.fov * Math.PI) / 360);

/**
 * Where a point lands in a picture of the given aspect (width over height): x and y as fractions of the picture (0 to 1
 * inside it, y down), and its distance in front of the camera (0 or less: behind it).
 */
export function project(camera: RoughCamera, aspect: number, p: Vec3, frame = cameraFrame(camera)): { x: number; y: number; depth: number } {
  return viewToPicture(toView(frame, p), halfHeight(camera), aspect);
}

/** A point of the camera's space in the picture, as `project` gives it; the one place the projection is written. */
export function viewToPicture(v: Vec3, halfHeight: number, aspect: number): { x: number; y: number; depth: number } {
  return { x: 0.5 + v.x / (v.z * halfHeight * aspect) / 2, y: 0.5 - v.y / (v.z * halfHeight) / 2, depth: v.z };
}

/** Metres rounded to the millimetre, as the rough keeps them. */
export const mm = (v: number) => Math.round(v * 1000) / 1000;

/** The way a person or a prop with this yaw faces: +z for 0. */
export const facing = (yaw: number): Vec3 => v3(Math.sin(yaw), 0, Math.cos(yaw));

/** A point of a person's or a prop's own space on the set: turned by its yaw, then moved to where it stands. */
export function placeLocal(at: Pick<RoughPerson, 'x' | 'y' | 'z' | 'yaw'>, p: Vec3): Vec3 {
  const c = Math.cos(at.yaw);
  const s = Math.sin(at.yaw);
  return v3(at.x + p.x * c + p.z * s, at.y + p.y, at.z - p.x * s + p.z * c);
}

/** The inverse of placeLocal: a point of the set in the person's or prop's own space. */
export function toLocal(at: Pick<RoughPerson, 'x' | 'y' | 'z' | 'yaw'>, p: Vec3): Vec3 {
  const c = Math.cos(at.yaw);
  const s = Math.sin(at.yaw);
  const d = v3(p.x - at.x, p.y - at.y, p.z - at.z);
  return v3(d.x * c - d.z * s, d.y, d.x * s + d.z * c);
}

/** The person's own joints as points. */
export function localJoints(person: Pick<RoughPerson, 'joints'>): Vec3[] {
  return Array.from({ length: 18 }, (_, i) => v3(person.joints[i * 3] ?? 0, person.joints[i * 3 + 1] ?? 0, person.joints[i * 3 + 2] ?? 0));
}

/** The person's 18 joints on the set. */
export const personJoints = (person: RoughPerson): Vec3[] => localJoints(person).map((p) => placeLocal(person, p));

const STANDING = localJoints({ joints: standingJoints() });
/** How high a standing person's hips are above the soles, in metres. */
const HIP_HEIGHT = ((STANDING[J.rHip] as Vec3).y + (STANDING[J.lHip] as Vec3).y) / 2;
/** How tall a standing person's torso is (neck to the middle of the hips), in metres: what a flat pose's torso is measured against. */
const TORSO = (STANDING[J.neck] as Vec3).y - HIP_HEIGHT;
/** How far in front of the head's middle the nose and the eyes are, so a person seen from behind hides the face. */
const FACE_DEPTH: Partial<Record<number, number>> = { [J.nose]: 0.1, [J.rEye]: 0.085, [J.lEye]: 0.085 };

/**
 * The people of a panel's flat pose (the joints as fractions of the panel) stood up in front of the camera, each as a flat
 * figure facing the camera (or turned away, when its right shoulder is on the picture's right), at the distance where an
 * adult's torso is as tall as the figure's. The figure lies square to the camera's view, tilted with it when the camera
 * looks up or down, so through any camera it looks as the pose did and the rough starts from what the panel has; their
 * depth is for the user to give.
 */
export function liftPoses(poses: readonly (readonly { x: number; y: number }[])[], camera: RoughCamera, aspect: number): RoughPerson[] {
  const frame = cameraFrame(camera);
  const t = halfHeight(camera);
  return poses.flatMap((pose) => {
    if (pose.length !== 18) return [];
    const at = (i: number) => pose[i] as { x: number; y: number };
    const hips = { x: (at(J.rHip).x + at(J.lHip).x) / 2, y: (at(J.rHip).y + at(J.lHip).y) / 2 };
    // Sizes in fractions of the picture's height, so x and y are measured alike.
    const torso = Math.hypot((at(J.neck).x - hips.x) * aspect, at(J.neck).y - hips.y);
    if (torso < 0.01) return [];
    const depth = TORSO / (torso * 2 * t);
    const metres = 2 * depth * t; // one picture height at that distance
    const away = at(J.rShoulder).x > at(J.lShoulder).x;
    // The middle of the hips on the set: along the ray through it, `depth` in front of the camera.
    const ray = add(frame.forward, add(scale(frame.right, (hips.x - 0.5) * 2 * t * aspect), scale(frame.up, (0.5 - hips.y) * 2 * t)));
    const hip = add(frame.position, scale(ray, depth));
    const person = newPerson(mm(hip.x), mm(hip.z), camera.yaw + (away ? Math.PI : 0));
    const stand = { ...person, y: mm(hip.y - HIP_HEIGHT) };
    // Each joint on the plane square to the view through the hips; the face a little towards the way the person faces.
    const ahead = scale(frame.forward, away ? 1 : -1);
    const joints = pose.flatMap((p, i) => {
      const onPlane = add(hip, add(scale(frame.right, (p.x - hips.x) * aspect * metres), scale(frame.up, (hips.y - p.y) * metres)));
      const local = toLocal(stand, add(onPlane, scale(ahead, FACE_DEPTH[i] ?? 0)));
      return [local.x, local.y, local.z];
    });
    return [{ ...stand, joints: joints.map(mm) }];
  });
}
