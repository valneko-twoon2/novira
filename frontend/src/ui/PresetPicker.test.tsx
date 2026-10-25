// @vitest-environment jsdom
// Tests for the shared preset picker: card, search, apply, grouping, empty state, saving and the per-item actions.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { TooltipProvider } from './controls';
import { PresetPicker, type PresetItem, type PresetPickerProps } from './PresetPicker';

const ITEMS: PresetItem[] = [
  { id: 'seed-a', name: 'Standard', builtin: true, summary: '1024×1024' },
  { id: 'seed-b', name: 'Draft', builtin: true, summary: '768×768' },
  { id: 'mine', name: 'My portrait', summary: 'SDXL' },
];

function setup(props: Partial<PresetPickerProps> = {}) {
  const handlers = { onApply: vi.fn(), onSaveNew: vi.fn(), onOverwrite: vi.fn(), onRename: vi.fn(), onDelete: vi.fn() };
  render(
    <TooltipProvider>
      <PresetPicker items={ITEMS} selectedId={null} label="Preset" testId="bar" {...handlers} {...props} />
    </TooltipProvider>,
  );
  return handlers;
}

const openList = () => fireEvent.click(screen.getByTestId('preset-trigger'));
const list = () => screen.getByTestId('preset-list');
const rows = () => within(list()).queryAllByTestId('preset-item');

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PresetPicker', () => {
  it('shows the current preset on the card, or a prompt to choose one', () => {
    setup({ selectedId: 'mine' });
    const card = screen.getByTestId('preset-trigger');
    expect(card.textContent).toContain('My portrait');
    expect(card.textContent).toContain('SDXL');
    cleanup();
    setup();
    expect(screen.getByTestId('preset-trigger').textContent).toContain(t('presets.choose'));
  });

  it('shows names and summaries only, no pictures', () => {
    setup({ selectedId: 'mine' });
    openList();
    expect(screen.getByTestId('bar').querySelector('img')).toBeNull();
    expect(list().querySelector('img')).toBeNull();
    expect(within(list()).getByText('SDXL')).toBeTruthy();
  });

  it('groups my presets and the built-ins, and searches names and summaries', () => {
    setup();
    openList();
    expect(within(list()).getByText(t('presets.group.mine'))).toBeTruthy();
    expect(within(list()).getByText(t('presets.group.builtin'))).toBeTruthy();
    expect(rows()).toHaveLength(3);

    fireEvent.change(screen.getByLabelText(t('presets.search')), { target: { value: '768' } });
    expect(rows().map((r) => r.dataset.presetId)).toEqual(['seed-b']);
    // A single group needs no heading.
    expect(within(list()).queryByText(t('presets.group.builtin'))).toBeNull();

    fireEvent.change(screen.getByLabelText(t('presets.search')), { target: { value: 'nothing like this' } });
    expect(rows()).toHaveLength(0);
    expect(list().textContent).toContain(t('presets.noMatch'));
  });

  it('applies the clicked preset and closes the list', () => {
    const h = setup();
    openList();
    fireEvent.click(within(rows()[0]!).getByText('My portrait'));
    expect(h.onApply).toHaveBeenCalledWith('mine');
    expect(screen.queryByTestId('preset-list')).toBeNull();
  });

  it('explains the empty state and still offers to save', () => {
    const h = setup({ items: [] });
    openList();
    expect(list().textContent).toContain(t('presets.empty'));
    fireEvent.click(screen.getByTestId('preset-save-new'));
    fireEvent.change(screen.getByTestId('name-dialog-input'), { target: { value: '  Night scene ' } });
    fireEvent.click(screen.getByTestId('name-dialog-ok'));
    expect(h.onSaveNew).toHaveBeenCalledWith('Night scene');
  });

  it('blocks applying and saving while presets are unavailable, with the reason shown', () => {
    const h = setup({ disabledReason: 'Select a layer' });
    expect((screen.getByTestId('preset-quick-save') as HTMLButtonElement).disabled).toBe(true);
    openList();
    expect(screen.getByTestId('preset-hint').textContent).toBe('Select a layer');
    const apply = within(rows()[0]!).getByText('My portrait').closest('button') as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fireEvent.click(apply);
    expect(h.onApply).not.toHaveBeenCalled();
    expect((screen.getByTestId('preset-save-new') as HTMLButtonElement).disabled).toBe(true);
  });

  it('renames, overwrites and deletes from the item menu', () => {
    const h = setup();
    const openMenu = (row: number) => {
      openList();
      fireEvent.keyDown(within(rows()[row]!).getByTestId('preset-item-menu'), { key: 'Enter' });
    };

    openMenu(0);
    fireEvent.click(screen.getByRole('menuitem', { name: t('presets.overwrite') }));
    expect(h.onOverwrite).toHaveBeenCalledWith('mine');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    cleanup();

    const h2 = setup();
    openMenu(0);
    fireEvent.click(screen.getByRole('menuitem', { name: t('presets.rename') }));
    const input = screen.getByTestId('name-dialog-input') as HTMLInputElement;
    expect(input.value).toBe('My portrait');
    fireEvent.change(input, { target: { value: 'Portrait v2' } });
    fireEvent.click(screen.getByTestId('name-dialog-ok'));
    expect(h2.onRename).toHaveBeenCalledWith('mine', 'Portrait v2');

    openMenu(1);
    fireEvent.click(screen.getByRole('menuitem', { name: t('presets.delete') }));
    expect(h2.onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('menuitem', { name: t('common.deleteAgain') }));
    expect(h2.onDelete).toHaveBeenCalledWith('seed-a');
    expect(h.onDelete).not.toHaveBeenCalled();
  });
});
