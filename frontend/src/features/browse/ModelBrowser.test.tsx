// @vitest-environment jsdom
// The online model browser tab: loading skeletons, results, empty and error states with retry, paging, the detail drawer.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type CivitaiModel, type CivitaiSearchResult } from '@/backend';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { TooltipProvider } from '@/ui';
import { useBrowse } from './browseStore';
import { ModelBrowser } from './ModelBrowser';

vi.mock('./covers', async (original) => ({ ...(await original<typeof import('./covers')>()), coverUrl: () => 'blob:cover' }));

const initial = { browse: useBrowse.getState(), models: useModels.getState() };
const found = (id: string): CivitaiModel =>
  ({
    id,
    name: `Model ${id}`,
    creator: 'someone',
    kind: 'LoRA',
    baseModel: 'SDXL 1.0',
    commercial: 'allowed',
    permissions: [],
    license: [],
    source: 'civitai',
    downloads: 10,
    likes: 1,
    rating: 4,
    ratingCount: 2,
    imageCount: 1,
    tags: [],
    triggerWords: [],
    description: 'desc',
    versions: [{ id: `${id}-v`, name: 'v1', baseModel: 'SDXL 1.0', createdAt: 0, triggerWords: [], files: [{ id: `${id}-f`, name: `${id}.safetensors`, sizeBytes: 1024, format: 'SafeTensor', precision: 'fp16' }] }],
  }) as unknown as CivitaiModel;
const page = (ids: string[], nextCursor: string | null): CivitaiSearchResult => ({ items: ids.map(found), nextCursor });

let observers: { cb: IntersectionObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] = [];

// The first-page cache of the search hook lives in the module, so each test searches for its own words.
let n = 0;
const searchWord = () => `browser-test-${++n}`;
const show = () =>
  render(
    <TooltipProvider>
      <ModelBrowser />
    </TooltipProvider>,
  );

beforeEach(() => {
  observers = [];
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      disconnect = vi.fn();
      constructor(cb: IntersectionObserverCallback) {
        observers.push({ cb, disconnect: this.disconnect });
      }
      observe() {}
      unobserve() {}
    },
  );
  useBrowse.setState({ ...initial.browse, query: searchWord() }, true);
  useModels.setState(initial.models, true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ModelBrowser', () => {
  it('shows skeleton cards while loading, then the models and the end marker', async () => {
    vi.spyOn(backend, 'searchCivitai').mockResolvedValue(page(['a', 'b'], null));
    const { container } = show();
    expect(container.querySelectorAll('.browse-skeleton')).toHaveLength(10);
    await waitFor(() => expect(screen.getAllByTestId('browse-card')).toHaveLength(2));
    expect(screen.getByText(t('browse.status.end'))).toBeTruthy();
  });

  it('says when nothing was found', async () => {
    vi.spyOn(backend, 'searchCivitai').mockResolvedValue(page([], null));
    show();
    expect(await screen.findByText(t('browse.status.empty'))).toBeTruthy();
  });

  it('shows the error and searches again with Retry', async () => {
    const search = vi.spyOn(backend, 'searchCivitai').mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(page(['a'], null));
    show();
    expect(await screen.findByText(t('browse.status.error'))).toBeTruthy();
    expect(screen.getByText('offline')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('browse.status.retry') }));
    await waitFor(() => expect(screen.getAllByTestId('browse-card')).toHaveLength(1));
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('loads the next page with the button and when the end of the list scrolls into view', async () => {
    const search = vi
      .spyOn(backend, 'searchCivitai')
      .mockResolvedValueOnce(page(['a'], 'c2'))
      .mockResolvedValueOnce(page(['b'], 'c3'))
      .mockResolvedValueOnce(page(['c'], null));
    show();
    await waitFor(() => expect(screen.getAllByTestId('browse-card')).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: t('browse.status.loadMore') }));
    await waitFor(() => expect(screen.getAllByTestId('browse-card')).toHaveLength(2));
    // A stale or off-screen report does nothing; one that says "visible" loads the following page.
    const before = search.mock.calls.length;
    const latest = observers.at(-1)!;
    act(() => latest.cb([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(search.mock.calls.length).toBe(before);
    act(() => latest.cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    await waitFor(() => expect(screen.getAllByTestId('browse-card')).toHaveLength(3));
    expect(screen.queryByRole('button', { name: t('browse.status.loadMore') })).toBeNull();
  });

  it('opens the detail drawer of a card and closes it again', async () => {
    vi.spyOn(backend, 'searchCivitai').mockResolvedValue(page(['a'], null));
    show();
    fireEvent.click(await screen.findByTestId('browse-card'));
    expect(useBrowse.getState().selected?.id).toBe('a');
    fireEvent.click(await screen.findByRole('button', { name: t('common.close') }));
    expect(useBrowse.getState().selected).toBeNull();
  });

  it('copies the typed query into the filters after a short pause', async () => {
    vi.spyOn(backend, 'searchCivitai').mockResolvedValue(page(['a'], null));
    show();
    await screen.findAllByTestId('browse-card');
    const box = screen.getByTestId('browse-search');
    fireEvent.change(box, { target: { value: 'cats and dogs' } });
    await waitFor(() => expect(useBrowse.getState().query).toBe('cats and dogs'));
  });

  it('shows the address box instead of a name search for Hugging Face, and searches Civitai only', async () => {
    const search = vi.spyOn(backend, 'searchCivitai').mockResolvedValue(page(['a'], null));
    useBrowse.setState({ source: 'huggingface' });
    show();
    expect(screen.getByTestId('browse-hf-input')).toBeTruthy();
    expect(screen.queryByTestId('browse-search')).toBeNull();
    expect(screen.queryByTestId('browse-kind-LoRA')).toBeNull();
    expect(search).not.toHaveBeenCalled();
  });
});
