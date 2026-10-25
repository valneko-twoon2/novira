// @vitest-environment jsdom
// The canvas components inside a CanvasStoreProvider act on the store it gives (a comic page's), never on the Image
// tab's global useCanvas.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { t } from '@/i18n';
import { createCanvasStore, useCanvas, type CanvasStore } from '@/state/canvas';
import { CanvasStoreProvider } from '@/state/canvasStoreContext';
import { useParams } from '@/state/params';
import { TooltipProvider } from '@/ui';
import { LayersPanel } from './layers/LayersPanel';
import { ADD_LABEL } from './names';
import { CanvasToolbar } from './toolbar/CanvasToolbar';

const initial = { canvas: useCanvas.getState(), params: useParams.getState() };
let canvases: ReturnType<typeof installRecordingCanvases>;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  canvases = installRecordingCanvases();
  useCanvas.setState(initial.canvas, true);
  useParams.setState(initial.params, true);
});
afterEach(() => {
  cleanup();
  canvases.restore();
  vi.unstubAllGlobals();
});

function showOn(store: CanvasStore) {
  render(
    <TooltipProvider>
      <CanvasStoreProvider store={store}>
        <CanvasToolbar />
        <LayersPanel />
      </CanvasStoreProvider>
    </TooltipProvider>,
  );
}

describe('canvas store provider', () => {
  it('edits the given store from the layers panel and the toolbar and leaves the global store alone', () => {
    const page = createCanvasStore({ syncParams: false });
    showOn(page);

    fireEvent.click(screen.getByRole('button', { name: t(ADD_LABEL.raster) }));
    expect(page.getState().entities.map((e) => e.type)).toEqual(['raster']);
    expect(screen.getAllByTestId('canvas-entity')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('canvas-tool-eraser'));
    expect(page.getState().tool).toBe('eraser');

    const scale = page.getState().viewport.scale;
    fireEvent.click(screen.getByRole('button', { name: t('common.zoomIn') }));
    expect(page.getState().viewport.scale).toBeGreaterThan(scale);

    fireEvent.click(screen.getByTestId('canvas-undo'));
    expect(page.getState().entities).toEqual([]);

    const global = useCanvas.getState();
    expect(global.entities).toEqual([]);
    expect(global.past).toEqual([]);
    expect(global.tool).toBe(initial.canvas.tool);
    expect(global.viewport).toEqual(initial.canvas.viewport);
    expect(useParams.getState()).toBe(initial.params);
  });

  it('acts on the global store without a provider', () => {
    render(
      <TooltipProvider>
        <CanvasToolbar />
        <LayersPanel />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: t(ADD_LABEL.raster) }));
    expect(useCanvas.getState().entities.map((e) => e.type)).toEqual(['raster']);
  });
});
