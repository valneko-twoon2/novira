// Paged search against the backend with stale-response protection.
import { useCallback, useEffect, useRef, useState } from 'react';
import { backend, type CivitaiModel, type CivitaiSearchParams, type CivitaiSearchResult } from '@/backend';
import { readCachedPage, writeCachedPage } from './pageCache';

// First pages by search params, so returning to a search already seen shows at once (and, from the disk cache, after a restart).
const firstPages = new Map<string, { items: CivitaiModel[]; next: string | null }>();

/** The next page after the ones shown. A search split by base model can bring a model again on a later page, and cards are keyed by id. */
function appendNew(prev: CivitaiModel[], next: CivitaiModel[]): CivitaiModel[] {
  const seen = new Set(prev.map((m) => m.id));
  return [...prev, ...next.filter((m) => !seen.has(m.id) && seen.add(m.id))];
}

export type SearchStatus = 'loading' | 'ready' | 'error';

export function useCivitaiSearch(params: Omit<CivitaiSearchParams, 'cursor'>, enabled = true) {
  const [items, setItems] = useState<CivitaiModel[]>([]);
  const [status, setStatus] = useState<SearchStatus>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const cursor = useRef<string | null>(null);
  const token = useRef(0);
  const paramsKey = JSON.stringify(params);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  // The page after the last one shown, asked for as soon as the last one arrived, so scrolling down finds it there.
  const ahead = useRef<{ key: string; cursor: string; page: Promise<CivitaiSearchResult> } | null>(null);

  const run = useCallback((append: boolean) => {
    const id = ++token.current;
    let answered = false;
    let fromDisk = false;
    if (append) setLoadingMore(true);
    else {
      const hit = firstPages.get(paramsKey);
      cursor.current = hit?.next ?? null;
      setItems(hit?.items ?? []);
      setStatus(hit ? 'ready' : 'loading');
      // Not seen since the app started: the page saved on disk shows until the search answers (it always runs again).
      if (!hit) {
        void readCachedPage(paramsKey).then((saved) => {
          if (!saved || answered || id !== token.current) return;
          fromDisk = true;
          cursor.current = saved.next;
          setItems(saved.items);
          setStatus('ready');
        });
      }
    }
    const want = append ? cursor.current : null;
    const asked = ahead.current;
    ahead.current = null;
    const search = () => backend.searchCivitai({ ...paramsRef.current, cursor: want });
    // A page asked for ahead of time is used when it is the one wanted; if that request failed, ask again.
    const request = want !== null && asked?.key === paramsKey && asked.cursor === want ? asked.page.catch(search) : search();
    request
      .then((res) => {
        if (id !== token.current) return;
        answered = true;
        cursor.current = res.nextCursor;
        if (!append) {
          firstPages.set(paramsKey, { items: res.items, next: res.nextCursor });
          void writeCachedPage(paramsKey, { items: res.items, next: res.nextCursor });
        }
        setItems((prev) => (append ? appendNew(prev, res.items) : appendNew([], res.items)));
        setStatus('ready');
        setLoadingMore(false);
        const next = res.nextCursor;
        if (next) {
          const page = backend.searchCivitai({ ...paramsRef.current, cursor: next });
          void page.catch(() => undefined);
          ahead.current = { key: paramsKey, cursor: next, page };
        }
      })
      .catch((err: unknown) => {
        if (id !== token.current) return;
        answered = true;
        // The saved results stay on show when the search fails (offline): they were good when they were saved.
        if (fromDisk) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
        setLoadingMore(false);
      });
  }, [paramsKey]);

  useEffect(() => {
    if (!enabled) return;
    const tok = token;
    run(false);
    return () => {
      tok.current++;
    };
  }, [paramsKey, run, enabled]);

  const hasMore = status === 'ready' && cursor.current !== null;
  const loadMore = useCallback(() => {
    if (cursor.current !== null) run(true);
  }, [run]);
  const retry = useCallback(() => run(false), [run]);
  return { items, status, error, loadingMore, hasMore, loadMore, retry };
}
