import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUuid } from './randomUuid';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe('randomUuid', () => {
  it('uses the browser\'s own on a secure page', () => {
    expect(randomUuid()).toMatch(V4);
  });

  it('makes a version 4 id from random bytes where the page is not secure', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array<ArrayBuffer>) => real.getRandomValues(a) });
    const ids = new Set(Array.from({ length: 200 }, randomUuid));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(V4);
    // The version and variant bits are set whatever the bytes are.
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => a.fill(0xff) });
    expect(randomUuid()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => a.fill(0) });
    expect(randomUuid()).toBe('00000000-0000-4000-8000-000000000000');
  });
});
