// Property tests for the session list's relative times: any time, now and language gives text. In-process only.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/i18n';
import { check } from '@/propertyTest.testkit';
import { relativeTime } from './relativeTime';

const ms = fc.integer({ min: 0, max: Date.UTC(2200, 0, 1) });

describe('relativeTime (properties)', () => {
  it('gives non-empty text for any pair of times (even one in the future) in every language', () => {
    check(fc.property(ms, ms, fc.constantFrom(...LOCALES), (time, now, locale) => relativeTime(time, now, locale).length > 0));
  });

  it('a time that is not in the past counts as "now" and is the same as the time itself', () => {
    check(fc.property(ms, fc.nat(1000), fc.constantFrom(...LOCALES), (now, ahead, locale) => relativeTime(now + ahead, now, locale) === relativeTime(now, now, locale)));
  });

  it('never throws for broken numbers', () => {
    for (const bad of [NaN, Infinity, -Infinity]) expect(() => relativeTime(bad, 0, 'en')).not.toThrow();
    for (const bad of [NaN, Infinity]) expect(() => relativeTime(0, bad, 'en')).not.toThrow();
  });
});
