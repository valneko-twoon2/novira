// Property tests for the date filter's labels in every shipped language: any day or range gives a text and never throws.
// In-process only (Intl, no network).
import fc from 'fast-check';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { loadLocales, LOCALES, setLocale } from '@/i18n';
import { check } from '@/propertyTest.testkit';
import { addMonths, dayKey, monthOf } from '@/state/dateFilter';
import { dayOfMonthLabel, longDayLabel, monthLabel, rangeLabel, shortDayLabel, weekdayLabels } from './dateLabels';

// Every language at hand, so setLocale switches at once inside a property.
beforeAll(() => loadLocales());
afterEach(() => setLocale('ja'));

const ms = fc.integer({ min: Date.UTC(1971, 0, 2), max: Date.UTC(2200, 0, 1) });
const key = ms.map(dayKey);
const locale = fc.constantFrom(...LOCALES);

describe('date labels (properties)', () => {
  it('day labels are non-empty text in every language, for any real day', () => {
    check(
      fc.property(locale, key, (l, k) => {
        setLocale(l);
        for (const text of [longDayLabel(k), shortDayLabel(k), dayOfMonthLabel(k)]) expect(text.length).toBeGreaterThan(0);
        expect(dayOfMonthLabel(k)).toMatch(/^\d{1,2}$/);
      }),
    );
  });

  it('any text that is not a day is shown as it is', () => {
    check(fc.property(fc.string({ maxLength: 12 }).filter((s) => !/^\d{4}-\d{2}-\d{2}$/.test(s)), (s) => longDayLabel(s) === s && shortDayLabel(s) === s));
  });

  it('rangeLabel gives a label for any range, empty only when both ends are open', () => {
    check(
      fc.property(locale, fc.option(key, { nil: null }), fc.option(key, { nil: null }), ms, (l, from, to, now) => {
        setLocale(l);
        const [a, b] = from && to && from > to ? [to, from] : [from, to];
        const label = rangeLabel({ from: a, to: b }, now);
        expect(label === '').toBe(a === null && b === null);
      }),
    );
  });

  it('month and weekday labels exist for every month and language', () => {
    check(
      fc.property(locale, key, fc.integer({ min: -60, max: 60 }), (l, k, n) => {
        setLocale(l);
        expect(monthLabel(addMonths(monthOf(k), n)).length).toBeGreaterThan(0);
        const days = weekdayLabels();
        expect(days).toHaveLength(7);
        expect(days.every((d) => d.length > 0)).toBe(true);
      }),
    );
  });
});
