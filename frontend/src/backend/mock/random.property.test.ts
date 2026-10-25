// Property tests for the seed and hash helpers shared with the Rust backend's rules. In-process only (no network).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check, junkText } from '@/propertyTest.testkit';
import { batchSeed, hashString, MAX_SEED, mulberry32, randomSeed } from './random';

const seed = fc.integer({ min: 0, max: MAX_SEED });

describe('seed helpers (properties)', () => {
  it('batchSeed stays in 0..MAX_SEED, starts at the seed and steps by one with wrap-around', () => {
    check(
      fc.property(seed, fc.integer({ min: 0, max: 100_000 }), (s, i) => {
        const v = batchSeed(s, i);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(MAX_SEED);
        expect(batchSeed(s, 0)).toBe(s);
        expect(batchSeed(s, i + 1)).toBe(v === MAX_SEED ? 0 : v + 1);
      }),
    );
  });

  it('batchSeed accepts seeds above the range by wrapping them', () => {
    check(fc.property(fc.integer({ min: MAX_SEED + 1, max: 2 ** 40 }), fc.nat(1000), (s, i) => batchSeed(s, i) <= MAX_SEED));
  });

  it('mulberry32 is deterministic, gives numbers in [0, 1) and any integer seed works', () => {
    check(
      fc.property(fc.integer({ min: -(2 ** 40), max: 2 ** 40 }), (s) => {
        const a = mulberry32(s);
        const b = mulberry32(s);
        for (let k = 0; k < 20; k++) {
          const x = a();
          expect(x).toBe(b());
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(1);
        }
      }),
    );
  });

  it('hashString never throws and is an unsigned 32-bit number', () => {
    check(fc.property(fc.oneof(junkText, fc.string({ unit: 'binary', maxLength: 200 })), (s) => {
      const h = hashString(s);
      return Number.isInteger(h) && h >= 0 && h <= MAX_SEED && hashString(s) === h;
    }));
  });

  it('randomSeed is a valid seed', () => {
    for (let k = 0; k < 200; k++) {
      const s = randomSeed();
      expect(Number.isInteger(s) && s >= 0 && s <= MAX_SEED).toBe(true);
    }
  });
});
