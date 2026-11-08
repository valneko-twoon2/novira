// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backend, type CivitaiModel, type CivitaiSearchParams, type CivitaiSearchResult } from '@/backend';
import { FRESH_MS, useCivitaiSearch } from './useCivitaiSearch';

type Params = Omit<CivitaiSearchParams, 'cursor'>;

// The first-page cache lives in the module, so every test searches for its own words.
const params = (query: string): Params => ({ query, kind: 'all', baseModel: 'all', sort: 'downloads', period: 'all', includeNsfw: false });
const model = (id: string) => ({ id, name: id }) as CivitaiModel;
const page = (ids: string[], nextCursor: string | null): CivitaiSearchResult => ({ items: ids.map(model), nextCursor });
const ids = (items: CivitaiModel[]) => items.map((m) => m.id);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useCivitaiSearch', () => {
  it('loads the first page and reports whether there is more', async () => {
    vi.spyOn(backend, 'searchCivitai').mockResolvedValue(page(['a', 'b'], 'c2'));
    const { result } = renderHook(() => useCivitaiSearch(params('first')));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(ids(result.current.items)).toEqual(['a', 'b']);
    expect(result.current.hasMore).toBe(true);
  });

  it('has no more pages when the backend returns no cursor', async () => {
    vi.spyOn(backend, 'searchCivitai').mockResolvedValue(page(['a'], null));
    const { result } = renderHook(() => useCivitaiSearch(params('lastpage')));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.hasMore).toBe(false);
    const search = vi.mocked(backend.searchCivitai);
    act(() => result.current.loadMore());
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('appends the next page with the cursor of the previous one', async () => {
    const search = vi.spyOn(backend, 'searchCivitai').mockResolvedValueOnce(page(['a'], 'c2')).mockResolvedValueOnce(page(['b'], null));
    const { result } = renderHook(() => useCivitaiSearch(params('paging')));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.loadMore());
    expect(result.current.loadingMore).toBe(true);
    await waitFor(() => expect(result.current.loadingMore).toBe(false));
    expect(ids(result.current.items)).toEqual(['a', 'b']);
    expect(result.current.hasMore).toBe(false);
    expect(search.mock.calls[0]![0].cursor).toBeNull();
    expect(search.mock.calls[1]![0].cursor).toBe('c2');
  });

  it('reports an error with its message, and retry searches again from the first page', async () => {
    const search = vi.spyOn(backend, 'searchCivitai').mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(page(['a'], null));
    const { result } = renderHook(() => useCivitaiSearch(params('failing')));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('offline');
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(ids(result.current.items)).toEqual(['a']);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('reports a plain string rejection as the error text', async () => {
    vi.spyOn(backend, 'searchCivitai').mockRejectedValue('rate limited');
    const { result } = renderHook(() => useCivitaiSearch(params('stringerr')));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('rate limited');
  });

  it('ignores the answer to an earlier search once the parameters changed', async () => {
    let resolveOld!: (r: CivitaiSearchResult) => void;
    vi.spyOn(backend, 'searchCivitai').mockImplementation((p) =>
      p.query === 'stale-old' ? new Promise((resolve) => (resolveOld = resolve)) : Promise.resolve(page(['new'], null)),
    );
    const { result, rerender } = renderHook(({ q }) => useCivitaiSearch(params(q)), { initialProps: { q: 'stale-old' } });
    rerender({ q: 'stale-new' });
    await waitFor(() => expect(ids(result.current.items)).toEqual(['new']));
    await act(async () => resolveOld(page(['old'], null)));
    expect(ids(result.current.items)).toEqual(['new']);
  });

  it('shows a search seen long ago at once, and refreshes it', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const search = vi.spyOn(backend, 'searchCivitai').mockResolvedValue(page(['a'], 'c2'));
    const first = renderHook(() => useCivitaiSearch(params('cached')));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    first.unmount();
    now.mockReturnValue(1_000_000 + FRESH_MS + 1);
    let resolveSecond!: (r: CivitaiSearchResult) => void;
    search.mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));
    const second = renderHook(() => useCivitaiSearch(params('cached')));
    expect(second.result.current.status).toBe('ready');
    expect(ids(second.result.current.items)).toEqual(['a']);
    expect(second.result.current.hasMore).toBe(true);
    await act(async () => resolveSecond(page(['fresh'], null)));
    expect(ids(second.result.current.items)).toEqual(['fresh']);
  });

  it('does not search again when the tab is opened again within a few minutes, and a retry still does', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(5_000_000);
    const search = vi.spyOn(backend, 'searchCivitai').mockResolvedValue(page(['a'], 'c2'));
    const first = renderHook(() => useCivitaiSearch(params('reopened')));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    // The first search and the page asked for ahead of it.
    expect(search).toHaveBeenCalledTimes(2);
    first.unmount();
    now.mockReturnValue(5_000_000 + FRESH_MS - 1);
    const second = renderHook(() => useCivitaiSearch(params('reopened')));
    expect(second.result.current.status).toBe('ready');
    expect(ids(second.result.current.items)).toEqual(['a']);
    expect(second.result.current.hasMore).toBe(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(search).toHaveBeenCalledTimes(2);
    // More pages are still asked for when wanted, from the saved cursor.
    search.mockResolvedValueOnce(page(['b'], null));
    act(() => second.result.current.loadMore());
    await waitFor(() => expect(ids(second.result.current.items)).toEqual(['a', 'b']));
    expect(search.mock.calls.at(-1)![0].cursor).toBe('c2');
    act(() => second.result.current.retry());
    await waitFor(() => expect(search.mock.calls.some((c, i) => i >= 3 && c[0].cursor === null)).toBe(true));
  });

  it('asks for the next page as soon as a page arrives, and uses that answer when more is wanted', async () => {
    const search = vi.spyOn(backend, 'searchCivitai').mockResolvedValueOnce(page(['a'], 'c2')).mockResolvedValueOnce(page(['b'], 'c3')).mockResolvedValueOnce(page(['c'], null));
    const { result } = renderHook(() => useCivitaiSearch(params('ahead')));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
    expect(search.mock.calls[1]![0].cursor).toBe('c2');
    act(() => result.current.loadMore());
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a', 'b']));
    // The page shown asked for the one after it, and loading more did not ask for the same page twice.
    await waitFor(() => expect(search).toHaveBeenCalledTimes(3));
    expect(search.mock.calls.map((c) => c[0].cursor)).toEqual([null, 'c2', 'c3']);
  });

  it('asks again when the page asked for ahead of time failed', async () => {
    const search = vi.spyOn(backend, 'searchCivitai').mockResolvedValueOnce(page(['a'], 'c2')).mockRejectedValueOnce(new Error('busy')).mockResolvedValueOnce(page(['b'], null));
    const { result } = renderHook(() => useCivitaiSearch(params('ahead-fails')));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
    act(() => result.current.loadMore());
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a', 'b']));
    expect(search).toHaveBeenCalledTimes(3);
  });

  it('does not use a page asked for ahead for another search', async () => {
    const search = vi.spyOn(backend, 'searchCivitai').mockImplementation((p) => Promise.resolve(p.query === 'ahead-x' ? page(['x'], p.cursor ? null : 'cx') : page(['y'], null)));
    const { result, rerender } = renderHook(({ q }) => useCivitaiSearch(params(q)), { initialProps: { q: 'ahead-x' } });
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
    rerender({ q: 'ahead-y' });
    await waitFor(() => expect(ids(result.current.items)).toEqual(['y']));
    expect(result.current.hasMore).toBe(false);
  });

  it('shows a model once even when a later page, or the same page, brings it again', async () => {
    vi.spyOn(backend, 'searchCivitai').mockResolvedValueOnce(page(['a', 'a', 'b'], 'c2')).mockResolvedValueOnce(page(['b', 'c'], null));
    const { result } = renderHook(() => useCivitaiSearch(params('dupes')));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(ids(result.current.items)).toEqual(['a', 'b']);
    act(() => result.current.loadMore());
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a', 'b', 'c']));
  });
});
