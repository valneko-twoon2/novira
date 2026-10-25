// @vitest-environment jsdom
// Importing wildcard lists from .txt files and exporting one, from the dialog's buttons.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useWildcards } from '@/state/prompts/wildcards';
import { useToasts } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { WildcardsDialog } from './WildcardsDialog';

const initial = { toasts: useToasts.getState() };
const lastToast = () => useToasts.getState().toasts.at(-1);

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useWildcards.setState({ lists: [{ id: 'a', name: 'hair', text: 'black\nred' }], open: true, selectedId: null });
  useToasts.setState(initial.toasts, true);
  render(
    <TooltipProvider>
      <WildcardsDialog />
    </TooltipProvider>,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const chooseFiles = (files: File[]) => {
  const input = document.querySelector('input[type=file]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  fireEvent.change(input);
};

describe('importing', () => {
  it('opens the file picker from the button', () => {
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByTestId('wildcard-import'));
    expect(click).toHaveBeenCalled();
  });

  it('adds one list per file, selects the last one and names them in the message', async () => {
    chooseFiles([new File(['one\ntwo'], 'colors.txt'), new File(['x'], 'hair.txt')]);
    await waitFor(() => expect(useWildcards.getState().lists).toHaveLength(3));
    expect(useWildcards.getState().lists.map((l) => l.name)).toEqual(['hair', 'colors', 'hair-2']);
    expect(useWildcards.getState().selectedId).toBe(useWildcards.getState().lists[2]!.id);
    expect(lastToast()).toMatchObject({ status: 'success', title: t('params.wildcards.imported', { names: '__colors__, __hair-2__' }) });
  });

  it('ignores an empty choice, and reports a file that cannot be read', async () => {
    chooseFiles([]);
    expect(useWildcards.getState().lists).toHaveLength(1);
    const broken = new File(['x'], 'bad.txt');
    Object.defineProperty(broken, 'text', { value: () => Promise.reject(new Error('unreadable')) });
    chooseFiles([broken]);
    await waitFor(() => expect(lastToast()).toMatchObject({ status: 'error', description: 'unreadable' }));
  });
});

describe('exporting', () => {
  it('saves the chosen list as a .txt file', async () => {
    fireEvent.click(screen.getByTestId('wildcard-list'));
    URL.createObjectURL = vi.fn(() => 'blob:wc');
    URL.revokeObjectURL = vi.fn();
    let name = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      name = this.download;
    });
    fireEvent.click(await screen.findByTestId('wildcard-export'));
    expect(name).toBe('hair.txt');
  });
});
