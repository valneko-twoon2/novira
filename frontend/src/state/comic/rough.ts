// A panel's 3D rough: people as mannequins, props (boxes, boards, cylinders) and a floor, seen through a camera with
// perspective. Applying it bakes the panel's control pictures: the people's OpenPose figures as the camera sees them and
// a depth map of the whole set (roughBake.ts). Units are metres, y is up and the floor is y = 0. This file is
// the stored shape: its limits, how it is read back and what a new one starts with.
import type { Vec3 } from '@/state/pose/math3d';
import { randomUuid } from '@/state/randomUuid';

export const ROUGH_SHAPES = ['box', 'plane', 'cylinder'] as const;
export type RoughShape = (typeof ROUGH_SHAPES)[number];

/** A camera that orbits the point it looks at. */
export interface RoughCamera {
  /** The point the camera looks at. */
  target: Vec3;
  /** Turn round the vertical axis, radians: 0 looks from +z towards -z. */
  yaw: number;
  /** Tilt, radians: above 0 looks down from above, below 0 up from below. */
  pitch: number;
  /** Metres from the target. */
  distance: number;
  /** The vertical angle of view, degrees: small is a long lens, large a wide one. */
  fov: number;
}

/** A person of the rough, posed in its own space and placed on the set. */
export interface RoughPerson {
  id: string;
  /** The point below the middle of the hips; y lifts the soles (a person on a stage or a chair). */
  x: number;
  y: number;
  z: number;
  /** Turn round the vertical axis, radians: 0 faces +z, towards a camera with no yaw. */
  yaw: number;
  /** The 18 OpenPose joints in the person's own space, x, y and z each: y up from the soles, +z the way the person faces, their right side at -x. */
  joints: number[];
}

/** A prop of the set: a box (a desk, a bed, a car), a plane (a wall, a door, a board) or a cylinder (a pillar, a tree trunk). */
export interface RoughProp {
  id: string;
  shape: RoughShape;
  /** The middle of its bottom. */
  x: number;
  y: number;
  z: number;
  /** Turn round the vertical axis, radians. */
  yaw: number;
  /** Width, height and depth: a plane is upright and has no depth, a cylinder's width is its diameter. */
  w: number;
  h: number;
  d: number;
}

export interface ComicRough {
  camera: RoughCamera;
  people: RoughPerson[];
  props: RoughProp[];
  /** Whether the set has a floor (y = 0), which the depth map shows falling away to the horizon. */
  floor: boolean;
}

export const ROUGH_PEOPLE_MAX = 8;
export const ROUGH_PROPS_MAX = 32;
/** How far from the middle of the set anything may stand, in metres. */
export const ROUGH_EXTENT = 50;
export const ROUGH_SIZE = { min: 0.02, max: 30 };
export const ROUGH_FOV = { min: 10, max: 100 };
export const ROUGH_DISTANCE = { min: 0.2, max: 80 };
/** The camera tilts at most this far up or down (radians): straight down has no direction for the picture's top. */
export const ROUGH_PITCH_MAX = 1.4;
/** How far a joint may be from the person's own origin, in metres. */
const JOINT_EXTENT = 4;
const JOINT_COUNT = 18;

/**
 * A person of about 1.7 m standing straight, facing +z, arms down: the canvas's standing pose in metres, with the face in
 * front of the head (the nose and eyes forward, the ears at its sides), so a person seen from behind hides the face.
 */
const STANDING: readonly number[] = [
  0, 1.565, 0.1, 0, 1.4, 0, -0.18, 1.4, 0, -0.231, 1.12, 0, -0.264, 0.872, 0, 0.18, 1.4, 0, 0.231, 1.12, 0, 0.264, 0.872, 0,
  -0.099, 0.872, 0, -0.107, 0.476, 0, -0.116, 0.08, 0, 0.099, 0.872, 0, 0.107, 0.476, 0, 0.116, 0.08, 0,
  -0.041, 1.598, 0.085, 0.041, 1.598, 0.085, -0.099, 1.582, 0, 0.099, 1.582, 0,
];

export const standingJoints = (): number[] => [...STANDING];

const roughId = (prefix: string) => `${prefix}-${randomUuid()}`;

/** A camera at chest height a few metres in front of the middle of the set, which shows a standing person whole. */
export const defaultCamera = (): RoughCamera => ({ target: { x: 0, y: 0.85, z: 0 }, yaw: 0, pitch: 0.08, distance: 2.9, fov: 40 });

export function newPerson(x = 0, z = 0, yaw = 0): RoughPerson {
  return { id: roughId('person'), x, y: 0, z, yaw, joints: standingJoints() };
}

