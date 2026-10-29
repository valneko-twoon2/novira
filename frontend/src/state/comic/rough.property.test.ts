// Whatever a saved document holds as a rough, reading it never throws and gives a rough every number of which is in its
// range, with unique ids and no more people and props than the limits; reading what was read changes nothing.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { blockExternalNetwork, check } from '@/propertyTest.testkit';
import { newRough, parseRough, ROUGH_DISTANCE, ROUGH_EXTENT, ROUGH_FOV, ROUGH_PEOPLE_MAX, ROUGH_PITCH_MAX, ROUGH_PROPS_MAX, ROUGH_SIZE, type ComicRough } from './rough';

blockExternalNetwork();

const inside = (v: number, min: number, max: number) => Number.isFinite(v) && v >= min && v <= max;

/** A document that looks like a rough but has numbers of every size and kind, and fields of the wrong type. */
const wild = fc.oneof(fc.double({ noNaN: false }), fc.integer(), fc.string(), fc.constant(null), fc.boolean());
const person = fc.record(
  { id: fc.oneof(fc.string({ maxLength: 100 }), wild), x: wild, y: wild, z: wild, yaw: wild, joints: fc.oneof(fc.array(wild, { maxLength: 60 }), wild) },
  { requiredKeys: [] },
);
const prop = fc.record({ id: wild, shape: fc.constantFrom('box', 'plane', 'cylinder', 'sphere', 1), x: wild, y: wild, z: wild, yaw: wild, w: wild, h: wild, d: wild }, { requiredKeys: [] });
const document = fc.record(
  {
    camera: fc.oneof(fc.record({ target: fc.record({ x: wild, y: wild, z: wild }, { requiredKeys: [] }), yaw: wild, pitch: wild, distance: wild, fov: wild }, { requiredKeys: [] }), wild),
    people: fc.oneof(fc.array(person, { maxLength: 12 }), wild),
    props: fc.oneof(fc.array(prop, { maxLength: 40 }), wild),
    floor: wild,
  },
  { requiredKeys: [] },
);

function assertSane(r: ComicRough) {
  const c = r.camera;
  expect(inside(c.distance, ROUGH_DISTANCE.min, ROUGH_DISTANCE.max)).toBe(true);
  expect(inside(c.fov, ROUGH_FOV.min, ROUGH_FOV.max)).toBe(true);
  expect(inside(c.pitch, -ROUGH_PITCH_MAX, ROUGH_PITCH_MAX)).toBe(true);
  for (const v of [c.target.x, c.target.y, c.target.z]) expect(inside(v, -ROUGH_EXTENT, ROUGH_EXTENT)).toBe(true);
  expect(r.people.length).toBeLessThanOrEqual(ROUGH_PEOPLE_MAX);
  expect(r.props.length).toBeLessThanOrEqual(ROUGH_PROPS_MAX);
  const ids = [...r.people, ...r.props].map((x) => x.id);
  expect(new Set(r.people.map((x) => x.id)).size).toBe(r.people.length);
  expect(new Set(r.props.map((x) => x.id)).size).toBe(r.props.length);
  expect(ids.every((i) => i.length > 0 && i.length <= 80)).toBe(true);
  for (const p of r.people) {
    expect(p.joints).toHaveLength(54);
    for (const v of [p.x, p.y, p.z, ...p.joints]) expect(Number.isFinite(v)).toBe(true);
  }
  for (const p of r.props) {
    for (const v of [p.w, p.h]) expect(inside(v, ROUGH_SIZE.min, ROUGH_SIZE.max)).toBe(true);
    expect(p.shape === 'plane' ? p.d === 0 : inside(p.d, ROUGH_SIZE.min, ROUGH_SIZE.max)).toBe(true);
  }
}

describe('reading a rough (properties)', () => {
  it('gives nothing for what is not an object, and a sane rough for any object', () => {
    check(
      fc.property(fc.oneof(document, fc.anything()), (v) => {
        const r = parseRough(v);
        if (r) assertSane(r);
        else expect(typeof v !== 'object' || v === null || Array.isArray(v)).toBe(true);
      }),
    );
  });

  it('settles after one reading: reading a read rough gives the same rough', () => {
    check(
      fc.property(document, (v) => {
        // Through JSON, as a saved document is (a minus zero is saved as zero).
        const once = JSON.parse(JSON.stringify(parseRough(v)!)) as ComicRough;
        expect(JSON.parse(JSON.stringify(parseRough(once)))).toEqual(once);
      }),
    );
  });

  it('keeps a new rough as it is', () => {
    const r = newRough();
    expect(parseRough(JSON.parse(JSON.stringify(r)))).toEqual(r);
  });
});
