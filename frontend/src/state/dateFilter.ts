// Calendar days in the user's local time zone: the gallery's date filter, quick ranges, per-day counts and month grids.
// Days are `YYYY-MM-DD` keys so they compare as strings and never drift across daylight-saving changes.

/** A calendar day in the local time zone, as `YYYY-MM-DD`. */
export type DayKey = string;

/** Inclusive range of local days. `null` leaves that end open; a filter has at least one end. */
export interface DateRange {
  from: DayKey | null;
  to: DayKey | null;
}

export const QUICK_RANGES = ['today', 'yesterday', 'last7', 'last30'] as const;
export type QuickRange = (typeof QUICK_RANGES)[number];

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function keyOf(date: Date): DayKey {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The local day an epoch-millisecond timestamp falls on. */
export function dayKey(ms: number): DayKey {
  return keyOf(new Date(ms));
}

/** Local midnight at the start of a day, or `null` for anything that is not a real `YYYY-MM-DD` date. */
export function parseDayKey(key: string): Date | null {
  const m = DAY_KEY.exec(key);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  date.setFullYear(y); // years below 100 would otherwise map to 19xx
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

export function isDayKey(key: string): boolean {
  return parseDayKey(key) !== null;
}

/** The day `n` calendar days after `key` (negative goes back). Counts days, not 24-hour steps. */
export function addDays(key: DayKey, n: number): DayKey {
  const date = parseDayKey(key);
  if (!date) throw new Error(`not a day: ${key}`);
  date.setDate(date.getDate() + n);
  return keyOf(date);
}

/** A quick range ending today (`now` is the current time). */
export function quickRange(kind: QuickRange, now: number = Date.now()): DateRange {
  const today = dayKey(now);
  switch (kind) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const day = addDays(today, -1);
      return { from: day, to: day };
    }
    case 'last7':
      return { from: addDays(today, -6), to: today };
    case 'last30':
      return { from: addDays(today, -29), to: today };
  }
}

/** Which quick range `range` is right now, if any. */
export function matchQuickRange(range: DateRange | null, now: number = Date.now()): QuickRange | null {
  if (!range) return null;
  return QUICK_RANGES.find((kind) => sameRange(quickRange(kind, now), range)) ?? null;
}

export function sameRange(a: DateRange | null, b: DateRange | null): boolean {
  return a === b || (!!a && !!b && a.from === b.from && a.to === b.to);
}

/**
 * Cleans user input into a filter: drops invalid days, swaps reversed ends.
 * Returns `null` when no valid end is left (the filter is off).
 */
export function normalizeRange(from: string | null, to: string | null): DateRange | null {
  const f = from && isDayKey(from) ? from : null;
  const t = to && isDayKey(to) ? to : null;
  if (!f && !t) return null;
  if (f && t && f > t) return { from: t, to: f };
  return { from: f, to: t };
}

export function isSingleDay(range: DateRange): boolean {
  return range.from !== null && range.from === range.to;
}

/** Whether a day lies inside the range (ends included). */
export function dayInRange(day: DayKey, range: DateRange): boolean {
  return (range.from === null || day >= range.from) && (range.to === null || day <= range.to);
}

/** Whether a timestamp falls on a day inside the range. */
export function inRange(ms: number, range: DateRange): boolean {
  return dayInRange(dayKey(ms), range);
}

/** How many items fall on each local day. */
export function dayCounts(items: readonly { createdAt: number }[]): Map<DayKey, number> {
  const counts = new Map<DayKey, number>();
  for (const item of items) {
    const day = dayKey(item.createdAt);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return counts;
}

/** A month as `{ year, month }` with `month` 0–11 (like `Date`). */
export interface Month {
  year: number;
  month: number;
}

export function monthOf(key: DayKey): Month {
  const date = parseDayKey(key);
  if (!date) throw new Error(`not a day: ${key}`);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function addMonths({ year, month }: Month, n: number): Month {
  const total = year * 12 + month + n;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/**
 * The weeks of a month for a calendar, Sunday first. Cells outside the month are `null`;
 * every week has seven cells.
 */
export function monthGrid({ year, month }: Month): (DayKey | null)[][] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (DayKey | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${pad(year, 4)}-${pad(month + 1)}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (DayKey | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * Splits a list into runs of the same local day, ordered by day (`desc` = newest day first).
 * Items keep their order inside a day, so starred-first sorting still applies within each day.
 */
export function groupByDay<T extends { createdAt: number }>(items: readonly T[], direction: 'desc' | 'asc'): { day: DayKey; items: T[] }[] {
  const groups = new Map<DayKey, T[]>();
  for (const item of items) {
    const day = dayKey(item.createdAt);
    const group = groups.get(day);
    if (group) group.push(item);
    else groups.set(day, [item]);
  }
  const days = [...groups.keys()].sort();
  if (direction === 'desc') days.reverse();
  return days.map((day) => ({ day, items: groups.get(day)! }));
}
