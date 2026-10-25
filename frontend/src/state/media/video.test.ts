import { describe, expect, it } from 'vitest';
import { framesFor } from './video';

describe('framesFor', () => {
  it('gives a 4n + 1 frame count for the length', () => {
    expect(framesFor(2, 24)).toBe(45);
    expect(framesFor(1, 16)).toBe(13);
    for (const [s, fps] of [
      [1, 8],
      [3, 25],
      [7, 30],
    ] as const)
      expect((framesFor(s, fps) - 1) % 4).toBe(0);
  });

  it('stays within what the model accepts', () => {
    expect(framesFor(0, 24)).toBe(5);
    expect(framesFor(100, 30)).toBe(241);
  });
});
