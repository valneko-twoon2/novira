// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useWildcards } from '@/state/prompts/wildcards';
import { TooltipProvider } from '@/ui';
import { WildcardsDialog } from './WildcardsDialog';

const mount = () =>
  render(
    <TooltipProvider>
      <WildcardsDialog />
    </TooltipProvider>,
  );

describe('wildcard lists dialog', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    useWildcards.setState({ lists: [{ id: 'a', name: 'hair', text: 'black hair\nred hair' }, { id: 'b', name: 'mood', text: 'smile' }], open: true, selectedId: 'a' });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('lists the lists with their entry counts and edits the chosen one', () => {
    mount();
    expect(screen.getAllByTestId('wildcard-list').map((b) => b.textContent)).toEqual(['hair2', 'mood1']);
    expect(screen.getByText(t('params.wildcards.usage', { token: '__hair__' }))).toBeTruthy();
    fireEvent.change(screen.getByTestId('wildcard-text'), { target: { value: 'a\nb\nc' } });
    expect(useWildcards.getState().lists[0]!.text).toBe('a\nb\nc');
  });

  it('refuses an invalid or taken name and keeps the list as it was', () => {
    mount();
    const name = screen.getByTestId('wildcard-name');
    fireEvent.change(name, { target: { value: 'two words' } });
    fireEvent.blur(name);
    expect(screen.getByRole('alert').textContent).toBe(t('params.wildcards.nameInvalid'));
    fireEvent.change(name, { target: { value: 'mood' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(screen.getByRole('alert').textContent).toBe(t('params.wildcards.nameTaken'));
    expect(useWildcards.getState().lists[0]!.name).toBe('hair');
    fireEvent.change(name, { target: { value: 'hair-color' } });
    fireEvent.blur(name);
    expect(useWildcards.getState().lists[0]!.name).toBe('hair-color');
  });

  it('adds a new list and selects it, and deletes after confirming', () => {
    mount();
    fireEvent.click(screen.getByTestId('wildcard-new'));
    const lists = useWildcards.getState().lists;
    expect(lists.map((l) => l.name)).toEqual(['hair', 'mood', 'list']);
    expect(useWildcards.getState().selectedId).toBe(lists[2]!.id);
    fireEvent.click(screen.getByTestId('wildcard-delete'));
    expect(useWildcards.getState().lists).toHaveLength(3);
    fireEvent.click(screen.getByTestId('wildcard-delete'));
    expect(useWildcards.getState().lists.map((l) => l.name)).toEqual(['hair', 'mood']);
  });
});
