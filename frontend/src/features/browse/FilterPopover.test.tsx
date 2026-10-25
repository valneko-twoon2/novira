// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { t } from '@/i18n';
import { searchCivitaiModels } from '@/backend/mock/civitaiSearch';
import { useBrowse } from './browseStore';
import { activeFilterCount, FilterPopover } from './FilterPopover';

const reset = () => useBrowse.setState({ kind: 'LoRA', licenses: [], checkpointType: '', safetensorsOnly: false, creator: '' });
beforeEach(reset);
afterEach(() => {
  cleanup();
  reset();
});

const openFilters = () => fireEvent.click(screen.getByTestId('browse-filters'));

describe('FilterPopover', () => {
  it('sets a license permission, counts the filters set and clears them', () => {
    render(<FilterPopover />);
    expect(screen.queryByTestId('browse-filters-count')).toBeNull();
    openFilters();
    fireEvent.click(screen.getByLabelText(t('browse.permission.sellImages')));
    fireEvent.click(screen.getByLabelText(t('browse.permission.noCredit')));
    expect(useBrowse.getState().licenses).toEqual(['sellImages', 'noCredit']);
    expect(screen.getByTestId('browse-filters-count').textContent).toBe('2');
    fireEvent.click(screen.getByLabelText(t('browse.permission.sellImages')));
    expect(useBrowse.getState().licenses).toEqual(['noCredit']);
    fireEvent.click(screen.getByLabelText(t('browse.filter.safetensors')));
    fireEvent.change(screen.getByLabelText(t('browse.filter.creator')), { target: { value: 'someone' } });
    expect(screen.getByTestId('browse-filters-count').textContent).toBe('3');
    fireEvent.click(screen.getByTestId('browse-filters-reset'));
    expect(useBrowse.getState()).toMatchObject({ licenses: [], safetensorsOnly: false, creator: '', checkpointType: '' });
  });

  it('offers the checkpoint type only for checkpoints', () => {
    render(<FilterPopover />);
    openFilters();
    expect(screen.queryByLabelText(t('browse.filter.checkpointType'))).toBeNull();
    cleanup();
    useBrowse.setState({ kind: 'Checkpoint' });
    render(<FilterPopover />);
    openFilters();
    expect(screen.getByLabelText(t('browse.filter.checkpointType'))).toBeTruthy();
  });

  it('counts each kind of filter once', () => {
    expect(activeFilterCount({ licenses: [], checkpointType: '', safetensorsOnly: false, creator: ' ' })).toBe(0);
    expect(activeFilterCount({ licenses: ['a', 'b'], checkpointType: 'Merge', safetensorsOnly: true, creator: 'x' })).toBe(5);
  });
});

describe('the mock search with the extra filters', () => {
  const base = { query: '', kind: 'all', baseModel: 'all', sort: 'downloads', period: 'all', includeNsfw: true } as const;
  it('keeps only models whose license allows every asked-for permission', () => {
    const all = searchCivitaiModels({ ...base });
    const some = searchCivitaiModels({ ...base, licenses: ['sellImages', 'shareMerges'] });
    expect(some.items.length).toBeLessThanOrEqual(all.items.length);
    for (const m of some.items) {
      for (const k of ['sellImages', 'shareMerges']) expect(m.permissions?.find((p) => p.key === k)?.allowed).toBe(true);
    }
  });
  it('filters by creator, and by safetensors', () => {
    const first = searchCivitaiModels({ ...base }).items[0]!;
    const mine = searchCivitaiModels({ ...base, creator: first.creator.toUpperCase() });
    expect(mine.items.length).toBeGreaterThan(0);
    expect(mine.items.every((m) => m.creator === first.creator)).toBe(true);
    expect(searchCivitaiModels({ ...base, safetensorsOnly: true }).items.every((m) => m.versions[0]!.files.some((f) => f.format === 'SafeTensor'))).toBe(true);
  });
});
