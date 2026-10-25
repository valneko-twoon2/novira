// Rows of the virtualized gallery grid: runs of thumbnails, and with grouping a header row before each day.
import { dayKey, type DayKey } from '@/state/dateFilter';

export type GridRow = { kind: 'header'; day: DayKey; count: number } | { kind: 'images'; start: number; end: number };

export interface GridLayout {
  rows: GridRow[];
  /** For each image index, the row it sits in. */
  rowOf: number[];
}

/**
 * Lays `list` out in rows of `cols`. With `grouped`, each run of images from the same local day starts on a new row
 * under a header; `list` must already run day by day (see `selectBoardImages`).
 */
export function buildGridLayout(list: readonly { createdAt: number }[], cols: number, grouped: boolean): GridLayout {
  const rows: GridRow[] = [];
  const rowOf: number[] = [];
  const width = Math.max(1, cols);
  const pushImages = (start: number, end: number) => {
    for (let s = start; s < end; s += width) {
      const e = Math.min(end, s + width);
      for (let i = s; i < e; i++) rowOf.push(rows.length);
      rows.push({ kind: 'images', start: s, end: e });
    }
  };
  if (!grouped) {
    pushImages(0, list.length);
    return { rows, rowOf };
  }
  let start = 0;
  while (start < list.length) {
    const day = dayKey(list[start]!.createdAt);
    let end = start + 1;
    while (end < list.length && dayKey(list[end]!.createdAt) === day) end++;
    rows.push({ kind: 'header', day, count: end - start });
    pushImages(start, end);
    start = end;
  }
  return { rows, rowOf };
}

/**
 * The image one row up (`dir = -1`) or down (`1`) from `index`, in the same column or the last one of a shorter row.
 * Header rows are skipped. Past the first or last row it goes to the first or last image.
 */
export function verticalStep(layout: GridLayout, index: number, dir: -1 | 1): number {
  const { rows, rowOf } = layout;
  const row = rowOf[index];
  const here = row === undefined ? undefined : rows[row];
  if (here?.kind !== 'images') return index;
  const col = index - here.start;
  for (let r = row! + dir; r >= 0 && r < rows.length; r += dir) {
    const target = rows[r]!;
    if (target.kind === 'images') return Math.min(target.start + col, target.end - 1);
  }
  return dir < 0 ? 0 : rowOf.length - 1;
}
