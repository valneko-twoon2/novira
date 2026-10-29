// The queue's times: a finished job's duration, and the clock time shown for a moment.
import { describe, expect, it } from 'vitest';
import type { QueueItem } from '@/backend';
import { durationSeconds, formatTime } from './queueFormat';

const timed = (startedAt: number | null, completedAt: number | null) => ({ startedAt, completedAt }) as QueueItem;

describe('durationSeconds', () => {
  it('is the seconds between the start and the completion', () => {
    expect(durationSeconds(timed(1_000, 4_500))).toBe(3.5);
  });

  it('is null until the job has both started and completed', () => {
    expect(durationSeconds(timed(null, 4_500))).toBeNull();
    expect(durationSeconds(timed(1_000, null))).toBeNull();
    expect(durationSeconds(timed(null, null))).toBeNull();
  });

  it('is never negative when the clock went back', () => {
    expect(durationSeconds(timed(5_000, 1_000))).toBe(0);
  });
});

describe('formatTime', () => {
  it('is empty without a moment', () => {
    expect(formatTime(null)).toBe('');
  });

  it('shows the hour, minute and second of the moment', () => {
    const moment = new Date(2026, 9, 29, 13, 5, 7).getTime();
    expect(formatTime(moment)).toMatch(/13:05:07|01:05:07/);
  });
});
