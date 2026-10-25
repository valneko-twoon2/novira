// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { createPresetStore, type Preset, type PresetKind } from '@/state/presets/presetStore';
import { PresetBar } from './PresetBar';
import { TooltipProvider } from './controls';

interface Data {
  steps: number;
}

const seed: Preset<Data>[] = [{ id: 'seed-1', name: 'builtin-key', data: { steps: 20 } }];
let kind: PresetKind<Data>;
let current = 30;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  current = 30;
  kind = { store: createPresetStore<Data>({ name: `bar-test-${Math.random()}`, seed }), snapshot: () => ({ steps: current }), apply: vi.fn() };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const mount = (props: Partial<React.ComponentProps<typeof PresetBar<Data>>> = {}) =>
  render(
    <TooltipProvider>
      <PresetBar kind={kind} testId="bar" summarize={(d) => `${d.steps} steps`} {...props} />
    </TooltipProvider>,
  );
const openList = () => fireEvent.click(screen.getByTestId('preset-trigger'));
const rows = () => within(screen.getByTestId('preset-list')).getAllByTestId('preset-item');

describe('PresetBar', () => {
  it('lists the store presets with their summaries and the translated display name', () => {
    mount({ nameOf: (p) => `shown ${p.name}` });
    openList();
    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.textContent).toContain('shown builtin-key');
    expect(rows()[0]!.textContent).toContain('20 steps');
  });

  it('applies a preset to the form and marks it as the current one', () => {
    mount();
    openList();
    fireEvent.click(within(rows()[0]!).getByText('builtin-key'));
    expect(kind.apply).toHaveBeenCalledWith({ steps: 20 });
    expect(kind.store.getState().selectedId).toBe('seed-1');
    expect(screen.getByTestId('preset-trigger').textContent).toContain('builtin-key');
  });

  it('saves the form as a new preset under the typed name', () => {
    mount();
    openList();
    fireEvent.click(screen.getByTestId('preset-save-new'));
    fireEvent.change(screen.getByTestId('name-dialog-input'), { target: { value: 'Mine' } });
    fireEvent.click(screen.getByTestId('name-dialog-ok'));
    const saved = kind.store.getState().presets.find((p) => p.name === 'Mine');
    expect(saved?.data).toEqual({ steps: 30 });
    expect(kind.store.getState().selectedId).toBe(saved!.id);
  });

  describe('the item menu', () => {
    const pickFromMenu = (label: string) => {
      kind.store.getState().add('Mine', { steps: 1 });
      mount();
      openList();
      const row = rows().find((r) => r.textContent?.includes('Mine'))!;
      fireEvent.keyDown(within(row).getByTestId('preset-item-menu'), { key: 'Enter' });
      fireEvent.click(screen.getByRole('menuitem', { name: label }));
    };
    const mine = () => kind.store.getState().presets.find((p) => p.name === 'Mine');

    it('overwrites a preset with the current form', () => {
      pickFromMenu(t('presets.overwrite'));
      expect(mine()!.data).toEqual({ steps: 30 });
    });

    it('renames a preset', () => {
      pickFromMenu(t('presets.rename'));
      fireEvent.change(screen.getByTestId('name-dialog-input'), { target: { value: 'Renamed' } });
      fireEvent.click(screen.getByTestId('name-dialog-ok'));
      expect(kind.store.getState().presets.map((p) => p.name)).toEqual(['builtin-key', 'Renamed']);
    });

    it('deletes a preset on the second press', () => {
      pickFromMenu(t('presets.delete'));
      expect(mine()).toBeDefined();
      fireEvent.click(screen.getByRole('menuitem', { name: t('common.deleteAgain') }));
      expect(mine()).toBeUndefined();
    });
  });
});
