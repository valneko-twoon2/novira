import { describe, expect, it } from 'vitest';
import { COMIC_ZOOM_MAX, COMIC_ZOOM_MIN, stepComicZoom, wheelComicZoom } from './pageZoom';

describe('stepComicZoom', () => {
  it('moves one stop up or down from a stop', () => {
    expect(stepComicZoom(1, 1)).toBe(1.5);
    expect(stepComicZoom(1, -1)).toBe(0.75);
  });

  it('stays at the ends of the stops', () => {
    expect(stepComicZoom(COMIC_ZOOM_MAX, 1)).toBe(COMIC_ZOOM_MAX);
    expect(stepComicZoom(COMIC_ZOOM_MIN, -1)).toBe(COMIC_ZOOM_MIN);
  });

  it('moves from a zoom between two stops to the stop beyond it', () => {
    expect(stepComicZoom(1.2, 1)).toBe(1.5);
    expect(stepComicZoom(1.2, -1)).toBe(1);
  });
});

describe('wheelComicZoom', () => {
  it('zooms in when the wheel goes up and out when it goes down', () => {
    expect(wheelComicZoom(1, -100)).toBeGreaterThan(1);
    expect(wheelComicZoom(1, 100)).toBeLessThan(1);
    expect(wheelComicZoom(1, 0)).toBe(1);
  });

  it('keeps the zoom within its range', () => {
    expect(wheelComicZoom(COMIC_ZOOM_MAX, -10000)).toBe(COMIC_ZOOM_MAX);
    expect(wheelComicZoom(COMIC_ZOOM_MIN, 10000)).toBe(COMIC_ZOOM_MIN);
  });

  it('comes back to the same zoom after the same movement up and down', () => {
    expect(wheelComicZoom(wheelComicZoom(1, -120), 120)).toBeCloseTo(1, 9);
  });
});
