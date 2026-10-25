import { describe, expect, it } from 'vitest';
import { relativeTime } from './relativeTime';

const NOW = Date.UTC(2026, 9, 6, 12, 0, 0);
const MIN = 60_000;

describe('relativeTime', () => {
  it('words recent times in the given language', () => {
    expect(relativeTime(NOW - 10_000, NOW, 'en')).toBe('now');
    expect(relativeTime(NOW - 5 * MIN, NOW, 'en')).toBe('5 minutes ago');
    expect(relativeTime(NOW - 3 * 60 * MIN, NOW, 'en')).toBe('3 hours ago');
    expect(relativeTime(NOW - 24 * 60 * MIN, NOW, 'en')).toBe('yesterday');
    expect(relativeTime(NOW - 5 * MIN, NOW, 'ja')).toBe('5 分前');
  });

  it('shows the date after a week and treats future times as now', () => {
    const old = NOW - 30 * 24 * 60 * MIN;
    expect(relativeTime(old, NOW, 'en')).toBe(new Date(old).toLocaleDateString('en'));
    expect(relativeTime(NOW + 5 * MIN, NOW, 'en')).toBe('now');
  });
});
