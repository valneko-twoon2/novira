import { describe, expect, it } from 'vitest';
import { newPerson, newProp, newRough, ROUGH_PEOPLE_MAX, ROUGH_PROPS_MAX, type ComicRough } from './rough';
import { addPerson, addProp, changePerson, changeProp, personSize, removeThing, resetCamera, resizePerson } from './roughEdit';
import { cameraFrame } from './roughView';

const empty = (): ComicRough => ({ ...newRough(), people: [] });

describe('editing a rough from its side panel', () => {
  it('adds people facing the camera, side by side, up to the most a rough holds', () => {
    let rough = { ...empty(), camera: { ...newRough().camera, yaw: 0.5 } };
    const ids: string[] = [];
    for (let i = 0; i < ROUGH_PEOPLE_MAX; i++) {
      const added = addPerson(rough);
      rough = added.rough;
      ids.push(added.id!);
    }
    expect(rough.people.map((p) => p.id)).toEqual(ids);
    expect(rough.people.every((p) => p.yaw === 0.5)).toBe(true);
    expect(new Set(rough.people.map((p) => `${p.x},${p.z}`)).size).toBe(ROUGH_PEOPLE_MAX);
    const full = addPerson(rough);
    expect(full).toEqual({ rough, id: null });
  });

  it('stands a new board behind what the camera looks at, and a new box beside it', () => {
    const rough = empty();
    const { forward } = cameraFrame(rough.camera);
    const board = addProp(rough, 'plane').rough.props[0]!;
    // Further from the camera than the target, in the middle.
    expect(board.x * forward.x + board.z * forward.z).toBeGreaterThan(1);
    // Beside the person standing in the middle, not on it.
    const box = addProp(newRough(), 'box').rough.props[0]!;
    expect(Math.hypot(box.x, box.z)).toBeGreaterThan(0.5);
  });

  it('adds no prop to a rough that has the most', () => {
    const rough = { ...empty(), props: Array.from({ length: ROUGH_PROPS_MAX }, () => newProp('box')) };
    expect(addProp(rough, 'cylinder')).toEqual({ rough, id: null });
  });

  it('removes a person or a prop by its id', () => {
    const person = newPerson();
    const prop = newProp('box');
    const rough = { ...empty(), people: [person], props: [prop] };
    expect(removeThing(rough, person.id).people).toEqual([]);
    expect(removeThing(rough, prop.id).props).toEqual([]);
    expect(removeThing(rough, 'gone')).toEqual(rough);
  });

  it('keeps a prop in range when it is changed, and a plane without depth', () => {
    const box = newProp('box');
    const plane = newProp('plane');
    const rough = { ...empty(), props: [box, plane] };
    const changed = changeProp(rough, box.id, { w: 0, h: 99, y: -1, yaw: 1 }).props[0]!;
    expect(changed).toMatchObject({ w: 0.02, h: 30, y: 0, yaw: 1 });
    expect(changeProp(rough, plane.id, { d: 2 }).props[1]!.d).toBe(0);
  });

  it('turns and lifts a person, never below the floor', () => {
    const person = newPerson();
    const rough = { ...empty(), people: [person] };
    expect(changePerson(rough, person.id, { yaw: 2 }).people[0]!.yaw).toBe(2);
    expect(changePerson(rough, person.id, { y: -3 }).people[0]!.y).toBe(0);
    expect(changePerson(rough, person.id, { y: 0.45 }).people[0]!.y).toBe(0.45);
  });

  it('turns a person stood up below the floor without lifting it', () => {
    // A flat pose stood up in front of the camera may stand below the floor; turning it lifted it there.
    const low = { ...newPerson(), y: -0.13 };
    expect(changePerson({ ...empty(), people: [low] }, low.id, { yaw: 1 }).people[0]!.y).toBe(-0.13);
  });

  it('comes back to an adult after many changes of size', () => {
    // Dividing by the whole percent shown grew an error at every change.
    const person = newPerson();
    let rough = { ...empty(), people: [person] };
    for (const percent of [43, 127, 61, 119, 47, 113, 100]) rough = resizePerson(rough, person.id, percent);
    const neck = (p: { joints: number[] }) => p.joints.slice(3, 6);
    neck(rough.people[0]!).forEach((v, k) => expect(v).toBeCloseTo(neck(person)[k]!, 2));
  });

  it('sizes a person against an adult, round the soles, within the limits', () => {
    const person = newPerson();
    const rough = { ...empty(), people: [person] };
    expect(personSize(person)).toBe(100);
    const child = resizePerson(rough, person.id, 70).people[0]!;
    expect(personSize(child)).toBe(70);
    // The soles stay on the floor: the lowest joint keeps its share of the height.
    expect(Math.min(...child.joints.filter((_, i) => i % 3 === 1))).toBeCloseTo(0.08 * 0.7, 2);
    expect(personSize(resizePerson(rough, person.id, 500).people[0]!)).toBe(130);
  });

  it('puts the camera back where a new rough has it', () => {
    const rough = { ...newRough(), camera: { ...newRough().camera, yaw: 2, distance: 9 } };
    expect(resetCamera(rough).camera).toEqual(newRough().camera);
  });
});
