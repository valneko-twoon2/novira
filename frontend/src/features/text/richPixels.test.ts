// The pixel work of "finish with AI": colours, blur, the lit base, the line map and the cut.
import { describe, expect, it } from 'vitest';
import { alphaOf, bevelBase, cutPicture, gaussianBlur, heightField, keyColor, lineMap, parseColor, SPILL_REACH } from './richPixels';

/** A w*h alpha field with a filled rectangle. */
function box(w: number, h: number, x0: number, y0: number, x1: number, y1: number): Float32Array {
  const a = new Float32Array(w * h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) a[y * w + x] = 1;
  return a;
}

function solid(w: number, h: number, rgb: [number, number, number]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) out.set([...rgb, 255], i * 4);
  return out;
}

describe('parseColor', () => {
  it('reads long and short hex and falls back to grey', () => {
    expect(parseColor('#c9952b')).toEqual([201, 149, 43]);
    expect(parseColor('#fa0')).toEqual([255, 170, 0]);
    expect(parseColor('red')).toEqual([128, 128, 128]);
    expect(parseColor('#12')).toEqual([128, 128, 128]);
  });
});

describe('alphaOf', () => {
  it('takes the alpha channel as 0..1', () => {
    const a = alphaOf([0, 0, 0, 255, 9, 9, 9, 0, 1, 1, 1, 51]);
    expect([a[0], a[1]]).toEqual([1, 0]);
    expect(a[2]).toBeCloseTo(0.2, 5);
  });
});

describe('gaussianBlur', () => {
  it('keeps a flat field flat and the total mass', () => {
    const flat = new Float32Array(40 * 30).fill(0.5);
    expect(Math.max(...gaussianBlur(flat, 40, 30, 4).map((v) => Math.abs(v - 0.5)))).toBeLessThan(1e-5);
    const dot = new Float32Array(41 * 41);
    dot[20 * 41 + 20] = 1;
    const sum = gaussianBlur(dot, 41, 41, 3).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 3);
  });

  it('spreads a dot symmetrically and returns the input for a tiny sigma', () => {
    const dot = new Float32Array(41 * 41);
    dot[20 * 41 + 20] = 1;
    const out = gaussianBlur(dot, 41, 41, 3);
    expect(out[20 * 41 + 17]).toBeCloseTo(out[20 * 41 + 23] as number, 6);
    expect(out[17 * 41 + 20]).toBeCloseTo(out[23 * 41 + 20] as number, 6);
    expect(out[20 * 41 + 20]).toBeLessThan(1);
    expect(gaussianBlur(dot, 41, 41, 0.2)).toBe(dot);
  });
});

describe('heightField', () => {
  it('is highest inside the letters and fades outside', () => {
    const a = box(96, 96, 32, 32, 64, 64);
    const h = heightField(a, 96, 96);
    expect(h[48 * 96 + 48]).toBeGreaterThan(0.9);
    expect(h[48 * 96 + 5]).toBeLessThan(0.05);
  });
});

describe('bevelBase', () => {
  const fg: [number, number, number] = [200, 150, 40];
  const bg: [number, number, number] = [10, 10, 12];
  const a = box(96, 96, 24, 24, 72, 72);
  const out = bevelBase(a, 96, 96, fg, bg);

  it('shows the background where there is no letter and is opaque', () => {
    expect([...out.slice(0, 4)]).toEqual([10, 10, 12, 255]);
    expect(out[(48 * 96 + 48) * 4 + 3]).toBe(255);
  });

  it('lights the top left edge more than the bottom right edge', () => {
    const lum = (x: number, y: number) => out[(y * 96 + x) * 4]! + out[(y * 96 + x) * 4 + 1]! + out[(y * 96 + x) * 4 + 2]!;
    expect(lum(27, 48)).toBeGreaterThan(lum(68, 48));
    expect(lum(48, 27)).toBeGreaterThan(lum(48, 68));
  });

  it('keeps a flat interior in the look colour family', () => {
    const o = (48 * 96 + 48) * 4;
    expect(out[o]!).toBeGreaterThan(out[o + 2]!);
  });
});

