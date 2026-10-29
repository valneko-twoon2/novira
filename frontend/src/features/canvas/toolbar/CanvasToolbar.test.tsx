// @vitest-environment jsdom
// The canvas toolbar as a whole: undo and redo, the save buttons, the zoom group and the pose tool options.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useCanvas } from '@/state/canvas';
import { usePose3dDialog } from '@/state/dialogs/pose3d';
import { usePoseFromImageDialog } from '@/state/dialogs/poseFromImage';
import { TooltipProvider } from '@/ui';
import { CanvasToolbar } from './CanvasToolbar';

vi.mock('../actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../actions')>()),
  saveCanvasToGallery: vi.fn(),
  saveCanvasAsPsd: vi.fn(),
  randomizePoses: vi.fn(),
  generateWithRandomPoses: vi.fn(),
}));
import { generateWithRandomPoses, randomizePoses, saveCanvasAsPsd, saveCanvasToGallery } from '../actions';

const initial = { canvas: useCanvas.getState(), pose3d: usePose3dDialog.getState(), fromImage: usePoseFromImageDialog.getState() };
const state = () => useCanvas.getState();
const show = () =>
  render(
    <TooltipProvider>
      <CanvasToolbar />
    </TooltipProvider>,
  );

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useCanvas.setState(initial.canvas, true);
  usePose3dDialog.setState(initial.pose3d, true);
  usePoseFromImageDialog.setState(initial.fromImage, true);
  for (const fn of [saveCanvasToGallery, saveCanvasAsPsd, randomizePoses, generateWithRandomPoses]) vi.mocked(fn).mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('undo, redo and save', () => {
  it('disables undo and redo until there is history, then steps through it', () => {
    show();
    const undo = screen.getByTestId('canvas-undo');
    const redo = screen.getByRole('button', { name: /Ctrl\+Shift\+Z/ });
    expect(undo.hasAttribute('disabled')).toBe(true);
    expect(redo.hasAttribute('disabled')).toBe(true);
    act(() => void state().addEntity('raster'));
    expect(undo.hasAttribute('disabled')).toBe(false);
    fireEvent.click(undo);
    expect(state().entities).toHaveLength(0);
    expect(redo.hasAttribute('disabled')).toBe(false);
    fireEvent.click(redo);
    expect(state().entities).toHaveLength(1);
  });

  it('saves to the gallery and as a PSD', () => {
    show();
    fireEvent.click(screen.getByTestId('canvas-save'));
    expect(saveCanvasToGallery).toHaveBeenCalledWith(useCanvas);
    fireEvent.click(screen.getByTestId('canvas-save-psd'));
    expect(saveCanvasAsPsd).toHaveBeenCalledWith(useCanvas);
  });
});

describe('zoom group', () => {
  it('shows the zoom as a percentage and zooms in and out', () => {
    show();
    const percent = () => screen.getByTestId('canvas-zoom').textContent;
    expect(percent()).toBe(`${Math.round(state().viewport.scale * 100)}%`);
    const before = state().viewport.scale;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('common.zoomIn')) }));
    expect(state().viewport.scale).toBeGreaterThan(before);
    expect(percent()).toBe(`${Math.round(state().viewport.scale * 100)}%`);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('common.zoomOut')) }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('common.zoomOut')) }));
    expect(state().viewport.scale).toBeLessThan(before);
  });

  it('picks a preset from the menu and resets the view with the fit button', async () => {
    show();
    fireEvent.keyDown(screen.getByTestId('canvas-zoom'), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: '200%' }));
    expect(state().viewport.scale).toBeCloseTo(2);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('canvas.toolbar.resetView')) }));
    expect(state().viewport.scale).not.toBeCloseTo(2);
  });

  it('fits the bbox and resets the view from the extra menu items', async () => {
    show();
    act(() => state().setViewport({ x: 500, y: 500, scale: 3 }));
    fireEvent.keyDown(screen.getByTestId('canvas-zoom'), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: t('canvas.toolbar.fitBbox') }));
    expect(state().viewport.scale).not.toBe(3);
    act(() => state().setViewport({ x: 500, y: 500, scale: 3 }));
    fireEvent.keyDown(screen.getByTestId('canvas-zoom'), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: new RegExp(t('canvas.toolbar.resetView')) }));
    expect(state().viewport.scale).not.toBe(3);
  });
});

describe('pose tool options', () => {
  it('shows them only for the pose tool', () => {
    show();
    expect(screen.queryByTestId('canvas-pose-random')).toBeNull();
    act(() => state().setTool('pose'));
    expect(screen.getByTestId('canvas-pose-random')).toBeTruthy();
  });

  it('randomizes the selected layer and opens the two pose dialogs', () => {
    const id = state().addEntity('control');
    state().setTool('pose');
    show();
    fireEvent.click(screen.getByTestId('canvas-pose-random'));
    expect(randomizePoses).toHaveBeenCalledWith(id, undefined, useCanvas);
    fireEvent.click(screen.getByTestId('canvas-pose-3d'));
    expect(usePose3dDialog.getState().open).toBe(true);
    fireEvent.click(screen.getByTestId('canvas-pose-from-image'));
    expect(usePoseFromImageDialog.getState().open).toBe(true);
  });

  it('generates a batch of the chosen size, limited to the maximum', () => {
    state().setTool('pose');
    show();
    fireEvent.click(screen.getByTestId('canvas-pose-batch'));
    expect(generateWithRandomPoses).toHaveBeenLastCalledWith(4);
    const input = screen.getByLabelText(t('canvas.pose.batchCount')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByTestId('canvas-pose-batch'));
    expect(generateWithRandomPoses).toHaveBeenLastCalledWith(7);
    fireEvent.change(input, { target: { value: '999' } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByTestId('canvas-pose-batch'));
    expect(generateWithRandomPoses).toHaveBeenLastCalledWith(16);
  });
});
