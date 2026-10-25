// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { TooltipProvider } from './controls';
import { MenuItem } from './overlays';
import { ZoomControls } from './ZoomControls';

afterEach(cleanup);

function setup(extra: { onActualSize?: () => void; menu?: boolean } = {}) {
  const handlers = { onZoomIn: vi.fn(), onZoomOut: vi.fn(), onZoomTo: vi.fn(), onFit: vi.fn(), onExtra: vi.fn() };
  render(
    <TooltipProvider>
      <ZoomControls
        scale={0.4567}
        onZoomIn={handlers.onZoomIn}
        onZoomOut={handlers.onZoomOut}
        onZoomTo={handlers.onZoomTo}
        onFit={handlers.onFit}
        fitLabel="Fit"
        onActualSize={extra.onActualSize}
        menuItems={extra.menu ? <MenuItem onSelect={handlers.onExtra}>Extra</MenuItem> : undefined}
        testId="zoom"
      />
    </TooltipProvider>,
  );
  return handlers;
}

describe('ZoomControls', () => {
  it('shows the rounded percentage and runs the zoom buttons', () => {
    const h = setup();
    expect(screen.getByTestId('zoom').textContent).toBe('46%');
    fireEvent.click(screen.getByRole('button', { name: t('common.zoomIn') }));
    fireEvent.click(screen.getByRole('button', { name: t('common.zoomOut') }));
    fireEvent.click(screen.getByRole('button', { name: 'Fit (Ctrl+0)' }));
    expect(h.onZoomIn).toHaveBeenCalledOnce();
    expect(h.onZoomOut).toHaveBeenCalledOnce();
    expect(h.onFit).toHaveBeenCalledOnce();
  });

  it('shows the 1:1 button only when an actual-size action is given', () => {
    setup();
    expect(screen.queryByRole('button', { name: t('common.zoomActualSize') })).toBeNull();
    cleanup();
    const onActualSize = vi.fn();
    setup({ onActualSize });
    fireEvent.click(screen.getByRole('button', { name: t('common.zoomActualSize') }));
    expect(onActualSize).toHaveBeenCalledOnce();
  });

  it('offers zoom presets and extra items in the percentage menu', () => {
    const h = setup({ menu: true });
    fireEvent.keyDown(screen.getByTestId('zoom'), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: '200%' }));
    expect(h.onZoomTo).toHaveBeenCalledWith(2);
    fireEvent.keyDown(screen.getByTestId('zoom'), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Extra' }));
    expect(h.onExtra).toHaveBeenCalledOnce();
  });
});
