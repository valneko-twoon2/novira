// The manga layout: valid free panels that do not overlap, in reading order, with wider gaps between tiers than beside.
import { describe, expect, it } from 'vitest';
import { shapeCentre } from './freeShapes';
import { pageAspect } from './layout';
import { MANGA_MAX_PANELS, MANGA_MOODS, mangaLayout } from './mangaLayout';
import { isValidShape, shapeArea, type Shape } from './shapes';

const aspect = pageAspect('A4');
const box = (s: Shape) => ({ x0: Math.min(...s.map((p) => p.x)), x1: Math.max(...s.map((p) => p.x)), y0: Math.min(...s.map((p) => p.y)), y1: Math.max(...s.map((p) => p.y)) });

/** True when two convex panels overlap: no edge of either separates them (the separating axis test). */
function overlap(a: Shape, b: Shape): boolean {
  for (const shape of [a, b]) {
    for (let i = 0; i < shape.length; i++) {
      const p = shape[i]!;
      const q = shape[(i + 1) % shape.length]!;
      const nx = q.y - p.y;
      const ny = p.x - q.x;
      const proj = (s: Shape) => s.map((r) => r.x * nx + r.y * ny);
      if (Math.max(...proj(a)) <= Math.min(...proj(b)) + 1e-9 || Math.max(...proj(b)) <= Math.min(...proj(a)) + 1e-9) return false;
    }
  }
  return true;
}

describe('mangaLayout', () => {
  it('makes valid panels that never overlap, for every count and mood over many seeds', () => {
    for (const mood of MANGA_MOODS) {
      for (let n = 1; n <= MANGA_MAX_PANELS; n++) {
        for (let seed = 1; seed <= 25; seed++) {
          const shapes = mangaLayout({ panelCount: n, mood, aspect, seed });
          expect(shapes).toHaveLength(n);
          for (const s of shapes) expect(isValidShape(s)).toBe(true);
          for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(overlap(shapes[i]!, shapes[j]!), `${mood} ${n} seed ${seed}: ${i + 1} and ${j + 1}`).toBe(false);
        }
      }
    }
  });

  it('gives the same page for the same seed, and another page for another seed', () => {
    const a = mangaLayout({ panelCount: 6, aspect, seed: 3 });
    expect(mangaLayout({ panelCount: 6, aspect, seed: 3 })).toEqual(a);
    expect(mangaLayout({ panelCount: 6, aspect, seed: 4 })).not.toEqual(a);
  });

  it('reads from the top right on a right-to-left page and from the top left on a left-to-right one', () => {
    const rtl = mangaLayout({ panelCount: 4, mood: 'calm', aspect, seed: 2, direction: 'rtl' });
    const ltr = mangaLayout({ panelCount: 4, mood: 'calm', aspect, seed: 2, direction: 'ltr' });
    expect(rtl.map((s) => shapeCentre(s).x)).toEqual(ltr.map((s) => 1 - shapeCentre(s).x).map((x) => expect.closeTo(x, 9)));
    // The first panel starts the top tier, and a panel further on is never above it.
    const top = Math.min(...rtl.map((s) => box(s).y0));
    expect(box(rtl[0]!).y0).toBeCloseTo(top, 9);
    expect(shapeCentre(rtl[0]!).x).toBeGreaterThanOrEqual(Math.min(...rtl.filter((s) => box(s).y0 < box(rtl[0]!).y1).map((s) => shapeCentre(s).x)));
  });

  it('makes the focus panel the largest on a dramatic page', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const shapes = mangaLayout({ panelCount: 5, mood: 'dramatic', focus: 3, aspect, seed });
      const areas = shapes.map(shapeArea);
      expect(areas.indexOf(Math.max(...areas)), `seed ${seed}`).toBe(2);
    }
  });

  it('keeps a calm page square, with a wider gap between tiers than between panels side by side', () => {
    const shapes = mangaLayout({ panelCount: 4, mood: 'calm', aspect, seed: 1, direction: 'ltr' });
    for (const s of shapes) {
      const b = box(s);
      for (const p of s) expect([b.x0, b.x1].some((x) => Math.abs(p.x - x) < 1e-9) && [b.y0, b.y1].some((y) => Math.abs(p.y - y) < 1e-9)).toBe(true);
    }
    const gaps = { across: [] as number[], down: [] as number[] };
    for (const a of shapes.map(box)) {
      for (const b of shapes.map(box)) {
        if (b.x0 > a.x1 && b.y0 < a.y1 && b.y1 > a.y0) gaps.across.push(b.x0 - a.x1);
        if (b.y0 > a.y1 && b.x0 < a.x1 && b.x1 > a.x0) gaps.down.push((b.y0 - a.y1) * aspect);
      }
    }
    expect(gaps.across.length).toBeGreaterThan(0);
    expect(gaps.down.length).toBeGreaterThan(0);
    expect(Math.min(...gaps.down)).toBeGreaterThan(Math.max(...gaps.across));
  });
});
