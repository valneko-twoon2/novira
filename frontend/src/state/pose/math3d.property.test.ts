// The maths of the 3D pose: dragging a joint swings its limb round the parent without changing a bone's length, the neck
// moves the whole body by the same step, and turning the view never changes a distance.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { blockExternalNetwork, check } from '@/propertyTest.testkit';
import { add, length3, lengths, sub, swingJoint, turnView, unit, v3, type Vec3 } from './math3d';
import { POSE_PARENT } from './pose';

blockExternalNetwork();

const coord = fc.double({ min: -500, max: 500, noNaN: true });
const vec = fc.record({ x: coord, y: coord, z: coord }) as fc.Arbitrary<Vec3>;
/** A bone offset that is never short, with no axis left at zero. */
const offset = fc.tuple(fc.constantFrom(-1, 1), fc.double({ min: 0.5, max: 3, noNaN: true })).map(([sign, size]) => sign * size);
/** A skeleton: the neck anywhere, every other joint a clear step from its parent (so no two joints sit on one point). */
const joints = fc.tuple(vec, fc.array(fc.tuple(offset, offset, offset), { minLength: 18, maxLength: 18 })).map(([root, steps]) => {
  const out: (Vec3 | undefined)[] = Array.from({ length: 18 }, () => undefined);
  out[1] = root;
  for (let pass = 0; pass < 18; pass++) {
    POSE_PARENT.forEach((parent, i) => {
      const from = parent >= 0 ? out[parent] : undefined;
      if (!out[i] && from) out[i] = add(from, v3(...steps[i]!));
    });
  }
  return out as Vec3[];
});
const close = (a: number, b: number, tolerance = 1e-6) => Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));

describe('swinging a joint (properties)', () => {
  it('keeps the length of every bone', () => {
    check(
      fc.property(joints, fc.integer({ min: 0, max: 17 }), vec, (list, joint, target) => {
        fc.pre(POSE_PARENT[joint]! < 0 || length3(sub(target, list[POSE_PARENT[joint]!]!)) > 1e-3);
        const before = lengths(list);
        const after = lengths(swingJoint(list, joint, target));
        before.forEach((l, i) => expect(close(l, after[i]!, 1e-6)).toBe(true));
      }),
    );
  });

  it('aims the bone at the target', () => {
    check(
      fc.property(joints, fc.integer({ min: 0, max: 17 }).filter((j) => POSE_PARENT[j]! >= 0), vec, (list, joint, target) => {
        const parent = list[POSE_PARENT[joint]!]!;
        fc.pre(length3(sub(target, parent)) > 1e-3);
        const next = swingJoint(list, joint, target);
        const aim = unit(sub(target, parent));
        const got = unit(sub(next[joint]!, next[POSE_PARENT[joint]!]!));
        expect(length3(sub(aim, got))).toBeLessThan(1e-4);
      }),
    );
  });

  it('moves the whole body by one step when the neck is dragged', () => {
    check(
      fc.property(joints, vec, (list, target) => {
        const step = sub(target, list[1]!);
        const next = swingJoint(list, 1, target);
        next.forEach((p, i) => expect(length3(sub(p, add(list[i]!, step)))).toBeLessThan(1e-6));
      }),
    );
  });

  it('leaves the joints where they are when the target is already on the bone', () => {
    check(
      fc.property(joints, fc.integer({ min: 0, max: 17 }).filter((j) => POSE_PARENT[j]! >= 0), fc.double({ min: 0.1, max: 5, noNaN: true }), (list, joint, k) => {
        const parent = list[POSE_PARENT[joint]!]!;
        const onBone = add(parent, v3(...(Object.values(sub(list[joint]!, parent)).map((c) => c * k) as [number, number, number])));
        const next = swingJoint(list, joint, onBone);
        next.forEach((p, i) => expect(length3(sub(p, list[i]!))).toBeLessThan(1e-3));
      }),
    );
  });
});

describe('turning the view (properties)', () => {
  it('never changes the distance from the middle', () => {
    check(fc.property(vec, fc.double({ min: -7, max: 7, noNaN: true }), fc.double({ min: -2, max: 2, noNaN: true }), (p, yaw, pitch) => {
      expect(close(length3(turnView(p, yaw, pitch)), length3(p), 1e-9)).toBe(true);
    }));
  });

  it('is the identity for no turn', () => {
    check(
      fc.property(vec, (p) => {
        expect(length3(sub(turnView(p, 0, 0), p))).toBeLessThan(1e-9);
      }),
    );
  });
});
