// @vitest-environment jsdom
// The raster filters: the blur margin, the CSS filter given to the context, and the output size.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { clampBlurRadius, cssFilter, filterCanvas, filterMargin, MAX_BLUR_RADIUS } from './rasterFilter';

let canvases: ReturnType<typeof installRecordingCanvases>;
beforeEach(() => {
  canvases = installRecordingCanvases();
});
afterEach(() => canvases.restore());

describe('raster filter settings', () => {
  it('keeps the blur radius a whole number between 1 and 100', () => {
    expect(clampBlurRadius(0)).toBe(1);
    expect(clampBlurRadius(2.6)).toBe(3);
    expect(clampBlurRadius(1e9)).toBe(MAX_BLUR_RADIUS);
  });

  it('gives a blur a margin of three radii and the others none', () => {
    expect(filterMargin({ kind: 'blur', radius: 10 })).toBe(30);
    expect(filterMargin({ kind: 'blur', radius: 0 })).toBe(3);
    expect(filterMargin({ kind: 'grayscale' })).toBe(0);
    expect(filterMargin({ kind: 'invert' })).toBe(0);
  });

  it('names the CSS filter of each kind', () => {
    expect(cssFilter({ kind: 'blur', radius: 6 })).toBe('blur(6px)');
    expect(cssFilter({ kind: 'grayscale' })).toBe('grayscale(1)');
    expect(cssFilter({ kind: 'invert' })).toBe('invert(1)');
  });
});

describe('filterCanvas', () => {
  it('draws the source inside the margin with the filter on, then turns the filter off', () => {
    const source = document.createElement('canvas');
    source.width = 20;
    source.height = 10;
    const out = filterCanvas(source, { kind: 'blur', radius: 2 });
    expect([out.width, out.height]).toEqual([32, 22]);
    const rec = canvases.of(out);
    expect(rec.sets.filter((s) => s.name === 'filter').map((s) => s.value)).toEqual(['blur(2px)', 'none']);
    expect(rec.of('drawImage')).toEqual([[source, 6, 6]]);
  });
});
