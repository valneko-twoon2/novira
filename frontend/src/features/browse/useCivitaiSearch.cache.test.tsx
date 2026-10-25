// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backend, type CivitaiModel, type CivitaiSearchParams, type CivitaiSearchResult } from '@/backend';
import { readCachedPage, writeCachedPage } from './pageCache';
import { useCivitaiSearch } from './useCivitaiSearch';

vi.mock('./pageCache', () => ({ readCachedPage: vi.fn(), writeCachedPage: vi.fn() }));

type Params = Omit<CivitaiSearchParams, 'cursor'>;
const params = (query: string): Params => ({ query, kind: 'all', baseModel: 'all', sort: 'downloads', period: 'all', includeNsfw: false });
const model = (id: string) => ({ id, name: id }) as CivitaiModel;
const page = (ids: string[], nextCursor: string | null): CivitaiSearchResult => ({ items: ids.map(model), nextCursor });
const ids = (items: CivitaiModel[]) => items.map((m) => m.id);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(readCachedPage).mockReset();
  vi.mocked(writeCachedPage).mockReset();
});

describe('useCivitaiSearch with the page saved on disk', () => {
  it('shows the saved page while the search runs, then the answer, and saves the answer', async () => {
    vi.mocked(readCachedPage).mockResolvedValue({ items: [model('old')], next: 'c-old' });
    let answer: (r: CivitaiSearchResult) => void = () => {};
    vi.spyOn(backend, 'searchCivitai').mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const { result } = renderHook(() => useCivitaiSearch(params('disk-1')));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(ids(result.current.items)).toEqual(['old']);
    expect(result.current.hasMore).toBe(true);
    answer(page(['new'], null));
    await waitFor(() => expect(ids(result.current.items)).toEqual(['new']));
    expect(result.current.hasMore).toBe(false);
    expect(vi.mocked(writeCachedPage)).toHaveBeenCalledWith(expect.any(String), { items: [model('new')], next: null });
  });

  it('does not let a late disk read replace an answer that already came', async () => {
    let read: (p: { items: CivitaiModel[]; next: string | null } | null) => void = () => {};
    vi.mocked(readCachedPage).mockReturnValue(new Promise((resolve) => (read = resolve)));
    vi.spyOn(backend, 'searchCivitai').mockResolvedValue(page(['new'], null));
    const { result } = renderHook(() => useCivitaiSearch(params('disk-2')));
    await waitFor(() => expect(ids(result.current.items)).toEqual(['new']));
    read({ items: [model('old')], next: 'x' });
    await new Promise((r) => setTimeout(r, 10));
    expect(ids(result.current.items)).toEqual(['new']);
    expect(result.current.hasMore).toBe(false);
  });

  it('keeps the saved page on show when the search fails, and shows the error when there was none', async () => {
    vi.mocked(readCachedPage).mockResolvedValue({ items: [model('old')], next: null });
    vi.spyOn(backend, 'searchCivitai').mockRejectedValue(new Error('offline'));
    const kept = renderHook(() => useCivitaiSearch(params('disk-3')));
    await waitFor(() => expect(ids(kept.result.current.items)).toEqual(['old']));
    await new Promise((r) => setTimeout(r, 10));
    expect(kept.result.current.status).toBe('ready');
    cleanup();
    vi.mocked(readCachedPage).mockResolvedValue(null);
    const none = renderHook(() => useCivitaiSearch(params('disk-4')));
    await waitFor(() => expect(none.result.current.status).toBe('error'));
  });
});
