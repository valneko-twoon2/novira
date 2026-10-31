// @vitest-environment jsdom
// The staging toolbar: stepping through staged results, accepting, discarding, hiding and dragging them.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useCanvas } from '@/state/canvas';
import { DEFERRED_MIME } from '@/state/dnd';
import { TooltipProvider } from '@/ui';
import { StagingToolbar } from './StagingToolbar';

vi.mock('../actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../actions')>()),
  acceptStaged: vi.fn(),
  discardAllStaged: vi.fn(),
  discardCurrentStaged: vi.fn(),
  saveStagedToGallery: vi.fn(),
}));
import { acceptStaged, discardAllStaged, discardCurrentStaged, saveStagedToGallery } from '../actions';

const initial = useCanvas.getState();
const state = () => useCanvas.getState();
const show = (inline = false) =>
  render(
    <TooltipProvider>
      <StagingToolbar inline={inline} />
    </TooltipProvider>,
  );
const button = (label: string) => screen.getByRole('button', { name: label });

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useCanvas.setState(initial, true);
  for (const fn of [acceptStaged, discardAllStaged, discardCurrentStaged, saveStagedToGallery]) vi.mocked(fn).mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('StagingToolbar', () => {
  it('shows nothing while no result is staged', () => {
    const { container } = show();
    expect(container.firstChild).toBeNull();
  });

  it('counts the staged results and steps through them, wrapping around', () => {
    state().addStagedImage('a.png');
    state().addStagedImage('b.png');
    state().addStagedImage('c.png');
    show();
    expect(screen.getByText('3/3')).toBeTruthy();
    fireEvent.click(button(`${t('canvas.staging.next')} (→)`));
    expect(state().stagedIndex).toBe(0);
    expect(screen.getByText('1/3')).toBeTruthy();
    fireEvent.click(button(`${t('canvas.staging.prev')} (←)`));
    expect(state().stagedIndex).toBe(2);
  });

  it('disables stepping while there is a single result', () => {
    state().addStagedImage('a.png');
    show();
    expect(button(`${t('canvas.staging.next')} (→)`).hasAttribute('disabled')).toBe(true);
    expect(button(`${t('canvas.staging.prev')} (←)`).hasAttribute('disabled')).toBe(true);
  });

  it('accepts, saves and discards through the canvas actions', () => {
    state().addStagedImage('a.png');
    show();
    fireEvent.click(screen.getByTestId('canvas-staging-accept'));
    expect(acceptStaged).toHaveBeenCalledWith(useCanvas);
    fireEvent.click(button(t('canvas.staging.saveToGallery')));
    expect(saveStagedToGallery).toHaveBeenCalledWith(useCanvas);
    fireEvent.click(button(t('canvas.staging.discard')));
    expect(discardCurrentStaged).toHaveBeenCalledWith(useCanvas);
    fireEvent.click(button(`${t('canvas.staging.discardAll')} (Esc)`));
    expect(discardAllStaged).toHaveBeenCalledWith(useCanvas);
  });

  it('toggles whether the staged results are drawn on the canvas', () => {
    state().addStagedImage('a.png');
    show();
    fireEvent.click(button(t('canvas.staging.hideResults')));
    expect(state().stagingShowResults).toBe(false);
    fireEvent.click(button(t('canvas.staging.showResults')));
    expect(state().stagingShowResults).toBe(true);
  });

  it('drags the current result by its name, and marks the inline variant', () => {
    state().addStagedImage('a.png');
    state().addStagedImage('b.png');
    state().setStagedIndex(0);
    show(true);
    expect(screen.getByTestId('canvas-staging').className).toContain('canvas-staging--inline');
    const data: Record<string, string> = {};
    fireEvent.dragStart(screen.getByTestId('canvas-staging-drag'), { dataTransfer: { setData: (k: string, v: string) => (data[k] = v), effectAllowed: '' } });
    expect(JSON.parse(data[DEFERRED_MIME]!)).toEqual({ kind: 'canvas-staged', id: 'a.png' });
  });
});
