// @vitest-environment jsdom
// The model picker: current name or placeholder, search, grouping by base, picking, and the shortcuts to the manager and the online search.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { useUi } from '@/state/ui';
import { ModelPicker } from './ModelPicker';

const model = (key: string, name: string, base: ModelConfig['base']): ModelConfig =>
  ({ key, name, base, type: 'main', format: 'checkpoint', description: '', path: '', size: 1, source: 'local' }) as ModelConfig;

const models = [model('m1', 'Zebra XL', 'sdxl'), model('m2', 'Apple XL', 'sdxl'), model('m3', 'Old One', 'sd-1')];

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useUi.getState().setTab('generate');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const show = (value: string | null, onPick = vi.fn(), disabled = false) => {
  render(<ModelPicker models={models} value={value} onPick={onPick} placeholder="Pick one" disabled={disabled} testId="picker" aria-label="Model" />);
  return onPick;
};
const openList = () => {
  fireEvent.click(screen.getByTestId('picker'));
  return screen.getByTestId('model-picker-list');
};

describe('ModelPicker', () => {
  it('shows the placeholder without a value and the model name with one', () => {
    show(null);
    expect(screen.getByTestId('picker').textContent).toContain('Pick one');
    cleanup();
    show('m3');
    expect(screen.getByTestId('picker').textContent).toContain('Old One');
  });

  it('groups by base with names in order, marks the current one and picks another', () => {
    const onPick = show('m1');
    const list = openList();
    expect(within(list).getAllByRole('heading').map((h) => h.textContent)).toEqual(['SDXL', 'SD1.X']);
    expect(within(list).getAllByRole('button').map((b) => b.textContent)).toEqual(['Apple XL', 'Zebra XL', 'Old One']);
    expect(within(list).getByRole('button', { name: 'Zebra XL' }).className).toContain('is-current');
    fireEvent.click(within(list).getByRole('button', { name: 'Old One' }));
    expect(onPick).toHaveBeenCalledWith(models[2]);
    expect(screen.queryByTestId('model-picker-list')).toBeNull();
  });

  it('filters by the search text and says when nothing matches', () => {
    show(null);
    openList();
    const box = screen.getByRole('textbox', { name: t('params.model.search') });
    fireEvent.change(box, { target: { value: 'apple' } });
    expect(within(screen.getByTestId('model-picker-list')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Apple XL']);
    fireEvent.change(box, { target: { value: 'nothing here' } });
    expect(screen.getByText(t('params.model.noMatch'))).toBeTruthy();
  });

  it('goes to the model manager or the online search and closes the list', () => {
    show(null);
    openList();
    fireEvent.click(screen.getByTestId('open-manager'));
    expect(useUi.getState().activeTab).toBe('models');
    expect(screen.queryByTestId('model-picker-list')).toBeNull();
    openList();
    fireEvent.click(screen.getByTestId('find-online'));
    expect(useUi.getState().activeTab).toBe('browse');
  });

  it('leaves the shortcuts out where the layout has no such screens', () => {
    render(<ModelPicker models={models} value={null} onPick={vi.fn()} placeholder="Pick one" testId="picker" shortcuts={false} />);
    openList();
    expect(screen.queryByTestId('open-manager')).toBeNull();
    expect(screen.queryByTestId('find-online')).toBeNull();
  });

  it('does not open while disabled', () => {
    show(null, vi.fn(), true);
    fireEvent.click(screen.getByTestId('picker'));
    expect(screen.queryByTestId('model-picker-list')).toBeNull();
  });
});
