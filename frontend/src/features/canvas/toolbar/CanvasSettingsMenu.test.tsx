// @vitest-environment jsdom
// The canvas settings menu: the display and behaviour switches, and the history and clearing commands.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useCanvas } from '@/state/canvas';
import { TooltipProvider } from '@/ui';
import { CanvasSettingsMenu } from './CanvasSettingsMenu';

vi.mock('../actions', () => ({ mergeVisible: vi.fn() }));
vi.mock('../view', () => ({ fitBboxToLayers: vi.fn() }));
import { mergeVisible } from '../actions';
import { fitBboxToLayers } from '../view';

const initial = useCanvas.getState();
const state = () => useCanvas.getState();

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useCanvas.setState(initial, true);
  vi.mocked(mergeVisible).mockClear();
  vi.mocked(fitBboxToLayers).mockClear();
  render(
    <TooltipProvider>
      <CanvasSettingsMenu />
    </TooltipProvider>,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openMenu() {
  fireEvent.keyDown(screen.getByTestId('canvas-settings'), { key: 'Enter' });
  return within(await screen.findByRole('menu'));
}

describe('CanvasSettingsMenu', () => {
  it.each([
    ['canvas.settings.showGrid', 'showGrid'],
    ['canvas.settings.snapToGrid', 'snapToGrid'],
    ['canvas.settings.showHud', 'showHud'],
    ['canvas.settings.dimOutsideBbox', 'dimOutsideBbox'],
    ['canvas.settings.clipToBbox', 'clipToBbox'],
    ['canvas.settings.preserveMask', 'preserveMask'],
    ['canvas.settings.autoProcess', 'autoProcess'],
  ] as const)('%s flips the %s setting and keeps the menu open', async (label, key) => {
    const before = state().settings[key];
    const menu = await openMenu();
    fireEvent.click(menu.getByText(t(label)));
    expect(state().settings[key]).toBe(!before);
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('merges the visible layers and fits the box to the layers', async () => {
    let menu = await openMenu();
    fireEvent.click(menu.getByText(t('canvas.actions.mergeVisible')));
    expect(mergeVisible).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    menu = await openMenu();
    fireEvent.click(menu.getByText(t('canvas.actions.fitBboxToLayers')));
    expect(fitBboxToLayers).toHaveBeenCalled();
  });

  it('turns clearing off while there is nothing to clear, and clears the history, the canvas and the staging area', async () => {
    let menu = await openMenu();
    expect(menu.getByText(t('canvas.actions.clearHistory')).closest('[role=menuitem]')!.getAttribute('aria-disabled')).toBe('true');
    expect(menu.getByText(t('canvas.actions.clearCanvas')).closest('[role=menuitem]')!.getAttribute('aria-disabled')).toBe('true');
    fireEvent.keyDown(menu.getByText(t('canvas.settings.title')), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());

    state().addEntity('raster');
    state().addStagedImage('a.png');
    menu = await openMenu();
    fireEvent.click(menu.getByText(t('canvas.actions.clearHistory')));
    expect(state().past).toHaveLength(0);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    menu = await openMenu();
    fireEvent.click(menu.getByText(t('canvas.actions.clearStaging')));
    expect(state().stagedImageNames).toEqual([]);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    menu = await openMenu();
    fireEvent.click(menu.getByText(t('canvas.actions.clearCanvas')));
    expect(state().entities).toEqual([]);
  });
});
