import { describe, expect, it } from 'vitest';
import type { ComicPoint } from './document';
import {
  allValid,
  insertCorner,
  isSimple,
  isValidShape,
  MAX_SHAPE_CORNERS,
  MIN_SHAPE_AREA,
  mirrorShapes,
  moveCorner,
  nearestEdge,
  pointInShape,
  removeCorner,
  shapeArea,
  shapeBox,
  shapesOverlap,
  splitShape,
  stitch,
  type Shape,
} from './shapes';

const pt = (x: number, y: number): ComicPoint => ({ x, y });
const square: Shape = [pt(0, 0), pt(1, 0), pt(1, 1), pt(0, 1)];
const left: Shape = [pt(0, 0), pt(0.5, 0), pt(0.5, 1), pt(0, 1)];
const right: Shape = [pt(0.5, 0), pt(1, 0), pt(1, 1), pt(0.5, 1)];

describe('the area and the box of a shape', () => {
  it('measures a square and a triangle', () => {
    expect(shapeArea(square)).toBeCloseTo(1);
    expect(shapeArea([pt(0, 0), pt(1, 0), pt(0, 1)])).toBeCloseTo(0.5);
  });

  it('gives the rectangle a shape fits in', () => {
    const box = shapeBox([pt(0.2, 0.1), pt(0.6, 0.4), pt(0.3, 0.9)]);
    expect(box.x).toBeCloseTo(0.2);
    expect(box.y).toBeCloseTo(0.1);
    expect(box.width).toBeCloseTo(0.4);
    expect(box.height).toBeCloseTo(0.8);
  });
});

describe('a point inside a shape', () => {
  it('is inside a convex shape and outside it', () => {
    expect(pointInShape(square, pt(0.5, 0.5))).toBe(true);
    expect(pointInShape(square, pt(1.5, 0.5))).toBe(false);
    expect(pointInShape(square, pt(-0.1, 0.2))).toBe(false);
  });

  it('is inside a concave shape only in its arms', () => {
    // A "V": the notch at the top middle is outside it.
    const v: Shape = [pt(0, 0), pt(0.3, 1), pt(0.5, 0.2), pt(0.7, 1), pt(1, 0)];
    expect(pointInShape(v, pt(0.5, 0.8))).toBe(false);
    expect(pointInShape(v, pt(0.3, 0.6))).toBe(true);
  });
});

describe('whether a shape stands', () => {
  it('refuses a shape whose edges cross', () => {
    const bowTie: Shape = [pt(0, 0), pt(1, 1), pt(1, 0), pt(0, 1)];
    expect(isSimple(bowTie)).toBe(false);
    expect(isValidShape(bowTie)).toBe(false);
  });

  it('refuses too few corners, too many, and a panel too small', () => {
    expect(isValidShape([pt(0, 0), pt(1, 0)])).toBe(false);
    expect(isValidShape(Array.from({ length: MAX_SHAPE_CORNERS + 1 }, (_, i) => pt(0.5 + 0.4 * Math.cos(i), 0.5 + 0.4 * Math.sin(i))))).toBe(false);
    expect(isValidShape([pt(0, 0), pt(0.01, 0), pt(0, 0.01)])).toBe(false);
    expect(shapeArea([pt(0, 0), pt(0.1, 0), pt(0, 0.1)])).toBeGreaterThan(MIN_SHAPE_AREA);
    expect(isValidShape([pt(0, 0), pt(0.1, 0), pt(0, 0.1)])).toBe(true);
  });
});

describe('cutting a panel in two', () => {
  it('cuts a square along its diagonal into two triangles that make the square', () => {
    const cut = splitShape(square, pt(0, 0), pt(1, 1));
    expect(cut).not.toBeNull();
    const [a, b] = cut!;
    expect(shapeArea(a)).toBeCloseTo(0.5);
    expect(shapeArea(b)).toBeCloseTo(0.5);
    expect(a.length).toBe(3);
    expect(b.length).toBe(3);
  });

  it('cuts along a line that is not through the corners, and extends it to the edges', () => {
    const cut = splitShape(square, pt(0.5, 0.2), pt(0.5, 0.3));
    expect(cut).not.toBeNull();
    expect(shapeArea(cut![0])).toBeCloseTo(0.5);
    expect(shapeArea(cut![1])).toBeCloseTo(0.5);
  });

  it('refuses a line that misses the panel', () => {
    expect(splitShape(square, pt(2, 0), pt(2, 1))).toBeNull();
  });

  it('refuses a line that only touches a corner', () => {
    expect(splitShape(square, pt(1, 0), pt(2, 1))).toBeNull();
  });

  it('cuts a panel through one corner and the opposite edge', () => {
    const cut = splitShape(square, pt(0, 0), pt(0.5, 1));
    expect(cut).not.toBeNull();
    expect(shapeArea(cut![0]) + shapeArea(cut![1])).toBeCloseTo(1);
  });

  it('refuses a line with no length', () => {
    expect(splitShape(square, pt(0.5, 0.5), pt(0.5, 0.5))).toBeNull();
  });

  it('refuses a line that crosses a concave panel four times', () => {
    const comb: Shape = [pt(0, 0), pt(1, 0), pt(1, 1), pt(0.8, 1), pt(0.8, 0.3), pt(0.6, 0.3), pt(0.6, 1), pt(0.4, 1), pt(0.4, 0.3), pt(0.2, 0.3), pt(0.2, 1), pt(0, 1)];
    expect(splitShape(comb, pt(-0.5, 0.6), pt(1.5, 0.6))).toBeNull();
  });

  it('refuses a cut that leaves a piece too small', () => {
    expect(splitShape(square, pt(0.001, 0), pt(0.001, 1))).toBeNull();
  });
});

