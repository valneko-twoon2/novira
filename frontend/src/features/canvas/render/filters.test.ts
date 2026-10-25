// @vitest-environment jsdom
// The simulated control-image preprocessors, run on a canvas whose pixels are a black left half and a white right half.
import { afterEach, describe, expect, it } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { FILTER_TYPES } from '@/state/canvas';
import { applyFilter } from './filters';

const canvases = recorders();
function recorders() {
  let active: ReturnType<typeof installRecordingCanvases> | null = null;
  afterEach(() => active?.restore());
  return {
    start: () => (active = installRecordingCanvases()),
  };
}

/** The pixels the filter wrote with putImageData, for the output canvas. */
function written(out: HTMLCanvasElement, rec: ReturnType<typeof installRecordingCanvases>): Uint8ClampedArray {
  const put = rec.of(out).of('putImageData');
  expect(put).toHaveLength(1);
  return (put[0]![0] as ImageData).data;
}

const source = (w = 8, h = 4) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const at = (d: Uint8ClampedArray, w: number, x: number, y: number) => Array.from(d.slice((y * w + x) * 4, (y * w + x) * 4 + 4));

describe('applyFilter', () => {
  it('offers every filter type', () => {
    expect(FILTER_TYPES.length).toBeGreaterThan(5);
  });

  it('copies the picture for "none"', () => {
    const rec = canvases.start();
    const src = source();
    const out = applyFilter('none', src);
    expect(out.width).toBe(8);
    expect(rec.of(out).of('drawImage')[0]![0]).toBe(src);
  });

  it('shrinks and blows the picture up unsmoothed for color_map', () => {
    const rec = canvases.start();
    const out = applyFilter('color_map', source(96, 96));
    const draws = rec.of(out).of('drawImage');
    expect(draws).toHaveLength(1);
    expect(draws[0]!.slice(1)).toEqual([0, 0, 96, 96]);
    expect(rec.of(out).sets.some((s) => s.name === 'imageSmoothingEnabled' && s.value === false)).toBe(true);
  });

  it('marks only the edge between black and white for canny', () => {
    const rec = canvases.start();
    const out = applyFilter('canny', source());
    const d = written(out, rec);
    expect(at(d, 8, 3, 1)).toEqual([255, 255, 255, 255]);
    expect(at(d, 8, 0, 1)).toEqual([0, 0, 0, 255]);
    expect(at(d, 8, 7, 1)).toEqual([0, 0, 0, 255]);
  });

  it('draws dark lines on white for lineart and light lines on black for hed (after a small blur)', () => {
    const rec = canvases.start();
    const lineart = written(applyFilter('lineart', source()), rec);
    expect(at(lineart, 8, 0, 1)).toEqual([255, 255, 255, 255]);
    expect(lineart[(1 * 8 + 3) * 4]).toBeLessThan(50);

    const hedOut = applyFilter('hed', source());
    const hed = written(hedOut, rec);
    expect(hed[(1 * 8 + 3) * 4]).toBeGreaterThan(200);
    expect(rec.all.some((r) => r.sets.some((s) => s.name === 'filter' && s.value === 'blur(1px)'))).toBe(true);
  });

  it('stretches the contrast to the full range for depth', () => {
    const rec = canvases.start();
    const out = applyFilter('depth', source(128, 128));
    const d = written(out, rec);
    expect(d[0]).toBe(0);
    expect(d[(0 * 128 + 127) * 4]).toBe(255);
    expect(rec.all.some((r) => r.sets.some((s) => s.name === 'filter' && s.value === 'blur(2px)'))).toBe(true);
  });

  it('encodes surface directions as a normal map', () => {
    const rec = canvases.start();
    const d = written(applyFilter('normal', source()), rec);
    // Flat areas point straight at the viewer: (0.5, 0.5, 1.0) in colour.
    expect(at(d, 8, 0, 1)[0]).toBe(128);
    expect(at(d, 8, 0, 1)[2]).toBe(255);
    // At the edge the red channel leans away from the middle.
    expect(at(d, 8, 3, 1)[0]).not.toBe(at(d, 8, 0, 1)[0]);
  });
});
