// Dates of the gallery's date filter as text, formatted for the current UI language with Intl.DateTimeFormat.
import { getLocale, t } from '@/i18n';
import { parseDayKey, type DateRange, type DayKey, type Month } from '@/state/dateFilter';

function format(key: DayKey, options: Intl.DateTimeFormatOptions): string {
  const date = parseDayKey(key);
  return date ? new Intl.DateTimeFormat(getLocale(), options).format(date) : key;
}

const NUMERIC_DAY: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };

/** A day in full, for the headers of the grouped grid (e.g. "October 5, 2026" in English). */
export function longDayLabel(key: DayKey): string {
  return format(key, { dateStyle: 'long' });
}

/** A short numeric day (e.g. "2026/10/05", "10/05/2026"). */
export function shortDayLabel(key: DayKey): string {
  return format(key, NUMERIC_DAY);
}

/**
 * The active filter in a few characters, for the chip in the gallery header: one day in full,
 * a range as month/day (with the year when it is not the current year), or an open-ended range.
 */
export function rangeLabel(range: DateRange, now: number = Date.now()): string {
  const { from, to } = range;
  if (from && to) {
    if (from === to) return shortDayLabel(from);
    const a = parseDayKey(from);
    const b = parseDayKey(to);
    if (!a || !b) return `${from} ${to}`;
    const thisYear = new Date(now).getFullYear();
    const withYear = a.getFullYear() !== thisYear || b.getFullYear() !== thisYear;
    const options: Intl.DateTimeFormatOptions = withYear ? NUMERIC_DAY : { month: '2-digit', day: '2-digit' };
    return new Intl.DateTimeFormat(getLocale(), options).formatRange(a, b);
  }
  if (from) return t('gallery.date.since', { date: shortDayLabel(from) });
  if (to) return t('gallery.date.until', { date: shortDayLabel(to) });
  return '';
}

/** Title of the calendar's month (e.g. "October 2026" in English). */
export function monthLabel({ year, month }: Month): string {
  return new Intl.DateTimeFormat(getLocale(), { year: 'numeric', month: 'long' }).format(new Date(year, month, 1));
}

/** One-letter weekday names, Sunday first, for the calendar's column heads. */
export function weekdayLabels(): string[] {
  const fmt = new Intl.DateTimeFormat(getLocale(), { weekday: 'narrow' });
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + i)));
}

/** The day number shown in a calendar cell: a bare number in every language (Intl adds a suffix in Japanese). */
export function dayOfMonthLabel(key: DayKey): string {
  return String(parseDayKey(key)?.getDate() ?? '');
}
