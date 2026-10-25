// Filtering and copying the developer log.
import { describe, expect, it } from 'vitest';
import type { DevLogEntry } from '@/state/devLog';
import { entryText, filterEntries } from './DevLogPanel';

const e = (id: number, level: DevLogEntry['level'], source: string, message: string): DevLogEntry => ({ id, at: 0, level, source, message });
const entries = [e(1, 'info', 'backend', 'engine ready'), e(2, 'warn', 'console', 'slow frame'), e(3, 'error', 'queue', 'job 4 failed: Out of memory')];

describe('developer log panel', () => {
  it('filters by minimum level', () => {
    expect(filterEntries(entries, 'all', '')).toHaveLength(3);
    expect(filterEntries(entries, 'warn', '').map((x) => x.id)).toEqual([2, 3]);
    expect(filterEntries(entries, 'error', '').map((x) => x.id)).toEqual([3]);
  });

  it('filters by text in the source or the message, ignoring case', () => {
    expect(filterEntries(entries, 'all', 'QUEUE').map((x) => x.id)).toEqual([3]);
    expect(filterEntries(entries, 'all', 'memory').map((x) => x.id)).toEqual([3]);
    expect(filterEntries(entries, 'error', 'engine')).toEqual([]);
  });

  it('writes a line as plain text', () => {
    expect(entryText(entries[2]!)).toBe('1970-01-01T00:00:00.000Z ERROR [queue] job 4 failed: Out of memory');
  });
});
