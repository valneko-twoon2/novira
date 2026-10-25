import { describe, expect, it } from 'vitest';
import { v3 } from '@/state/pose/math3d';
import { newPerson, newProp, newRough } from './rough';
import { boxTriangles, cylinderTriangles, FLOOR_HALF, propTriangles, roughTriangles, sphereTriangles } from './roughMesh';

const count = (out: number[]) => out.length / 9;
const corners = (out: number[]) => Array.from({ length: out.length / 3 }, (_, i) => v3(out[i * 3]!, out[i * 3 + 1]!, out[i * 3 + 2]!));

describe('the triangles of a rough', () => {
  it('makes a box of twelve triangles inside its size', () => {
    const out: number[] = [];
    boxTriangles(out, v3(1, 2, 3), [v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1)], [0.5, 1, 2]);
    expect(count(out)).toBe(12);
    for (const p of corners(out)) {
      expect(Math.abs(p.x - 1)).toBeCloseTo(0.5);
      expect(Math.abs(p.y - 2)).toBeCloseTo(1);
      expect(Math.abs(p.z - 3)).toBeCloseTo(2);
    }
  });

  it('makes a closed cylinder round its axis, and nothing for one of no length', () => {
    const out: number[] = [];
    cylinderTriangles(out, v3(0, 0, 0), v3(0, 2, 0), 0.5, 8);
    expect(count(out)).toBe(8 * 4);
    for (const p of corners(out)) expect(Math.hypot(p.x, p.z) <= 0.5 + 1e-9).toBe(true);
    const none: number[] = [];
    cylinderTriangles(none, v3(1, 1, 1), v3(1, 1, 1), 0.5);
    expect(none).toEqual([]);
  });

  it('makes a ball whose corners are on its surface', () => {
    const out: number[] = [];
    sphereTriangles(out, v3(0, 1, 0), 0.2, 4, 6);
    expect(count(out)).toBe(4 * 6 * 2);
    for (const p of corners(out)) expect(Math.hypot(p.x, p.y - 1, p.z)).toBeCloseTo(0.2);
  });

  it('stands an upright plane on its place, turned by its yaw', () => {
    const out: number[] = [];
    propTriangles(out, { ...newProp('plane', 0, -2, Math.PI / 2), w: 2, h: 3 });
    expect(count(out)).toBe(2);
    const points = corners(out);
    expect(Math.min(...points.map((p) => p.y))).toBeCloseTo(0);
    expect(Math.max(...points.map((p) => p.y))).toBeCloseTo(3);
    // Turned a quarter, its width runs along z.
    for (const p of points) expect(p.x).toBeCloseTo(0);
    expect(Math.max(...points.map((p) => p.z)) - Math.min(...points.map((p) => p.z))).toBeCloseTo(2);
  });

  it('gives the floor two triangles to the horizon, a person a mannequin, and an empty set nothing', () => {
    const floorOnly = roughTriangles({ ...newRough(), people: [] });
    expect(count(floorOnly)).toBe(2);
    expect(Math.max(...corners(floorOnly).map((p) => p.x))).toBe(FLOOR_HALF);
    expect(roughTriangles({ ...newRough(), people: [], floor: false })).toEqual([]);
    const person = roughTriangles({ ...newRough(), people: [newPerson(0, 0, 0)], floor: false });
    const ys = corners(person).map((p) => p.y);
    // From the soles to the top of the head of a person about 1.7 m tall.
    expect(Math.min(...ys)).toBeCloseTo(0, 1);
    expect(Math.max(...ys)).toBeGreaterThan(1.6);
    expect(Math.max(...ys)).toBeLessThan(1.8);
  });
});
