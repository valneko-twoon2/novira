// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_MANGA, MANGA_KEYS, MANGA_RANGE, restoreManga, useMangaFinish } from './mangaFinish';

beforeEach(() => {
  localStorage.clear();
  useMangaFinish.getState().reset();
});

describe('the manga finish values', () => {
  it('start at the node defaults, which lie inside the ranges', () => {
    expect(useMangaFinish.getState().values).toEqual({ screenLines: 200, whitePoint: 0.8, blackPoint: 0.3, gradation: 1, whiteLines: 0.4 });
    for (const key of MANGA_KEYS) {
      expect(DEFAULT_MANGA[key]).toBeGreaterThanOrEqual(MANGA_RANGE[key].min);
      expect(DEFAULT_MANGA[key]).toBeLessThanOrEqual(MANGA_RANGE[key].max);
    }
  });

  it('change one value at a time, and reset to the defaults', () => {
    useMangaFinish.getState().set({ screenLines: 300 });
    useMangaFinish.getState().set({ blackPoint: 0.5 });
    expect(useMangaFinish.getState().values).toEqual({ ...DEFAULT_MANGA, screenLines: 300, blackPoint: 0.5 });
    useMangaFinish.getState().reset();
    expect(useMangaFinish.getState().values).toEqual(DEFAULT_MANGA);
  });

  it('are kept across starts', () => {
    useMangaFinish.getState().set({ whiteLines: 0.9 });
    const saved = JSON.parse(localStorage.getItem('novira.mangaFinish')!);
    expect(saved.state.values.whiteLines).toBe(0.9);
  });

  it('are read back value by value: a wrong kind keeps the default, a number is held to its range', () => {
    expect(restoreManga({ values: { screenLines: 9999, whitePoint: 'x', blackPoint: -1, gradation: Number.NaN, whiteLines: 0.7, extra: 1 } })).toEqual({
      ...DEFAULT_MANGA,
      screenLines: 600,
      blackPoint: 0,
      whiteLines: 0.7,
    });
    expect(restoreManga(null)).toEqual(DEFAULT_MANGA);
    expect(restoreManga({ values: 3 })).toEqual(DEFAULT_MANGA);
  });
});
