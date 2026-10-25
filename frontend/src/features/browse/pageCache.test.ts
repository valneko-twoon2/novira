// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readCachedPage, writeCachedPage } from './pageCache';

// jsdom has no IndexedDB: the cache must then read nothing and fail nothing.
describe('pageCache without IndexedDB', () => {
  it('reads nothing and writes without failing', async () => {
    expect(typeof indexedDB).toBe('undefined');
    await expect(writeCachedPage('k', { items: [], next: null })).resolves.toBeUndefined();
    await expect(readCachedPage('k')).resolves.toBeNull();
  });
});
