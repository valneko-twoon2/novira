// @vitest-environment jsdom
// The settings of an inpaint mask: the three fixes of the painted part and the two optional limits.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { createCanvasStore, useCanvas, type InpaintEntity } from '@/state/canvas';
import { CanvasStoreProvider } from '@/state/canvasStoreContext';
import { TooltipProvider } from '@/ui';

const fixes = vi.hoisted(() => ({
  redrawMaskedPart: vi.fn(async () => undefined),
  eraseMaskedPart: vi.fn(async () => undefined),
  cutOutMaskedPart: vi.fn(async () => undefined),
}));
vi.mock('../../partFix', () => fixes);

import { InpaintSettings } from './InpaintSettings';

const initial = useCanvas.getState();
const show = (node: React.ReactNode) => render(<TooltipProvider>{node}</TooltipProvider>);
const mask = (store = useCanvas) => {
  const id = store.getState().addEntity('inpaint');
  return { id, entity: () => store.getState().entities.find((e) => e.id === id) as InpaintEntity };
};
const switchOf = (label: string) => screen.getAllByLabelText(label).find((e) => e.getAttribute('role') === 'switch' || (e as HTMLInputElement).type === 'checkbox') as HTMLElement;

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useCanvas.setState(initial, true);
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('InpaintSettings on the Image tab', () => {
  it('redraws with the instruction typed, then erases and cuts out', async () => {
    const m = mask();
    show(<InpaintSettings entity={m.entity()} />);
    fireEvent.change(screen.getByTestId('canvas-mask-instruction'), { target: { value: 'a red hat' } });
    fireEvent.click(screen.getByTestId('canvas-mask-redraw'));
    expect(fixes.redrawMaskedPart).toHaveBeenCalledWith(m.id, 'a red hat');
    await waitFor(() => expect((screen.getByTestId('canvas-mask-erase') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('canvas-mask-erase'));
    expect(fixes.eraseMaskedPart).toHaveBeenCalledWith(m.id, useCanvas);
    await waitFor(() => expect((screen.getByTestId('canvas-mask-cutout') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('canvas-mask-cutout'));
    expect(fixes.cutOutMaskedPart).toHaveBeenCalledWith(m.id, useCanvas);
  });

  it('holds the other buttons while one fix is running', async () => {
    let finish: () => void = () => undefined;
    fixes.eraseMaskedPart.mockImplementationOnce(() => new Promise<undefined>((resolve) => (finish = () => resolve(undefined))));
    const m = mask();
    show(<InpaintSettings entity={m.entity()} />);
    fireEvent.click(screen.getByTestId('canvas-mask-erase'));
    expect((screen.getByTestId('canvas-mask-redraw') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('canvas-mask-cutout') as HTMLButtonElement).disabled).toBe(true);
    finish();
    await waitFor(() => expect((screen.getByTestId('canvas-mask-redraw') as HTMLButtonElement).disabled).toBe(false));
  });

  it('turns the denoise limit and the noise level on and off, and sets them', () => {
    const m = mask();
    const view = show(<InpaintSettings entity={m.entity()} />);
    expect(m.entity().denoiseLimit).toBeNull();
    fireEvent.click(switchOf(t('canvas.mask.denoiseLimit')));
    expect(m.entity().denoiseLimit).toBe(1);
    view.rerender(<TooltipProvider><InpaintSettings entity={m.entity()} /></TooltipProvider>);
    const box = screen.getAllByLabelText(t('canvas.mask.denoiseLimit')).find((e) => (e as HTMLInputElement).type === 'number') as HTMLInputElement;
    fireEvent.change(box, { target: { value: '0.4' } });
    fireEvent.blur(box);
    expect(m.entity().denoiseLimit).toBe(0.4);
    fireEvent.click(switchOf(t('canvas.mask.denoiseLimit')));
    expect(m.entity().denoiseLimit).toBeNull();
    fireEvent.click(switchOf(t('canvas.mask.noiseLevel')));
    expect(m.entity().noiseLevel).toBe(1);
  });
});

describe('InpaintSettings on another canvas', () => {
  it('has no redraw (its result reaches only the Image tab) but erases and cuts out on its own store', () => {
    const other = createCanvasStore({ syncParams: false });
    const m = mask(other);
    show(
      <CanvasStoreProvider store={other}>
        <InpaintSettings entity={m.entity()} />
      </CanvasStoreProvider>,
    );
    expect(screen.queryByTestId('canvas-mask-redraw')).toBeNull();
    expect(screen.queryByTestId('canvas-mask-instruction')).toBeNull();
    fireEvent.click(screen.getByTestId('canvas-mask-erase'));
    expect(fixes.eraseMaskedPart).toHaveBeenCalledWith(m.id, other);
  });
});
