// The edits the rough's side panel makes: adding a person or a prop in front of the camera, removing one, turning, lifting
// and sizing them, and putting the camera back. Each takes a rough and gives a new one.
import { J } from '@/state/pose/pose';
import { defaultCamera, newPerson, newProp, ROUGH_PEOPLE_MAX, ROUGH_PROPS_MAX, ROUGH_SIZE, standingJoints, type ComicRough, type RoughPerson, type RoughProp, type RoughShape } from './rough';
import { cameraFrame, mm } from './roughView';

/**
 * Where a new thing stands: below what the camera looks at, each one further to a side than the last, so they do not
 * overlap; a plane (a wall, a board) stands behind it all instead, as a background.
 */
function spot(rough: ComicRough, shape?: RoughShape): { x: number; z: number } {
  const { right, forward } = cameraFrame(rough.camera);
  const target = rough.camera.target;
  if (shape === 'plane') {
    const back = 2 + rough.props.filter((p) => p.shape === 'plane').length * 0.5;
    return { x: mm(target.x + forward.x * back), z: mm(target.z + forward.z * back) };
  }
  const count = rough.people.length + rough.props.filter((p) => p.shape !== 'plane').length;
  const side = (count % 2 ? 1 : -1) * Math.ceil(count / 2) * 1.2;
  return { x: mm(target.x + right.x * side), z: mm(target.z + right.z * side) };
}

/** A standing person added facing the camera, and its id; the rough as it was when it already has the most people. */
export function addPerson(rough: ComicRough): { rough: ComicRough; id: string | null } {
  if (rough.people.length >= ROUGH_PEOPLE_MAX) return { rough, id: null };
  const { x, z } = spot(rough);
  const person = newPerson(x, z, rough.camera.yaw);
  return { rough: { ...rough, people: [...rough.people, person] }, id: person.id };
}

/** A prop added square to the camera, and its id; the rough as it was when it already has the most props. */
export function addProp(rough: ComicRough, shape: RoughShape): { rough: ComicRough; id: string | null } {
  if (rough.props.length >= ROUGH_PROPS_MAX) return { rough, id: null };
  const { x, z } = spot(rough, shape);
  const prop = newProp(shape, x, z, rough.camera.yaw);
  return { rough: { ...rough, props: [...rough.props, prop] }, id: prop.id };
}

export function removeThing(rough: ComicRough, id: string): ComicRough {
  return { ...rough, people: rough.people.filter((p) => p.id !== id), props: rough.props.filter((p) => p.id !== id) };
}

const size = (v: number) => mm(Math.min(ROUGH_SIZE.max, Math.max(ROUGH_SIZE.min, v)));

/** A prop with some of its turn, lift and sizes changed, each kept in its range (a plane keeps no depth). */
export function changeProp(rough: ComicRough, id: string, patch: Partial<Pick<RoughProp, 'yaw' | 'y' | 'w' | 'h' | 'd'>>): ComicRough {
  return {
    ...rough,
    props: rough.props.map((p) => {
      if (p.id !== id) return p;
      const next = { ...p, ...patch };
      return { ...next, y: mm(Math.max(0, next.y)), w: size(next.w), h: size(next.h), d: p.shape === 'plane' ? 0 : size(next.d) };
    }),
  };
}

/**
 * A person with its turn or lift changed. Only a lift given is kept off the floor's underside: a person stood up from a flat
 * pose may stand below the floor (see liftPoses), and turning it must not move it.
 */
export function changePerson(rough: ComicRough, id: string, patch: Partial<Pick<RoughPerson, 'yaw' | 'y'>>): ComicRough {
  return {
    ...rough,
    people: rough.people.map((p) => (p.id === id ? { ...p, ...patch, ...(patch.y === undefined ? {} : { y: mm(Math.max(0, patch.y)) }) } : p)),
  };
}

/** The length of the torso, from the neck to the middle of the hips: a bone length, so bending a person does not change it. */
function torso(joints: readonly number[]): number {
  const at = (i: number, k: number) => joints[i * 3 + k] ?? 0;
  const hip = (k: number) => (at(J.rHip, k) + at(J.lHip, k)) / 2;
  return Math.hypot(at(J.neck, 0) - hip(0), at(J.neck, 1) - hip(1), at(J.neck, 2) - hip(2));
}
const ADULT_TORSO = torso(standingJoints());

/** How big a person is against an adult, in percent (a child is smaller), unrounded. */
const exactSize = (person: Pick<RoughPerson, 'joints'>): number => (torso(person.joints) / ADULT_TORSO) * 100;

/** How big a person is against an adult, in whole percent, as the panel shows it. */
export const personSize = (person: Pick<RoughPerson, 'joints'>): number => Math.round(exactSize(person));

/** The most and the least a person can be sized, in percent of an adult. */
export const PERSON_SIZE = { min: 40, max: 130 };

/** A person grown or shrunk to `percent` of an adult, round its own soles, so it keeps standing where it stood. */
export function resizePerson(rough: ComicRough, id: string, percent: number): ComicRough {
  const target = Math.min(PERSON_SIZE.max, Math.max(PERSON_SIZE.min, percent));
  return {
    ...rough,
    people: rough.people.map((p) => {
      if (p.id !== id) return p;
      // The size it has, not the whole percent shown: dividing by a rounded size grew an error at every change.
      const now = exactSize(p);
      if (now <= 0) return p;
      const k = target / now;
      return { ...p, joints: p.joints.map((v) => mm(v * k)) };
    }),
  };
}

/** The camera as a new rough has it, looking at the middle of the set. */
export const resetCamera = (rough: ComicRough): ComicRough => ({ ...rough, camera: defaultCamera() });
