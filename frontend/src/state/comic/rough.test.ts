import { describe, expect, it } from 'vitest';
import { defaultCamera, newPerson, newProp, newRough, parseRough, ROUGH_FOV, ROUGH_PEOPLE_MAX, ROUGH_PITCH_MAX, ROUGH_PROPS_MAX, standingJoints } from './rough';

describe('a stored 3D rough', () => {
  it('is nothing when it is not an object', () => {
    expect(parseRough(undefined)).toBeUndefined();
    expect(parseRough('rough')).toBeUndefined();
    expect(parseRough([])).toBeUndefined();
  });

  it('starts a new rough with one standing person on a floor', () => {
    const rough = newRough();
    expect(rough.people).toHaveLength(1);
    expect(rough.people[0]!.joints).toEqual(standingJoints());
    expect(rough.props).toEqual([]);
    expect(rough.floor).toBe(true);
    expect(parseRough(JSON.parse(JSON.stringify(rough)))).toEqual(rough);
  });

  it('keeps the camera in range and takes the default for what is missing', () => {
    const rough = parseRough({ camera: { fov: 500, pitch: -9, distance: 'far', target: { x: 1.23456, y: 'up' } } })!;
    expect(rough.camera.fov).toBe(ROUGH_FOV.max);
    expect(rough.camera.pitch).toBe(-ROUGH_PITCH_MAX);
    expect(rough.camera.distance).toBe(defaultCamera().distance);
    expect(rough.camera.target).toEqual({ x: 1.235, y: defaultCamera().target.y, z: 0 });
    expect(parseRough({ camera: 'front' })!.camera).toEqual(defaultCamera());
  });

  it('drops a person whose joints are not 54 numbers, and keeps the first of an id', () => {
    const person = newPerson(1, 2, 0.5);
    const rough = parseRough({
      people: [person, { ...person, x: 9 }, { ...newPerson(), joints: [1, 2, 3] }, { ...newPerson(), joints: [...standingJoints().slice(1), Number.NaN] }],
    })!;
    expect(rough.people).toEqual([person]);
  });

  it('keeps at most the limits of people and props', () => {
    const rough = parseRough({
      people: Array.from({ length: ROUGH_PEOPLE_MAX + 3 }, () => newPerson()),
      props: Array.from({ length: ROUGH_PROPS_MAX + 3 }, () => newProp('box')),
    })!;
    expect(rough.people).toHaveLength(ROUGH_PEOPLE_MAX);
    expect(rough.props).toHaveLength(ROUGH_PROPS_MAX);
  });

  it('reads the props it knows, a plane without depth, sizes in range and a floor unless it is off', () => {
    const rough = parseRough({
      props: [{ ...newProp('plane'), d: 3 }, { ...newProp('box'), w: -1, h: 1e9 }, { ...newProp('box'), shape: 'cone' }],
      floor: false,
    })!;
    expect(rough.props.map((p) => p.shape)).toEqual(['plane', 'box']);
    expect(rough.props[0]!.d).toBe(0);
    expect(rough.props[1]!.w).toBe(0.02);
    expect(rough.props[1]!.h).toBe(30);
    expect(rough.floor).toBe(false);
    expect(parseRough({})!.floor).toBe(true);
  });

  it('rounds places to millimetres and turns to a tenth of a milliradian', () => {
    const rough = parseRough({ people: [{ ...newPerson(), x: 0.1 + 0.2, yaw: 1.234567 }] })!;
    expect(rough.people[0]!.x).toBe(0.3);
    expect(rough.people[0]!.yaw).toBe(1.2346);
  });
});
