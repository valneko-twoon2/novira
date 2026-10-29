// @vitest-environment jsdom
// The viewer's zoom controls: they show the zoom of the viewer and call its zoom functions.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { TooltipProvider } from '@/ui';
import { ViewerZoomControls } from './ViewerZoomControls';
import type { ZoomPan } from './useZoomPan';

const zoomFns = () => ({ fit: vi.fn(), actualSize: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), zoomTo: vi.fn() });
const show = (scale: number, fns = zoomFns()) => {
  render(
    <TooltipProvider>
      <ViewerZoomControls zoom={{ view: { x: 0, y: 0, scale }, ...fns } as unknown as ZoomPan} />
    </TooltipProvider>,
  );
  return fns;
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ViewerZoomControls', () => {
  it('shows the zoom as a rounded percentage', () => {
    show(1.256);
    expect(screen.getByTestId('viewer-zoom').textContent).toBe('126%');
  });

  it('zooms in and out, shows the actual size and fits', () => {
    const fns = show(1);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('common.zoomIn')) }));
    expect(fns.zoomIn).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('common.zoomOut')) }));
    expect(fns.zoomOut).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: t('common.zoomActualSize') }));
    expect(fns.actualSize).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('gallery.viewer.zoomFit')) }));
    expect(fns.fit).toHaveBeenCalledTimes(1);
  });

  it('zooms to a preset and fits from the menu', async () => {
    const fns = show(1);
    fireEvent.keyDown(screen.getByTestId('viewer-zoom'), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: '200%' }));
    expect(fns.zoomTo).toHaveBeenCalledWith(2);
    fireEvent.keyDown(screen.getByTestId('viewer-zoom'), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: new RegExp(t('gallery.viewer.zoomFit')) }));
    expect(fns.fit).toHaveBeenCalledTimes(1);
  });
});
