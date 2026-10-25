// Deterministic helpers. The mock never uses Math.random for content so the same input gives the same image.

export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The largest seed, inclusive: seeds run from 0 to MAX_SEED (the full u32 range). */
export const MAX_SEED = 4294967295;
const SEED_SPAN = MAX_SEED + 1;

/** Non-deterministic seed for "random seed" mode, anywhere in 0..=MAX_SEED. */
export function randomSeed(): number {
  return Math.floor(Math.random() * SEED_SPAN);
}

/** Seed of the i-th item of a batch: seed + i, wrapping from MAX_SEED to 0 (same as the Rust backend). */
export function batchSeed(seed: number, i: number): number {
  return ((seed % SEED_SPAN) + i) % SEED_SPAN;
}
