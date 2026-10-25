// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { PHONE_QUERY, usePhoneLayout } from './layout';

/** A `matchMedia` whose answer for the phone query the test sets, telling its listeners when it changes. */
function fakeMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query === PHONE_QUERY && matches;
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }));
  return (next: boolean) =>
    act(() => {
      matches = next;
      listeners.forEach((fn) => fn());
    });
}

beforeEach(() => {
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the phone layout', () => {
  it('follows the size of the window as it changes', () => {
    const resize = fakeMedia(false);
    const { result } = renderHook(() => usePhoneLayout());
    expect(result.current).toBe(false);
    resize(true);
    expect(result.current).toBe(true);
    resize(false);
    expect(result.current).toBe(false);
  });

  it('is never shown in the desktop app, however narrow its window', () => {
    fakeMedia(true);
    vi.spyOn(backend, 'kind', 'get').mockReturnValue('tauri');
    expect(renderHook(() => usePhoneLayout()).result.current).toBe(false);
  });

  it('is the desktop layout where the browser cannot tell the size', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(renderHook(() => usePhoneLayout()).result.current).toBe(false);
  });
});
