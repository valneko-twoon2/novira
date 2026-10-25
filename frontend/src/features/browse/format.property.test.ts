// Property tests for the number and size text of model stats. In-process only (no network).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { check } from '@/propertyTest.testkit';
import { formatCount, formatSize } from './format';

describe('model stat formats (properties)', () => {
  it('formatSize gives a dash, a whole number of MB or a GB with one decimal, for any size', () => {
    check(fc.property(fc.oneof(fc.integer({ min: -10, max: 2 ** 45 }), fc.double({ min: 0, max: 1e15, noNaN: true })), (bytes) => /^(—|\d+ MB|\d+\.\d GB)$/.test(formatSize(bytes))));
  });

  it('formatSize is monotone in the size it shows (never smaller for a bigger file)', () => {
    const value = (s: string) => (s === '—' ? 0 : s.endsWith('GB') ? parseFloat(s) * 1024 : parseFloat(s));
    check(fc.property(fc.integer({ min: 1, max: 2 ** 40 }), fc.integer({ min: 0, max: 2 ** 40 }), (a, d) => value(formatSize(a + d)) >= value(formatSize(a)) - 1));
  });

  it('formatCount gives text for any count', () => {
    check(fc.property(fc.oneof(fc.integer(), fc.double({ noNaN: false })), (n) => formatCount(n).length > 0));
  });

  // Regression: a size that is not a number (a broken value from a service) is shown as a dash, not "NaN MB".
  it('shows a dash for a size that is not a number', () => {
    expect(formatSize(NaN)).toBe('—');
  });
});
