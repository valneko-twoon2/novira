// The short form of a batch id and the time a job took, for any id and any times.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { QueueItem } from '@/backend';
import { blockExternalNetwork, check } from '@/propertyTest.testkit';
import { durationSeconds, shortId } from './queueFormat';

blockExternalNetwork();

describe('the short form of a batch id (properties)', () => {
  it('is never empty for an id, and never longer than the id would let it be', () => {
    check(fc.property(fc.string({ minLength: 1, maxLength: 60 }), (id) => {
      const short = shortId(id);
      expect(short.length).toBeGreaterThan(0);
      expect(short.length).toBeLessThanOrEqual(Math.max(id.length, 8) + 1);
    }));
  });

  it('never ends with a dash for an id made of a prefix and a hex part', () => {
    const hex = fc.stringMatching(/^[0-9a-f]{12}$/);
    check(fc.property(fc.constantFrom('batch', 'b', 'job'), hex, fc.option(hex, { nil: undefined }), (prefix, a, b) => {
      const id = [prefix, a, b].filter(Boolean).join('-');
      expect(shortId(id).endsWith('-')).toBe(false);
    }));
  });
});

describe('how long a job took (properties)', () => {
  it('is null unless both times are known, and never negative', () => {
    const time = fc.option(fc.integer({ min: 0, max: 2 ** 40 }), { nil: null });
    check(fc.property(time, time, (startedAt, completedAt) => {
      const seconds = durationSeconds({ startedAt, completedAt } as QueueItem);
      if (startedAt === null || completedAt === null) expect(seconds).toBeNull();
      else expect(seconds).toBeGreaterThanOrEqual(0);
    }));
  });
});