/** The sizes a new prop starts with: a desk, a wall, a pillar. */
const PROP_SIZE: Record<RoughShape, { w: number; h: number; d: number }> = {
  box: { w: 1.2, h: 0.75, d: 0.6 },
  plane: { w: 4, h: 2.5, d: 0 },
  cylinder: { w: 0.4, h: 2.5, d: 0.4 },
};

export function newProp(shape: RoughShape, x = 0, z = 0, yaw = 0): RoughProp {
  return { id: roughId('prop'), shape, x, y: 0, z, yaw, ...PROP_SIZE[shape] };
}

/** A rough with one standing person on a floor. */
export const newRough = (): ComicRough => ({ camera: defaultCamera(), people: [newPerson()], props: [], floor: true });

// Reading --------------------------------------------------------------------------------------------------------

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const round = (v: number, decimals: number) => Math.round(v * 10 ** decimals) / 10 ** decimals;
/** A number held to a range and rounded to `decimals` (a millimetre, a tenth of a milliradian), or `fallback` when it is not a number. */
const num = (v: unknown, range: { min: number; max: number }, fallback: number, decimals = 3) =>
  round(finite(v) ? Math.min(range.max, Math.max(range.min, v)) : fallback, decimals);
const ANGLE = { min: -Math.PI * 4, max: Math.PI * 4 };
const PLACE = { min: -ROUGH_EXTENT, max: ROUGH_EXTENT };
const id = (v: unknown, prefix: string) => (typeof v === 'string' && v && v.length <= 80 ? v : roughId(prefix));

function parseCamera(v: unknown): RoughCamera {
  const fallback = defaultCamera();
  if (!isObject(v)) return fallback;
  const target = isObject(v.target) ? v.target : {};
  return {
    target: { x: num(target.x, PLACE, fallback.target.x), y: num(target.y, PLACE, fallback.target.y), z: num(target.z, PLACE, fallback.target.z) },
    yaw: num(v.yaw, ANGLE, fallback.yaw, 4),
    pitch: num(v.pitch, { min: -ROUGH_PITCH_MAX, max: ROUGH_PITCH_MAX }, fallback.pitch, 4),
    distance: num(v.distance, ROUGH_DISTANCE, fallback.distance),
    fov: num(v.fov, ROUGH_FOV, fallback.fov, 1),
  };
}

function parsePerson(v: unknown): RoughPerson | null {
  if (!isObject(v) || !Array.isArray(v.joints) || v.joints.length !== JOINT_COUNT * 3 || !v.joints.every(finite)) return null;
  return {
    id: id(v.id, 'person'),
    x: num(v.x, PLACE, 0),
    y: num(v.y, PLACE, 0),
    z: num(v.z, PLACE, 0),
    yaw: num(v.yaw, ANGLE, 0, 4),
    joints: (v.joints as number[]).map((j) => num(j, { min: -JOINT_EXTENT, max: JOINT_EXTENT }, 0)),
  };
}

function parseProp(v: unknown): RoughProp | null {
  if (!isObject(v) || !ROUGH_SHAPES.includes(v.shape as RoughShape)) return null;
  const shape = v.shape as RoughShape;
  const size = PROP_SIZE[shape];
  return {
    id: id(v.id, 'prop'),
    shape,
    x: num(v.x, PLACE, 0),
    y: num(v.y, PLACE, 0),
    z: num(v.z, PLACE, 0),
    yaw: num(v.yaw, ANGLE, 0, 4),
    w: num(v.w, ROUGH_SIZE, size.w),
    h: num(v.h, ROUGH_SIZE, size.h),
    d: shape === 'plane' ? 0 : num(v.d, ROUGH_SIZE, size.d),
  };
}

/** Keeps the first of each id, and at most `max`. */
function unique<T extends { id: string }>(list: (T | null)[], max: number): T[] {
  const seen = new Set<string>();
  return list.filter((x): x is T => x !== null && !seen.has(x.id) && !!seen.add(x.id)).slice(0, max);
}

/** A rough read from a saved document, every number in its range; undefined when there is none. */
export function parseRough(v: unknown): ComicRough | undefined {
  if (!isObject(v)) return undefined;
  return {
    camera: parseCamera(v.camera),
    people: unique((Array.isArray(v.people) ? v.people : []).map(parsePerson), ROUGH_PEOPLE_MAX),
    props: unique((Array.isArray(v.props) ? v.props : []).map(parseProp), ROUGH_PROPS_MAX),
    floor: v.floor !== false,
  };
}
