// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The module keeps its loading promises in module variables, so each test imports a fresh copy.
async function load(opts: { faces?: 'ok' | 'fail'; fonts?: string[] | Error } = {}) {
  vi.resetModules();
  const loadedFaces = vi.fn();
  vi.doMock('./appFontFaces', () => {
    if (opts.faces === 'fail') throw new Error('chunk missing');
    loadedFaces();
    return {};
  });
  const fonts = await import('./fonts');
  const { backend } = await import('@/backend');
  const { useDevLog } = await import('./devLog');
  useDevLog.setState({ entries: [] });
  const listFonts = vi.spyOn(backend, 'listFonts').mockImplementation(async () => {
    if (opts.fonts instanceof Error) throw opts.fonts;
    return opts.fonts ?? [];
  });
  return { ...fonts, loadedFaces, listFonts, useDevLog };
}

beforeEach(() => vi.useRealTimers());
afterEach(() => {
  vi.doUnmock('./appFontFaces');
  vi.restoreAllMocks();
  delete (document as { fonts?: unknown }).fonts;
});

describe('font definitions', () => {
  it('finds the app fonts, and falls back to the first one for an unknown family', async () => {
    const f = await load();
    expect(f.isAppFont('Anton')).toBe(true);
    expect(f.isAppFont('Comic Sans MS')).toBe(false);
    expect(f.fontOf('Bangers').family).toBe('Bangers');
    expect(f.fontOf('nope')).toBe(f.FONTS[0]);
  });

  it('snaps a weight to the nearest the font has, the lower one on a tie', async () => {
    const f = await load();
    expect(f.snapWeight('Zen Maru Gothic', 500)).toBe(400);
    expect(f.snapWeight('Zen Maru Gothic', 600)).toBe(700);
    expect(f.snapWeight('Zen Maru Gothic', 1000)).toBe(900);
    expect(f.snapWeight('Anton', 700)).toBe(400);
    expect(f.snapWeight('unknown', 650)).toBe(600);
  });

  it('builds the canvas font value and the CSS stack', async () => {
    const f = await load();
    expect(f.fontCss('Anton', 700, 24)).toBe('400 24px "Anton", "Noto Sans JP Variable", sans-serif');
    expect(f.fontStack('Anton')).toBe('"Anton", "Noto Sans JP Variable", sans-serif');
    expect(f.fontStack(null)).toBeUndefined();
    expect(f.fontStack('')).toBeUndefined();
  });
});

describe('loading the app fonts', () => {
  it('loads the font faces once for any number of callers', async () => {
    const f = await load();
    await Promise.all([f.loadAppFonts(), f.loadAppFonts()]);
    await f.loadAppFonts();
    expect(f.loadedFaces).toHaveBeenCalledTimes(1);
  });

  it('logs a failure, resolves anyway, and tries again next time', async () => {
    const f = await load({ faces: 'fail' });
    await expect(f.loadAppFonts()).resolves.toBeUndefined();
    const entry = f.useDevLog.getState().entries.at(-1)!;
    expect(entry.level).toBe('error');
    expect(entry.message).toContain('could not be loaded');
    await f.loadAppFonts();
    expect(f.useDevLog.getState().entries.length).toBe(2);
  });

  it('useAppFonts is false at first and true once the rules are in', async () => {
    const f = await load();
    const { result } = renderHook(() => f.useAppFonts());
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });
});

describe('ensureFont', () => {
  it('does nothing without document.fonts', async () => {
    const f = await load();
    await f.ensureFont('Anton', 400, 'x');
    expect(f.loadedFaces).not.toHaveBeenCalled();
  });

  it('loads the faces, then asks the browser for the snapped weight with the text', async () => {
    const f = await load();
    const loadFont = vi.fn().mockResolvedValue([]);
    Object.defineProperty(document, 'fonts', { configurable: true, value: { load: loadFont } });
    await f.ensureFont('Zen Maru Gothic', 500, 'こんにちは');
    expect(f.loadedFaces).toHaveBeenCalledTimes(1);
    expect(loadFont).toHaveBeenCalledWith('400 32px "Zen Maru Gothic"', 'こんにちは');
    await f.ensureFont('Anton', 400, '');
    expect(loadFont).toHaveBeenLastCalledWith('400 32px "Anton"', 'A');
  });

  it('swallows a failure of the browser to load a font', async () => {
    const f = await load();
    Object.defineProperty(document, 'fonts', { configurable: true, value: { load: vi.fn().mockRejectedValue(new Error('bad')) } });
    await expect(f.ensureFont('Anton', 400, 'x')).resolves.toBeUndefined();
  });
});

describe('installed fonts', () => {
  it('reads the list once, leaving out the fonts the app ships', async () => {
    const f = await load({ fonts: ['Arial', 'Anton', 'Meiryo'] });
    expect(f.useInstalledFonts.getState().loaded).toBe(false);
    f.useInstalledFonts.getState().load();
    f.useInstalledFonts.getState().load();
    await waitFor(() => expect(f.useInstalledFonts.getState().loaded).toBe(true));
    expect(f.useInstalledFonts.getState().families).toEqual(['Arial', 'Meiryo']);
    expect(f.listFonts).toHaveBeenCalledTimes(1);
  });

  it('logs when the list cannot be read and counts it as loaded with no fonts', async () => {
    const f = await load({ fonts: new Error('no access') });
    f.useInstalledFonts.getState().load();
    await waitFor(() => expect(f.useInstalledFonts.getState().loaded).toBe(true));
    expect(f.useInstalledFonts.getState().families).toEqual([]);
    expect(f.useDevLog.getState().entries.at(-1)?.message).toContain('no access');
  });
});
