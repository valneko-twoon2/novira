// @vitest-environment jsdom
// The model browser's filter bar: source and kind tabs, the search box and the mature-content switch.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { TooltipProvider } from '@/ui';
import { BrowseBar } from './BrowseBar';
import { CARD_MAX, CARD_MIN, useBrowse } from './browseStore';

const initial = useBrowse.getState();

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useBrowse.setState(initial, true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const show = (onQuery = vi.fn(), query = '') => {
  render(
    <TooltipProvider>
      <BrowseBar queryInput={query} onQueryInput={onQuery} />
    </TooltipProvider>,
  );
  return onQuery;
};

describe('BrowseBar', () => {
  it('switches the source between Civitai and Hugging Face, and only Civitai has a period filter', () => {
    show();
    expect(screen.getByLabelText(t('browse.period.label'))).toBeTruthy();
    fireEvent.click(screen.getByTestId('browse-source-huggingface'));
    expect(useBrowse.getState().source).toBe('huggingface');
    expect(screen.queryByLabelText(t('browse.period.label'))).toBeNull();
    expect(screen.getByTestId('browse-source-huggingface').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByTestId('browse-source-civitai'));
    expect(useBrowse.getState().source).toBe('civitai');
  });

  it('starts on every base and offers Anima among the bases', () => {
    show();
    expect(useBrowse.getState().baseModel).toBe('all');
    fireEvent.click(screen.getByLabelText(t('browse.base.label')));
    fireEvent.click(screen.getByRole('option', { name: t('browse.base.anima') }));
    expect(useBrowse.getState().baseModel).toBe('Anima');
  });

  it('picks the kind of model', () => {
    show();
    for (const kind of ['Checkpoint', 'ControlNet', 'VAE', 'Diffusion', 'all', 'LoRA'] as const) {
      fireEvent.click(screen.getByTestId(`browse-kind-${kind}`));
      expect(useBrowse.getState().kind).toBe(kind);
    }
  });

  it('reports what is typed in the search box', () => {
    const onQuery = show(vi.fn(), 'cat');
    const box = screen.getByTestId('browse-search') as HTMLInputElement;
    expect(box.value).toBe('cat');
    fireEvent.change(box, { target: { value: 'cats' } });
    expect(onQuery).toHaveBeenCalledWith('cats');
  });

  it('turns mature content on and off', () => {
    show();
    const toggle = screen.getByRole('switch', { name: t('browse.nsfw.label') });
    fireEvent.click(toggle);
    expect(useBrowse.getState().includeNsfw).toBe(true);
    fireEvent.click(toggle);
    expect(useBrowse.getState().includeNsfw).toBe(false);
  });

  it('sets the card size within its limits', () => {
    show();
    useBrowse.getState().setCardSize(5000);
    expect(useBrowse.getState().cardSize).toBe(CARD_MAX);
    useBrowse.getState().setCardSize(1);
    expect(useBrowse.getState().cardSize).toBe(CARD_MIN);
    expect(screen.getByTestId('browse-card-size')).toBeTruthy();
  });

  it('folds the controls behind one button on a phone', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    show();
    expect(screen.queryByTestId('browse-search')).toBeNull();
    fireEvent.click(screen.getByTestId('browse-menu'));
    expect(screen.getByTestId('browse-search')).toBeTruthy();
    expect(screen.getByTestId('browse-card-size')).toBeTruthy();
    fireEvent.click(screen.getByTestId('browse-menu'));
    expect(screen.queryByTestId('browse-search')).toBeNull();
  });
});
