import { describe, expect, it } from 'vitest';
import { buildGridLayout, verticalStep } from './layout';

const at = (day: number, hour: number) => ({ createdAt: new Date(2026, 9, day, hour).getTime() });

describe('grid layout', () => {
  it('fills rows of `cols` without headers when not grouped', () => {
    const layout = buildGridLayout([at(5, 1), at(5, 2), at(6, 1), at(6, 2), at(7, 1)], 2, false);
    expect(layout.rows).toEqual([
      { kind: 'images', start: 0, end: 2 },
      { kind: 'images', start: 2, end: 4 },
      { kind: 'images', start: 4, end: 5 },
    ]);
    expect(layout.rowOf).toEqual([0, 0, 1, 1, 2]);
  });

  it('starts each day on a new row under a header with its count', () => {
    // Already in grouped order: three on the 7th, one on the 6th.
    const layout = buildGridLayout([at(7, 3), at(7, 2), at(7, 1), at(6, 1)], 2, true);
    expect(layout.rows).toEqual([
      { kind: 'header', day: '2026-10-07', count: 3 },
      { kind: 'images', start: 0, end: 2 },
      { kind: 'images', start: 2, end: 3 },
      { kind: 'header', day: '2026-10-06', count: 1 },
      { kind: 'images', start: 3, end: 4 },
    ]);
    expect(layout.rowOf).toEqual([1, 1, 2, 4]);
  });

  it('has no rows for an empty list and treats zero columns as one', () => {
    expect(buildGridLayout([], 3, true)).toEqual({ rows: [], rowOf: [] });
    expect(buildGridLayout([at(5, 1), at(5, 2)], 0, false).rows).toHaveLength(2);
  });
});

describe('moving up and down in the grid', () => {
  const grouped = buildGridLayout([at(7, 3), at(7, 2), at(7, 1), at(6, 2), at(6, 1)], 2, true);

  it('keeps the column and skips day headers', () => {
    // Index 1 (row 1, column 1) down to index 2 (short row, last cell), then over the header to index 4.
    expect(verticalStep(grouped, 1, 1)).toBe(2);
    expect(verticalStep(grouped, 2, 1)).toBe(3);
    expect(verticalStep(grouped, 4, -1)).toBe(2);
    expect(verticalStep(grouped, 3, -1)).toBe(2);
    expect(verticalStep(grouped, 2, -1)).toBe(0);
  });

  it('goes to the first or last image past the edges, like the flat grid did', () => {
    expect(verticalStep(grouped, 1, -1)).toBe(0);
    expect(verticalStep(grouped, 3, 1)).toBe(4);
    const flat = buildGridLayout([at(5, 1), at(5, 2), at(5, 3)], 2, false);
    expect(verticalStep(flat, 1, 1)).toBe(2);
    expect(verticalStep(flat, 0, 1)).toBe(2);
    expect(verticalStep(flat, 2, 1)).toBe(2);
  });

  it('leaves an unknown index where it is', () => {
    expect(verticalStep(grouped, 99, 1)).toBe(99);
  });
});
