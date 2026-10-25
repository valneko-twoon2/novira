import { describe, expect, it } from 'vitest';
import { batchSeed, hashString, MAX_SEED, mulberry32, randomSeed } from './random';

describe('mock random helpers', () => {
  it('hashes a string to the same unsigned 32-bit number every time', () => {
    expect(hashString('a red fox')).toBe(hashString('a red fox'));
    expect(hashString('a red fox')).not.toBe(hashString('a red fax'));
    // FNV-1a of the empty string is its offset basis.
    expect(hashString('')).toBe(0x811c9dc5);
    for (const s of ['', 'x', 'long prompt with words', '猫']) {
      const h = hashString(s);
      expect(Number.isInteger(h) && h >= 0 && h <= 0xffffffff).toBe(true);
    }
  });

  it('repeats the same sequence for the same seed and differs for another seed', () => {
    const take = (seed: number) => {
      const next = mulberry32(seed);
      return Array.from({ length: 5 }, next);
    };
    expect(take(42)).toEqual(take(42));
    expect(take(42)).not.toEqual(take(43));
    for (const v of take(7)) expect(v >= 0 && v < 1).toBe(true);
  });

  it('draws random seeds inside the seed range', () => {
    for (let i = 0; i < 100; i++) {
      const s = randomSeed();
      expect(Number.isInteger(s) && s >= 0 && s <= MAX_SEED).toBe(true);
    }
  });

  it('steps batch seeds as seed + i, keeping MAX_SEED and wrapping after it like the Rust backend', () => {
    expect(batchSeed(MAX_SEED, 0)).toBe(MAX_SEED);
    expect(batchSeed(MAX_SEED - 1, 1)).toBe(MAX_SEED);
    expect(batchSeed(MAX_SEED, 1)).toBe(0);
    expect(batchSeed(7, 3)).toBe(10);
  });
});
