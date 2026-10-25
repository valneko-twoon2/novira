// Property tests for the gallery date filter: day keys, ranges, month grids and day grouping. In-process only.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check, junkText } from '@/propertyTest.testkit';
import {
  addDays,
  addMonths,
  dayCounts,
  dayInRange,
  dayKey,
  groupByDay,
  inRange,
  isDayKey,
  matchQuickRange,
  monthGrid,
  monthOf,
  normalizeRange,
  parseDayKey,
  QUICK_RANGES,
  quickRange,
} from './dateFilter';

// 1971 .. 2200 in epoch milliseconds: the span real timestamps live in.
const ms = fc.integer({ min: Date.UTC(1971, 0, 2), max: Date.UTC(2200, 0, 1) });
const day = ms.map(dayKey);
const maybeDay = fc.oneof(day, junkText, fc.constant(null));
const items = fc.array(fc.record({ createdAt: ms, id: fc.integer() }), { maxLength: 40 });

describe('dateFilter (properties)', () => {
  it('dayKey is a valid key that parses back to the same local day', () => {
    check(
      fc.property(ms, (t) => {
        const key = dayKey(t);
        expect(isDayKey(key)).toBe(true);
        expect(dayKey(parseDayKey(key)!.getTime())).toBe(key);
      }),
    );
  });

  it('isDayKey / parseDayKey never throw on arbitrary text and agree with each other', () => {
    check(fc.property(junkText, (s) => isDayKey(s) === (parseDayKey(s) !== null)));
  });

  it('addDays is reversible and moves keys in order', () => {
    check(
      fc.property(day, fc.integer({ min: -4000, max: 4000 }), (k, n) => {
        const moved = addDays(k, n);
        expect(addDays(moved, -n)).toBe(k);
        expect(moved === k ? n === 0 : n > 0 ? moved > k : moved < k).toBe(true);
      }),
    );
  });

  it('normalizeRange returns null or an ordered, valid, idempotent range', () => {
    check(
      fc.property(maybeDay, maybeDay, (a, b) => {
        const r = normalizeRange(a, b);
        if (r === null) {
          expect((a === null || !isDayKey(a)) && (b === null || !isDayKey(b))).toBe(true);
          return;
        }
        expect(r.from === null || isDayKey(r.from)).toBe(true);
        expect(r.to === null || isDayKey(r.to)).toBe(true);
        if (r.from !== null && r.to !== null) expect(r.from <= r.to).toBe(true);
        expect(normalizeRange(r.from, r.to)).toEqual(r);
      }),
    );
  });

  it('inRange agrees with dayInRange and an open end never excludes', () => {
    check(
      fc.property(ms, day, day, (t, a, b) => {
        const range = normalizeRange(a, b)!;
        expect(inRange(t, range)).toBe(dayInRange(dayKey(t), range));
        expect(dayInRange(dayKey(t), { from: null, to: range.to })).toBe(range.to === null || dayKey(t) <= range.to);
        expect(inRange(t, { from: dayKey(t), to: dayKey(t) })).toBe(true);
      }),
    );
  });

  it('quick ranges contain "now" (except yesterday) and are recognised again', () => {
    check(
      fc.property(ms, fc.constantFrom(...QUICK_RANGES), (now, kind) => {
        const r = quickRange(kind, now);
        expect(r.from! <= r.to!).toBe(true);
        expect(inRange(now, r)).toBe(kind !== 'yesterday');
        expect(matchQuickRange(r, now)).not.toBeNull();
      }),
    );
  });

  it('groupByDay partitions the items by day, keeps the inner order and sorts the days', () => {
    check(
      fc.property(items, fc.constantFrom('asc', 'desc'), (list, dir) => {
        const groups = groupByDay(list, dir);
        expect(groups.flatMap((g) => g.items).length).toBe(list.length);
        const days = groups.map((g) => g.day);
        expect(days).toEqual([...new Set(days)]);
        expect(days).toEqual([...days].sort(dir === 'asc' ? undefined : (x, y) => (x < y ? 1 : -1)));
        for (const g of groups) {
          expect(g.items.every((i) => dayKey(i.createdAt) === g.day)).toBe(true);
          expect(g.items).toEqual(list.filter((i) => dayKey(i.createdAt) === g.day));
        }
      }),
    );
  });

  it('dayCounts sums to the number of items', () => {
    check(fc.property(items, (list) => [...dayCounts(list).values()].reduce((a, b) => a + b, 0) === list.length));
  });

  it('monthGrid has full weeks that list each day of the month once, in order', () => {
    check(
      fc.property(day, fc.integer({ min: -30, max: 30 }), (k, n) => {
        const month = addMonths(monthOf(k), n);
        const weeks = monthGrid(month);
        expect(weeks.every((w) => w.length === 7)).toBe(true);
        const cells = weeks.flat().filter((c): c is string => c !== null);
        expect(cells).toEqual([...cells].sort());
        expect(new Set(cells).size).toBe(cells.length);
        expect(cells.length).toBe(new Date(month.year, month.month + 1, 0).getDate());
        expect(cells.every((c) => monthOf(c).month === month.month && monthOf(c).year === month.year)).toBe(true);
      }),
    );
  });

  it('addMonths keeps the month in 0-11 and is reversible', () => {
    check(
      fc.property(fc.record({ year: fc.integer({ min: 1, max: 3000 }), month: fc.integer({ min: 0, max: 11 }) }), fc.integer({ min: -5000, max: 5000 }), (m, n) => {
        const moved = addMonths(m, n);
        expect(moved.month).toBeGreaterThanOrEqual(0);
        expect(moved.month).toBeLessThanOrEqual(11);
        expect(addMonths(moved, -n)).toEqual(m);
      }),
    );
  });
});
