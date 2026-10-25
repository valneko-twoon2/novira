import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  dayCounts,
  dayInRange,
  dayKey,
  groupByDay,
  inRange,
  isSingleDay,
  matchQuickRange,
  monthGrid,
  normalizeRange,
  parseDayKey,
  quickRange,
  sameRange,
} from './dateFilter';

/** Runs the tests of a block in a time zone (Node reads TZ again whenever it changes). */
function inTimeZone(zone: string) {
  let saved: string | undefined;
  beforeAll(() => {
    saved = process.env.TZ;
    process.env.TZ = zone;
  });
  afterAll(() => {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  });
}

describe('day keys in Asia/Tokyo', () => {
  inTimeZone('Asia/Tokyo');
  // Local midnight of 2026-10-05 is 15:00 UTC the day before.
  const midnight = Date.UTC(2026, 9, 4, 15, 0, 0);

  it('switches to the next day exactly at local midnight, not at UTC midnight', () => {
    expect(dayKey(midnight)).toBe('2026-10-05');
    expect(dayKey(midnight - 1)).toBe('2026-10-04');
    expect(dayKey(Date.UTC(2026, 9, 5, 0, 0, 0))).toBe('2026-10-05');
  });

  it('filters a timestamp by its local day', () => {
    const oct5 = { from: '2026-10-05', to: '2026-10-05' };
    expect(inRange(midnight, oct5)).toBe(true);
    expect(inRange(midnight - 1, oct5)).toBe(false);
    expect(inRange(midnight + 24 * 3600_000 - 1, oct5)).toBe(true);
    expect(inRange(midnight + 24 * 3600_000, oct5)).toBe(false);
  });

  it('computes quick ranges from the local day of now', () => {
    // 00:30 local on 2026-10-06 is still 2026-10-05 in UTC.
    const now = Date.UTC(2026, 9, 5, 15, 30);
    expect(quickRange('today', now)).toEqual({ from: '2026-10-06', to: '2026-10-06' });
    expect(quickRange('yesterday', now)).toEqual({ from: '2026-10-05', to: '2026-10-05' });
    expect(quickRange('last7', now)).toEqual({ from: '2026-09-30', to: '2026-10-06' });
    expect(quickRange('last30', now)).toEqual({ from: '2026-09-07', to: '2026-10-06' });
  });
});

describe('day keys across daylight saving time (America/New_York)', () => {
  inTimeZone('America/New_York');

  it('steps whole calendar days over the 23-hour and 25-hour days', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-11-02', -1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
  });

  it('keeps the last hour of the 25-hour day on that day', () => {
    // 2026-11-01 23:30 EST is 04:30 UTC on 11-02.
    expect(dayKey(Date.UTC(2026, 10, 2, 4, 30))).toBe('2026-11-01');
    expect(dayKey(Date.UTC(2026, 10, 2, 5, 0))).toBe('2026-11-02');
  });

  it('counts back seven calendar days over the spring change', () => {
    const now = new Date(2026, 2, 10, 0, 30).getTime();
    expect(quickRange('last7', now)).toEqual({ from: '2026-03-04', to: '2026-03-10' });
  });
});

describe('quick ranges at month and year boundaries', () => {
  const local = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10).getTime();

  it('goes back into the previous month and year', () => {
    expect(quickRange('yesterday', local(2026, 3, 1))).toEqual({ from: '2026-02-28', to: '2026-02-28' });
    expect(quickRange('yesterday', local(2028, 3, 1))).toEqual({ from: '2028-02-29', to: '2028-02-29' });
    expect(quickRange('yesterday', local(2027, 1, 1))).toEqual({ from: '2026-12-31', to: '2026-12-31' });
    expect(quickRange('last7', local(2026, 3, 3))).toEqual({ from: '2026-02-25', to: '2026-03-03' });
    expect(quickRange('last30', local(2026, 1, 15))).toEqual({ from: '2025-12-17', to: '2026-01-15' });
  });

  it('recognizes the quick range a filter equals, today only', () => {
    const now = local(2026, 10, 6);
    expect(matchQuickRange(quickRange('last7', now), now)).toBe('last7');
    expect(matchQuickRange({ from: '2026-10-06', to: '2026-10-06' }, now)).toBe('today');
    expect(matchQuickRange({ from: '2026-10-01', to: '2026-10-06' }, now)).toBeNull();
    expect(matchQuickRange(null, now)).toBeNull();
    // Yesterday's "today" is not today's.
    expect(matchQuickRange(quickRange('today', local(2026, 10, 5)), now)).toBe('yesterday');
  });
});

