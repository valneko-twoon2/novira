import { describe, expect, it } from 'vitest';
import { addFreeShape, insertCornerFree, keepOnPage, isFreeShape, moveCornerFree, moveEdgeFree, removeCornerFree, rotateShape, shapeCentre, translateShape } from './freeShapes';
import { shapeArea, type Shape } from './shapes';

const ASPECT = 1.414;
const rect = (x: number, y: number, w: number, h: number): Shape => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];
/** The area measured on the paper, where the page is ASPECT times as tall as it is wide. */
const paperArea = (s: Shape) => shapeArea(s.map((p) => ({ x: p.x, y: p.y * ASPECT })));
/** The middle of the panel is on the page. */
const inside = (s: Shape) => {
  const c = shapeCentre(s);
  return c.x >= -1e-9 && c.x <= 1 + 1e-9 && c.y >= -1e-9 && c.y <= 1 + 1e-9;
};

describe('keepOnPage and translateShape', () => {
  it('keeps the middle of a shape on the page, and lets the rest run off it', () => {
    const kept = keepOnPage(rect(-0.4, 0.1, 0.4, 0.4))!;
    expect(shapeCentre(kept).x).toBeCloseTo(0);
    expect(kept[0]!.x).toBeLessThan(0);
    expect(keepOnPage(rect(0.9, 0.9, 0.4, 0.4))![2]).toEqual({ x: expect.closeTo(1.2), y: expect.closeTo(1.2) });
    expect(keepOnPage(rect(-1, 0, 4, 0.3))).toBeNull();
  });

  it('moves a shape by the delta, partly off the page when asked, and stops it when its middle would leave', () => {
    const moved = translateShape(rect(0.1, 0.1, 0.3, 0.2), { x: 0.2, y: 0.1 })!;
    expect(moved[0]).toEqual({ x: expect.closeTo(0.3), y: expect.closeTo(0.2) });
    const cut = translateShape(rect(0.5, 0.5, 0.3, 0.2), { x: 0.45, y: 0 })!;
    expect(cut[1]!.x).toBeGreaterThan(1);
    expect(shapeCentre(cut).x).toBeLessThanOrEqual(1 + 1e-9);
    const stopped = translateShape(rect(0.5, 0.5, 0.3, 0.2), { x: 5, y: -9 })!;
    expect(shapeCentre(stopped).x).toBeCloseTo(1);
    expect(shapeCentre(stopped).y).toBeCloseTo(0);
  });
});

describe('rotateShape', () => {
  it('keeps the panel the same size on the paper and the same middle, whatever the angle', () => {
    const start = rect(0.3, 0.3, 0.3, 0.2);
    for (const degrees of [15, 45, 90, 180, 270]) {
      const turned = rotateShape(start, (degrees * Math.PI) / 180, ASPECT)!;
      expect(paperArea(turned)).toBeCloseTo(paperArea(start), 6);
      expect(shapeCentre(turned).x).toBeCloseTo(shapeCentre(start).x, 6);
      expect(inside(turned)).toBe(true);
    }
  });

  it('turns a right angle on paper into a right angle, and comes back after a full turn', () => {
    const start = rect(0.3, 0.3, 0.3, 0.2);
    const turned = rotateShape(start, Math.PI / 6, ASPECT)!;
    const edge = (a: number, b: number) => ({ x: turned[b]!.x - turned[a]!.x, y: (turned[b]!.y - turned[a]!.y) * ASPECT });
    const u = edge(0, 1);
    const v = edge(1, 2);
    expect(u.x * v.x + u.y * v.y).toBeCloseTo(0, 9);
    const again = rotateShape(start, Math.PI * 2, ASPECT)!;
    again.forEach((p, i) => {
      expect(p.x).toBeCloseTo(start[i]!.x, 9);
      expect(p.y).toBeCloseTo(start[i]!.y, 9);
    });
  });

  it('turns about its middle even where that runs a corner off the page, and refuses a turn that throws a corner too far', () => {
    const turned = rotateShape(rect(0, 0, 0.9, 0.2), Math.PI / 4, ASPECT)!;
    expect(inside(turned)).toBe(true);
    expect(turned.some((p) => p.x < 0 || p.y < 0)).toBe(true);
    expect(rotateShape(rect(0.4, -1, 0.2, 2.5), Math.PI / 2, ASPECT)).toBeNull();
  });
});

describe('reshaping one free panel', () => {
  const shapes = [rect(0.1, 0.1, 0.4, 0.3), rect(0.3, 0.2, 0.4, 0.3)];

  it('moves a corner of one panel and leaves the others alone, even where they overlap', () => {
    const next = moveCornerFree(shapes, 0, 2, { x: 0.6, y: 0.45 })!;
    expect(next[0]![2]).toEqual({ x: 0.6, y: 0.45 });
    expect(next[1]).toEqual(shapes[1]);
  });

  it('refuses a corner move that makes the panel cross itself, and stops a corner a page-length off the page', () => {
    expect(moveCornerFree(shapes, 0, 2, { x: 0.1, y: 0.1 })).toBeNull();
    expect(moveCornerFree(shapes, 0, 2, { x: 4, y: 4 })![0]![2]).toEqual({ x: 2, y: 2 });
  });

  it('slides an edge, adds a corner and takes one away', () => {
    expect(moveEdgeFree(shapes, 0, 1, { x: 0.1, y: 0 })![0]!.slice(1, 3).map((p) => p.x)).toEqual([expect.closeTo(0.6), expect.closeTo(0.6)]);
    const more = insertCornerFree(shapes, 0, 0, { x: 0.3, y: 0.05 })!;
    expect(more[0]).toHaveLength(5);
    expect(removeCornerFree(more, 0, 1)![0]).toHaveLength(4);
    expect(removeCornerFree(shapes, 1, 0)![1]).toHaveLength(3);
    expect(removeCornerFree([[...shapes[0]!.slice(0, 3)]], 0, 0)).toBeNull();
  });
});

describe('addFreeShape and isFreeShape', () => {
  it('adds a valid rectangle on the page, each one a little off the one before', () => {
    const one = addFreeShape([], ASPECT);
    const two = addFreeShape(one, ASPECT);
    expect(two).toHaveLength(2);
    expect(two.every(isFreeShape)).toBe(true);
    expect(two[1]![0]).not.toEqual(two[0]![0]);
  });

  it('accepts overlapping panels, and ones partly off the page, but not one whose middle is off it, or a sliver', () => {
    expect(isFreeShape(rect(0.2, 0.2, 0.5, 0.5))).toBe(true);
    expect(isFreeShape(rect(0.6, 0.6, 0.6, 0.6))).toBe(true);
    expect(isFreeShape(rect(1.1, 0.2, 0.5, 0.5))).toBe(false);
    expect(isFreeShape(rect(0.2, 0.2, 0.01, 0.01))).toBe(false);
  });
});
