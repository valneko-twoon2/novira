// @vitest-environment jsdom
// The import dialog opens on the tab it is asked for (a warning about a missing image encoder opens it on the starter models).
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useModelImport } from '@/state/dialogs/modelImport';
import { TooltipProvider } from '@/ui';
import { ImportDialog } from './ImportDialog';

beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useModelImport.setState({ isOpen: false, tab: 'source' });
});

describe('ImportDialog', () => {
  const show = () =>
    render(
      <TooltipProvider>
        <ImportDialog />
      </TooltipProvider>,
    );

  it('stays closed until opened, then opens on the first tab', () => {
    show();
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => useModelImport.getState().open());
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('tab', { name: t('models.install.tab.source') }).getAttribute('aria-selected')).toBe('true');
  });

  it('opens straight on the starter models when asked', () => {
    show();
    act(() => useModelImport.getState().open('starter'));
    expect(screen.getByRole('tab', { name: t('models.install.tab.starter') }).getAttribute('aria-selected')).toBe('true');
  });

  it('closes with its close button and remembers the tab it was left on', () => {
    show();
    act(() => useModelImport.getState().open('scan'));
    act(() => useModelImport.getState().close());
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => useModelImport.getState().open());
    expect(screen.getByRole('tab', { name: t('models.install.tab.scan') }).getAttribute('aria-selected')).toBe('true');
  });
});
