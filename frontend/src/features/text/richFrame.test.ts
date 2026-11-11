// The frame of a "finish with AI" run: sizes, aspect limits and the one scale.
import { describe, expect, it } from 'vitest';
import { FRAME_MARGIN, richFrame } from './richFrame';

const AREA = 1024 * 1024;

describe('richFrame', () => {
  it('gives a picture with sides that are multiples of 16 and at least 512', { tags: ['boundary'] }, () => {
    for (const [hw, hh, size] of [
      [300, 60, 100],
      [60, 300, 100],
      [40, 40, 24],
      [900, 900, 300],
    ] as const) {
      const f = richFrame({ hw, hh }, size, AREA);
      expect(f.width % 16).toBe(0);
      expect(f.height % 16).toBe(0);
      expect(f.width).toBeGreaterThanOrEqual(512);
      expect(f.height).toBeGreaterThanOrEqual(512);
      expect(f.width).toBeLessThanOrEqual(2048);
      expect(f.height).toBeLessThanOrEqual(2048);
    }
  });

  it('keeps the letters and their margin inside the picture, never stretched', { tags: ['equivalence'] }, () => {
    const half = { hw: 320, hh: 70 };
    const f = richFrame(half, 96, AREA);
    expect(f.boxWidth * f.scale).toBeCloseTo(f.width, 6);
    expect(f.boxHeight * f.scale).toBeCloseTo(f.height, 6);
    expect(f.boxWidth).toBeGreaterThanOrEqual(half.hw * 2 + 96 * FRAME_MARGIN * 2 - 1e-6);
    expect(f.boxHeight).toBeGreaterThanOrEqual(half.hh * 2 + 96 * FRAME_MARGIN * 2 - 1e-6);
  });

  it('limits the aspect to 3:1 by growing the short side', { tags: ['boundary'] }, () => {
    const wide = richFrame({ hw: 1000, hh: 20 }, 40, AREA);
    expect(wide.width / wide.height).toBeLessThanOrEqual(3.1);
    expect(wide.boxHeight).toBeGreaterThan(40 + 20);
    const tall = richFrame({ hw: 20, hh: 1000 }, 40, AREA);
    expect(tall.height / tall.width).toBeLessThanOrEqual(3.1);
  });

  it('draws near the model area for letters of an ordinary shape', { tags: ['equivalence'] }, () => {
    const f = richFrame({ hw: 250, hh: 100 }, 100, AREA);
    expect((f.width * f.height) / AREA).toBeGreaterThan(0.85);
    expect((f.width * f.height) / AREA).toBeLessThan(1.2);
  });

  it('makes a small model area at least 512 on each side', { tags: ['boundary'] }, () => {
    const f = richFrame({ hw: 100, hh: 100 }, 50, 256 * 256);
    expect(f.width).toBe(512);
    expect(f.height).toBe(512);
  });

  it('is the same for the same input', { tags: ['equivalence'] }, () => {
    expect(richFrame({ hw: 12, hh: 34 }, 20, AREA)).toEqual(richFrame({ hw: 12, hh: 34 }, 20, AREA));
  });
});