describe('the corners shared by panels', () => {
  it('puts a corner on another panel\'s edge into that panel too', () => {
    // A tall panel whose right edge has a corner where the two panels on the right meet.
    const tall: Shape = [pt(0, 0), pt(0.6, 0), pt(0.6, 1), pt(0, 1)];
    const top: Shape = [pt(0.6, 0), pt(1, 0), pt(1, 0.5), pt(0.6, 0.5)];
    const bottom: Shape = [pt(0.6, 0.5), pt(1, 0.5), pt(1, 1), pt(0.6, 1)];
    const [shaped] = stitch([tall, top, bottom]);
    expect(shaped!.some((p) => p.x === 0.6 && p.y === 0.5)).toBe(true);
    expect(shaped!.length).toBe(5);
    expect(stitch([tall, top, bottom])).toEqual(stitch(stitch([tall, top, bottom])));
  });

  it('moves a corner that two panels share for both', () => {
    const moved = moveCorner([left, right], 0, 1, pt(0.4, 0));
    expect(moved).not.toBeNull();
    expect(moved![0]![1]).toEqual(pt(0.4, 0));
    expect(moved![1]![0]).toEqual(pt(0.4, 0));
  });

  it('refuses a move that makes a panel cross itself', () => {
    expect(moveCorner([square], 0, 0, pt(1, 1))).toBeNull();
  });

  it('refuses a move of a corner that is not there', () => {
    expect(moveCorner([square], 3, 0, pt(0.5, 0.5))).toBeNull();
    expect(moveCorner([square], 0, 9, pt(0.5, 0.5))).toBeNull();
  });

  it('adds a corner on an edge to both panels that share it', () => {
    const added = insertCorner([left, right], 0, 1, pt(0.5, 0.5));
    expect(added).not.toBeNull();
    expect(added![0]!.length).toBe(5);
    expect(added![1]!.length).toBe(5);
  });

  it('removes a straight corner from every panel that has it', () => {
    const leftWithMiddle: Shape = [pt(0, 0), pt(0.5, 0), pt(0.5, 0.5), pt(0.5, 1), pt(0, 1)];
    const rightWithMiddle: Shape = [pt(0.5, 0), pt(1, 0), pt(1, 1), pt(0.5, 1), pt(0.5, 0.5)];
    const removed = removeCorner([leftWithMiddle, rightWithMiddle], 0, 2);
    expect(removed).toEqual([left, right]);
  });

  it('refuses to remove a bent corner, since the panels that share it would no longer fit together', () => {
    expect(removeCorner([left, right], 0, 1)).toBeNull();
  });

  it('does not remove a corner from a panel that would be left with fewer than three', () => {
    expect(removeCorner([[pt(0, 0), pt(1, 0), pt(0, 1)]], 0, 0)).toBeNull();
  });

  it('finds two shapes that overlap, and not two that only share an edge', () => {
    const overlapping: Shape = [pt(0.4, 0), pt(1, 0), pt(1, 1), pt(0.4, 1)];
    expect(shapesOverlap(left, overlapping)).toBe(true);
    expect(shapesOverlap(left, right)).toBe(false);
    expect(shapesOverlap(square, [pt(0.2, 0.2), pt(0.8, 0.2), pt(0.8, 0.8), pt(0.2, 0.8)])).toBe(true);
    expect(allValid([left, right])).toBe(true);
    expect(allValid([left, overlapping])).toBe(false);
  });
});

describe('the nearest point of an edge', () => {
  it('gives the edge a point is nearest to, and the point on it', () => {
    expect(nearestEdge(square, pt(0.5, -0.2))).toEqual({ edge: 0, point: pt(0.5, 0) });
    expect(nearestEdge(square, pt(1.2, 0.25))).toEqual({ edge: 1, point: pt(1, 0.25) });
  });
});

describe('mirroring shapes', () => {
  it('flips them left to right and keeps their heights', () => {
    expect(mirrorShapes([[pt(0.1, 0.2), pt(0.4, 0.9), pt(0.1, 0.9)]])).toEqual([[pt(0.9, 0.2), pt(0.6, 0.9), pt(0.9, 0.9)]]);
  });
});
