// @vitest-environment jsdom
// The filter button and the bucket's tolerance box of the canvas toolbars, on the Image tab's store and on another store.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { createCanvasStore, useCanvas } from '@/state/canvas';
import { CanvasStoreProvider } from '@/state/canvasStoreContext';
import { TooltipProvider } from '@/ui';
import { BucketTolerance } from './BucketTolerance';
import { RasterFilterMenu } from './RasterFilterMenu';
import { ToolChooser } from './ToolChooser';

const applied = vi.fn(async () => true);
vi.mock('../actions', () => ({ applyRasterFilter: (...args: unknown[]) => (applied as (...a: unknown[]) => Promise<boolean>)(...args) }));

const initial = useCanvas.getState();
const show = (node: React.ReactNode) => render(<TooltipProvider>{node}</TooltipProvider>);
const raster = { kind: 'rect' as const, id: 'r', x: 0, y: 0, width: 5, height: 5, color: { r: 1, g: 2, b: 3, a: 1 } };

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useCanvas.setState(initial, true);
  applied.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the filter button', () => {
  it('is off until a raster layer of the user is chosen', () => {
    show(<RasterFilterMenu />);
    const button = screen.getByTestId('canvas-filter') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const id = useCanvas.getState().addEntity('raster', { objects: [raster] });
    useCanvas.getState().select(id);
    cleanup();
    show(<RasterFilterMenu />);
    expect((screen.getByTestId('canvas-filter') as HTMLButtonElement).disabled).toBe(false);
    useCanvas.getState().updateEntity(id, { isLocked: true });
    cleanup();
    show(<RasterFilterMenu />);
    expect((screen.getByTestId('canvas-filter') as HTMLButtonElement).disabled).toBe(true);
  });

  it('applies a blur with the chosen radius to the chosen layer', async () => {
    const id = useCanvas.getState().addEntity('raster', { objects: [raster] });
    useCanvas.getState().select(id);
    show(<RasterFilterMenu />);
    fireEvent.click(screen.getByTestId('canvas-filter'));
    const radius = screen.getByLabelText(t('canvas.rasterFilter.radius')) as HTMLInputElement;
    fireEvent.change(radius, { target: { value: '12' } });
    fireEvent.blur(radius);
    fireEvent.click(screen.getByTestId('canvas-filter-apply'));
    await waitFor(() => expect(applied).toHaveBeenCalledTimes(1));
    expect(applied).toHaveBeenCalledWith(id, { kind: 'blur', radius: 12 }, useCanvas);
  });

  it('applies grayscale and invert without a radius', async () => {
    const id = useCanvas.getState().addEntity('raster', { objects: [raster] });
    useCanvas.getState().select(id);
    show(<RasterFilterMenu />);
    fireEvent.click(screen.getByTestId('canvas-filter'));
    fireEvent.click(screen.getByTestId('canvas-filter-kind-invert'));
    expect(screen.queryByLabelText(t('canvas.rasterFilter.radius'))).toBeNull();
    fireEvent.click(screen.getByTestId('canvas-filter-apply'));
    await waitFor(() => expect(applied).toHaveBeenCalledWith(id, { kind: 'invert' }, useCanvas));
  });

  it('acts on the surrounding store, not the Image tab\'s', async () => {
    const page = createCanvasStore({ syncParams: false });
    const id = page.getState().addEntity('raster', { objects: [raster] });
    page.getState().select(id);
    show(
      <CanvasStoreProvider store={page}>
        <RasterFilterMenu />
      </CanvasStoreProvider>,
    );
    fireEvent.click(screen.getByTestId('canvas-filter'));
    fireEvent.click(screen.getByTestId('canvas-filter-kind-grayscale'));
    fireEvent.click(screen.getByTestId('canvas-filter-apply'));
    await waitFor(() => expect(applied).toHaveBeenCalledWith(id, { kind: 'grayscale' }, page));
  });
});

describe('the bucket', () => {
  it('has a tool button, and a tolerance box only while it is the tool', () => {
    show(
      <>
        <ToolChooser />
        <BucketTolerance />
      </>,
    );
    expect(screen.queryByLabelText(t('canvas.toolbar.bucketTolerance'))).toBeNull();
    fireEvent.click(screen.getByTestId('canvas-tool-bucket'));
    expect(useCanvas.getState().tool).toBe('bucket');
    const input = screen.getByLabelText(t('canvas.toolbar.bucketTolerance')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '90' } });
    fireEvent.blur(input);
    expect(useCanvas.getState().bucketTolerance).toBe(90);
  });

  it('keeps the tolerance within 0 and 255', () => {
    useCanvas.getState().setBucketTolerance(-5);
    expect(useCanvas.getState().bucketTolerance).toBe(0);
    useCanvas.getState().setBucketTolerance(999);
    expect(useCanvas.getState().bucketTolerance).toBe(255);
    useCanvas.getState().setBucketTolerance(12.4);
    expect(useCanvas.getState().bucketTolerance).toBe(12);
  });
});