describe('parsing and cleaning ranges', () => {
  it('accepts only real YYYY-MM-DD dates', () => {
    expect(parseDayKey('2026-10-05')?.getDate()).toBe(5);
    expect(parseDayKey('2028-02-29')).not.toBeNull();
    for (const bad of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-10', '2026-1-5', 'abc', '', '2026-10-05T00:00']) {
      expect(parseDayKey(bad), bad).toBeNull();
    }
    expect(() => addDays('nope', 1)).toThrow();
  });

  it('drops invalid ends, swaps reversed ones, and turns nothing into no filter', () => {
    expect(normalizeRange('2026-10-05', '2026-10-01')).toEqual({ from: '2026-10-01', to: '2026-10-05' });
    expect(normalizeRange('2026-10-05', null)).toEqual({ from: '2026-10-05', to: null });
    expect(normalizeRange('garbage', '2026-10-05')).toEqual({ from: null, to: '2026-10-05' });
    expect(normalizeRange(null, null)).toBeNull();
    expect(normalizeRange('', 'x')).toBeNull();
  });

  it('compares ranges and days', () => {
    expect(sameRange({ from: 'a', to: 'b' }, { from: 'a', to: 'b' })).toBe(true);
    expect(sameRange({ from: 'a', to: 'b' }, null)).toBe(false);
    expect(isSingleDay({ from: '2026-10-05', to: '2026-10-05' })).toBe(true);
    expect(isSingleDay({ from: '2026-10-05', to: null })).toBe(false);
    expect(dayInRange('2026-10-05', { from: null, to: '2026-10-05' })).toBe(true);
    expect(dayInRange('2026-10-06', { from: null, to: '2026-10-05' })).toBe(false);
  });
});

describe('month grids', () => {
  it('starts weeks on Sunday and pads with empty cells', () => {
    // 2026-10-01 is a Thursday.
    const oct = monthGrid({ year: 2026, month: 9 });
    expect(oct).toHaveLength(5);
    expect(oct.every((w) => w.length === 7)).toBe(true);
    expect(oct[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(oct[4]).toEqual(['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']);
    // February 2026 starts on a Sunday and fills exactly four weeks.
    const feb = monthGrid({ year: 2026, month: 1 });
    expect(feb).toHaveLength(4);
    expect(feb.flat().filter(Boolean)).toHaveLength(28);
    expect(monthGrid({ year: 2028, month: 1 }).flat().filter(Boolean)).toHaveLength(29);
  });

  it('moves between months over year ends', () => {
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(addMonths({ year: 2026, month: 5 }, -18)).toEqual({ year: 2024, month: 11 });
  });
});

describe('counting and grouping by day', () => {
  const at = (day: number, hour: number) => ({ createdAt: new Date(2026, 9, day, hour).getTime(), id: `${day}-${hour}` });

  it('counts items per local day', () => {
    const counts = dayCounts([at(5, 0), at(5, 23), at(6, 1)]);
    expect([...counts]).toEqual([
      ['2026-10-05', 2],
      ['2026-10-06', 1],
    ]);
    expect(dayCounts([]).size).toBe(0);
  });

  it('groups by day in either direction and keeps the order inside a day', () => {
    const items = [at(5, 9), at(6, 1), at(5, 3)];
    expect(groupByDay(items, 'desc').map((g) => [g.day, g.items.map((i) => i.id)])).toEqual([
      ['2026-10-06', ['6-1']],
      ['2026-10-05', ['5-9', '5-3']],
    ]);
    expect(groupByDay(items, 'asc').map((g) => g.day)).toEqual(['2026-10-05', '2026-10-06']);
  });
});
