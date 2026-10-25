// Fuzz and round-trip tests for the face rig pose text. In-process only (no network).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check, junkStored } from '@/propertyTest.testkit';
import { parseRig, serializeRig, type RigState } from './rig';

const axis = fc.stringMatching(/^[a-z]{1,6}$/);
const weight = fc.integer({ min: -100000, max: 100000 }).map((n) => n / 100000);
const rig: fc.Arbitrary<RigState> = fc.record({
  w: fc.dictionary(axis, weight, { maxKeys: 5 }),
  p: fc.dictionary(axis, weight, { maxKeys: 5 }),
  rot: fc.tuple(weight, weight, weight),
});
const finite = (n: number) => Number.isFinite(n);

describe('face rig pose (properties)', () => {
  it('parseRig never throws and always returns a pose of finite numbers, for any text', () => {
    check(
      fc.property(junkStored, (text) => {
        const r = parseRig(text);
        expect(Object.values(r.w).every(finite)).toBe(true);
        expect(Object.values(r.p).every(finite)).toBe(true);
        expect(r.rot).toHaveLength(3);
        expect(r.rot.every(finite)).toBe(true);
      }),
    );
  });

  it('a pose survives serialise and parse (small values below 0.0001 count as zero)', () => {
    check(
      fc.property(rig, (r) => {
        const back = parseRig(serializeRig(r));
        for (const k of Object.keys(back.w)) expect(Math.abs(back.w[k]! - (r.w[k] ?? 0))).toBeLessThan(1e-5);
        for (const k of Object.keys(r.w)) expect(Math.abs((back.w[k] ?? 0) - r.w[k]!)).toBeLessThan(1.1e-4);
        r.rot.forEach((v, i) => expect(Math.abs(back.rot[i]! - v)).toBeLessThan(1e-5));
        // serialising what was parsed again changes nothing
        expect(serializeRig(back)).toBe(serializeRig(parseRig(serializeRig(back))));
      }),
    );
  });

  it('the untouched pose serialises to an empty text', () => {
    expect(serializeRig({ w: {}, p: {}, rot: [0, 0, 0] })).toBe('');
  });
});