describe('lineMap', () => {
  it('draws white only along the edge of the letters', () => {
    const a = box(60, 60, 20, 20, 40, 40);
    const m = lineMap(a, 60, 60);
    const at = (x: number, y: number) => m[(y * 60 + x) * 4]!;
    expect(at(20, 30)).toBe(255);
    expect(at(30, 20)).toBe(255);
    expect(at(30, 30)).toBe(0);
    expect(at(5, 5)).toBe(0);
    expect(m[3]).toBe(255);
  });

  it('is empty for an empty field', () => {
    expect(Math.max(...lineMap(new Float32Array(100), 10, 10).filter((_, i) => i % 4 === 0))).toBe(0);
  });
});

describe('keyColor', () => {
  it('is the colour of the corners, whatever is in the middle', () => {
    const p = solid(80, 60, [30, 40, 50]);
    for (let y = 20; y < 40; y++) for (let x = 20; x < 60; x++) p.set([255, 0, 0, 255], (y * 80 + x) * 4);
    expect(keyColor(p, 80, 60)).toEqual([30, 40, 50]);
  });

  it('works on a picture smaller than the corner squares', () => {
    expect(keyColor(solid(4, 4, [9, 8, 7]), 4, 4)).toEqual([9, 8, 7]);
  });
});

describe('cutPicture', () => {
  const w = 120;
  const h = 80;
  const glyphs = box(w, h, 40, 30, 80, 50);
  /** Background colour with a bright blob that sticks out of the letters on the right. */
  const picture = () => {
    const p = solid(w, h, [10, 10, 10]);
    for (let y = 30; y < 50; y++) for (let x = 40; x < 92; x++) p.set([250, 120, 20, 255], (y * w + x) * 4);
    return p;
  };

  it('with no spill the alpha is the glyph alpha exactly', () => {
    const out = cutPicture(picture(), glyphs, w, h, 0);
    for (let i = 0; i < w * h; i++) expect(out[i * 4 + 3]).toBe(glyphs[i]! * 255);
    expect(out[(40 * w + 50) * 4]).toBe(250);
  });

  it('with a spill keeps what is not background just outside the letters, and drops the plain background', () => {
    const out = cutPicture(picture(), glyphs, w, h, 100);
    const alpha = (x: number, y: number) => out[(y * w + x) * 4 + 3]!;
    expect(alpha(60, 40)).toBe(255);
    expect(alpha(84, 40)).toBeGreaterThan(50);
    expect(alpha(110, 40)).toBe(0);
    expect(alpha(60, 5)).toBe(0);
  });

  it('never lowers the alpha inside the letters and grows with the spill', () => {
    const none = cutPicture(picture(), glyphs, w, h, 0);
    const some = cutPicture(picture(), glyphs, w, h, 30);
    const much = cutPicture(picture(), glyphs, w, h, 100);
    const total = (o: Uint8ClampedArray) => o.reduce((s, v, i) => (i % 4 === 3 ? s + v : s), 0);
    expect(total(some)).toBeGreaterThanOrEqual(total(none));
    expect(total(much)).toBeGreaterThanOrEqual(total(some));
    for (let i = 0; i < w * h; i++) if (glyphs[i] === 1) expect(much[i * 4 + 3]).toBe(255);
  });

  it('on a clean background a spill adds nothing', () => {
    const clean = solid(w, h, [10, 10, 10]);
    const out = cutPicture(clean, glyphs, w, h, 100);
    for (let i = 0; i < w * h; i++) expect(out[i * 4 + 3]).toBe(glyphs[i]! * 255);
  });

  it('exports the reach as a share of the short side', () => {
    expect(SPILL_REACH).toBeGreaterThan(0);
    expect(SPILL_REACH).toBeLessThan(0.5);
  });
});
