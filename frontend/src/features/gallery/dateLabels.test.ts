import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '@/i18n';
import { dayOfMonthLabel, longDayLabel, monthLabel, rangeLabel, shortDayLabel, weekdayLabels } from './dateLabels';

afterEach(() => setLocale('ja'));

const now = new Date(2026, 9, 6, 12).getTime();

describe('date labels', () => {
  it('formats days for the current language', () => {
    setLocale('ja');
    expect(longDayLabel('2026-10-05')).toBe('2026年10月5日');
    expect(shortDayLabel('2026-10-05')).toBe('2026/10/05');
    expect(monthLabel({ year: 2026, month: 9 })).toBe('2026年10月');
    setLocale('en');
    expect(longDayLabel('2026-10-05')).toBe('October 5, 2026');
    expect(shortDayLabel('2026-10-05')).toBe('10/05/2026');
    expect(monthLabel({ year: 2026, month: 9 })).toBe('October 2026');
  });

  it('labels one day in full and a range of this year by month and day', () => {
    setLocale('ja');
    expect(rangeLabel({ from: '2026-10-05', to: '2026-10-05' }, now)).toBe('2026/10/05');
    const range = rangeLabel({ from: '2026-10-01', to: '2026-10-05' }, now);
    expect(range).toMatch(/^10\/01\s*[–～~-]\s*(10\/)?05$/);
    expect(range).not.toContain('2026');
  });

  it('adds the year to a range outside the current year', () => {
    setLocale('en');
    expect(rangeLabel({ from: '2025-12-30', to: '2026-01-02' }, now)).toContain('2025');
  });

  it('labels open-ended ranges through the catalog', () => {
    setLocale('ja');
    expect(rangeLabel({ from: '2026-10-01', to: null }, now)).toBe('2026/10/01 以降');
    setLocale('en');
    expect(rangeLabel({ from: null, to: '2026-10-01' }, now)).toBe('Until 10/01/2026');
    expect(rangeLabel({ from: null, to: null }, now)).toBe('');
  });

  it('names the weekdays Sunday first and shows bare day numbers', () => {
    setLocale('ja');
    expect(weekdayLabels()).toEqual(['日', '月', '火', '水', '木', '金', '土']);
    setLocale('en');
    expect(weekdayLabels()).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
    expect(dayOfMonthLabel('2026-10-05')).toBe('5');
  });
});
