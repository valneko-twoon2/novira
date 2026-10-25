// @vitest-environment jsdom
// The hotkeys modal: opens from the UI state, lists the categories, searches titles, descriptions and keys, closes.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useUi } from '@/state/ui';
import { HotkeysModal } from './HotkeysModal';
import { HOTKEY_CATEGORIES } from './hotkeyCatalog';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useUi.getState().openModal(null);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const openIt = () => {
  useUi.getState().openModal('hotkeys');
  render(<HotkeysModal />);
};
const headings = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);

describe('HotkeysModal', () => {
  it('renders nothing until the modal is asked for', () => {
    render(<HotkeysModal />);
    expect(screen.queryByTestId('hotkeys-modal')).toBeNull();
  });

  it('lists every category with its shortcuts, keys drawn as separate caps', () => {
    openIt();
    expect(headings()).toEqual(HOTKEY_CATEGORIES.map((c) => t(c.title)));
    const kbds = document.querySelectorAll('kbd');
    expect(kbds.length).toBeGreaterThan(HOTKEY_CATEGORIES.length);
    // Arrow keys are drawn as arrows.
    expect([...kbds].some((k) => k.textContent === '←')).toBe(true);
  });

  it('narrows the list by the text of a title, a description or a key, and says when nothing matches', () => {
    openIt();
    const box = screen.getByRole('textbox', { name: t('settings.hotkeys.search') });
    const first = HOTKEY_CATEGORIES[0]!.hotkeys[0]!;
    fireEvent.change(box, { target: { value: t(first.title).toLowerCase() } });
    expect(screen.getAllByText(t(first.title)).length).toBeGreaterThan(0);
    fireEvent.change(box, { target: { value: t(first.desc).slice(0, 12).toUpperCase() } });
    expect(screen.getAllByText(t(first.desc)).length).toBeGreaterThan(0);
    fireEvent.change(box, { target: { value: 'ctrl' } });
    expect(headings().length).toBeGreaterThan(0);
    fireEvent.change(box, { target: { value: 'zzzz-no-such-shortcut' } });
    expect(screen.getByText(t('settings.hotkeys.noMatch'))).toBeTruthy();
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
  });

  it('closes from the close button', () => {
    openIt();
    fireEvent.click(screen.getByRole('button', { name: t('common.close') }));
    expect(useUi.getState().modal).toBeNull();
  });
});
