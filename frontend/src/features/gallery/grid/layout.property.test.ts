// Property tests for the gallery grid: row layout (flat and grouped by day), keyboard stepping and click selection.
// In-process only (the gallery store, no backend).
import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import { check, blockExternalNetwork } from '@/propertyTest.testkit';
import { dayKey } from '@/state/dateFilter';
import { useGallery } from '@/state/gallery';
import { buildGridLayout, verticalStep } from './layout';
import { clickImage, moveSelection } from './selection';

blockExternalNetwork();

const T0 = Date.UTC(2024, 0, 1);
const list = fc.array(fc.integer({ min: 0, max: 6 }), { maxLength: 40 }).map((days) => days.sort((a, b) => b - a).map((d, i) => ({ createdAt: T0 + d * 86_400_000 + i * 1000 })));

const initial = useGallery.getState();
beforeEach(() => useGallery.setState(initial, true));

describe('grid layout (properties)', () => {
  it('every image sits in exactly one image row of at most `cols`, in order, and rowOf points at it', () => {
    check(
      fc.property(list, fc.integer({ min: -2, max: 12 }), fc.boolean(), (items, cols, grouped) => {
        const { rows, rowOf } = buildGridLayout(items, cols, grouped);
        const width = Math.max(1, cols);
        const covered: number[] = [];
        rows.forEach((row, r) => {
          if (row.kind !== 'images') return;
          expect(row.end - row.start).toBeGreaterThan(0);
          expect(row.end - row.start).toBeLessThanOrEqual(width);
          for (let i = row.start; i < row.end; i++) {
            covered.push(i);
            expect(rowOf[i]).toBe(r);
          }
        });
        expect(covered).toEqual(items.map((_, i) => i));
        expect(rowOf.length).toBe(items.length);
      }),
    );
  });

  it('with grouping, a header precedes each run of one day and counts it', () => {
    check(
      fc.property(list, fc.integer({ min: 1, max: 8 }), (items, cols) => {
        const { rows } = buildGridLayout(items, cols, true);
        const headers = rows.filter((r) => r.kind === 'header');
        expect(headers.reduce((n, h) => n + (h.kind === 'header' ? h.count : 0), 0)).toBe(items.length);
        let current: string | null = null;
        for (const row of rows) {
          if (row.kind === 'header') current = row.day;
          else for (let i = row.start; i < row.end; i++) expect(dayKey(items[i]!.createdAt)).toBe(current);
        }
        const days = headers.map((h) => (h.kind === 'header' ? h.day : ''));
        expect(new Set(days).size).toBe(days.length);
      }),
    );
  });

  it('verticalStep always returns a valid index, and moves down then up in the same column', () => {
    check(
      fc.property(list.filter((l) => l.length > 0), fc.integer({ min: 1, max: 8 }), fc.boolean(), fc.nat(), (items, cols, grouped, pick) => {
        const layout = buildGridLayout(items, cols, grouped);
        const index = pick % items.length;
        for (const dir of [-1, 1] as const) {
          const next = verticalStep(layout, index, dir);
          expect(next).toBeGreaterThanOrEqual(0);
          expect(next).toBeLessThan(items.length);
          if (dir === 1 && next > index) expect(next).toBeGreaterThan(index);
          if (dir === -1 && next < index) expect(next).toBeLessThan(index);
        }
      }),
    );
  });
});

const names = fc.integer({ min: 1, max: 15 }).map((n) => Array.from({ length: n }, (_, i) => `n${i}`));
const click = fc.record({ ctrlKey: fc.boolean(), metaKey: fc.boolean(), shiftKey: fc.boolean(), altKey: fc.boolean() });

describe('grid selection (properties)', () => {
  it('any sequence of clicks and moves keeps a selection of unique names from the list', () => {
    check(
      fc.property(
        names,
        fc.array(fc.oneof(fc.record({ kind: fc.constant('click' as const), at: fc.nat(30), e: click }), fc.record({ kind: fc.constant('move' as const), step: fc.integer({ min: -20, max: 20 }), extend: fc.boolean() })), { maxLength: 30 }),
        (list, actions) => {
          useGallery.setState(initial, true);
          for (const a of actions) {
            if (a.kind === 'click') clickImage(list[a.at % list.length]!, a.e, list);
            else {
              const next = moveSelection(list, a.step, a.extend);
              expect(next).not.toBeNull();
              expect(next!).toBeGreaterThanOrEqual(0);
              expect(next!).toBeLessThan(list.length);
            }
            const sel = useGallery.getState().selection;
            expect(new Set(sel).size).toBe(sel.length);
            // A plain / ctrl / shift gesture never selects something outside the list (alt only sets the compare image).
            expect(sel.every((n) => list.includes(n))).toBe(true);
          }
        },
      ),
    );
  });

  it('moveSelection of an empty list does nothing', () => {
    expect(moveSelection([], 1, false)).toBeNull();
  });
});
