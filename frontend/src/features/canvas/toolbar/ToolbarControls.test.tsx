// @vitest-environment jsdom
// The brush width box and the fill colour picker of the canvas toolbar.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import { useCanvas } from '@/state/canvas';
import { TooltipProvider } from '@/ui';
import { BrushWidth } from './BrushWidth';
import { FillColor } from './FillColor';

const initial = useCanvas.getState();
const state = () => useCanvas.getState();
const show = (node: React.ReactNode) => render(<TooltipProvider>{node}</TooltipProvider>);

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  useCanvas.setState(initial, true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('brush width', () => {
  it('shows nothing for tools without a width', () => {
    state().setTool('move');
    const { container } = show(<BrushWidth />);
    expect(container.querySelector('.canvas-width')).toBeNull();
  });

  it.each([
    ['brush', 'canvas.toolbar.brushWidth', 'brushWidth'],
    ['eraser', 'canvas.toolbar.eraserWidth', 'eraserWidth'],
    ['mosaic', 'canvas.toolbar.mosaicWidth', 'mosaicWidth'],
  ] as const)('edits the width of the %s tool', (tool, key, field) => {
    state().setTool(tool);
    show(<BrushWidth />);
    const input = screen.getByLabelText(t(key)) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '77' } });
    fireEvent.blur(input);
    expect(state()[field]).toBe(77);
  });

  it('clamps the width to its limits', () => {
    state().setTool('brush');
    show(<BrushWidth />);
    const input = screen.getByLabelText(t('canvas.toolbar.brushWidth')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '9999' } });
    fireEvent.blur(input);
    expect(state().brushWidth).toBe(600);
  });

  it('picks a preset width from the popover', () => {
    state().setTool('eraser');
    show(<BrushWidth />);
    fireEvent.click(screen.getByRole('button', { name: t('canvas.toolbar.widthPresets') }));
    fireEvent.click(screen.getByRole('button', { name: '200' }));
    expect(state().eraserWidth).toBe(200);
    expect(screen.getByRole('button', { name: '200' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('offers the block size only for the mosaic tool', () => {
    state().setTool('brush');
    const { unmount } = show(<BrushWidth />);
    expect(screen.queryByLabelText(t('canvas.toolbar.mosaicBlock'))).toBeNull();
    unmount();

    state().setTool('mosaic');
    show(<BrushWidth />);
    const block = screen.getByLabelText(t('canvas.toolbar.mosaicBlock')) as HTMLInputElement;
    fireEvent.change(block, { target: { value: '24' } });
    fireEvent.blur(block);
    expect(state().mosaicBlock).toBe(24);
  });
});

describe('fill colour', () => {
  const openPicker = () => fireEvent.click(screen.getByTestId('canvas-fill-color'));
  const hexBox = () => screen.getByLabelText(t('canvas.color.hex')) as HTMLInputElement;

  it('takes a colour from the colour input, keeping the opacity', () => {
    state().setFillColor({ r: 0, g: 0, b: 0, a: 0.5 });
    show(<FillColor />);
    openPicker();
    const picker = screen.getAllByLabelText(t('canvas.toolbar.fillColor')).find((e) => (e as HTMLInputElement).type === 'color') as HTMLInputElement;
    fireEvent.change(picker, { target: { value: '#ff0000' } });
    expect(state().fillColor).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
  });

  it('takes a typed hex colour on blur and ignores a malformed one', () => {
    state().setFillColor({ r: 0, g: 0, b: 0, a: 1 });
    show(<FillColor />);
    openPicker();
    fireEvent.change(hexBox(), { target: { value: '00ff00' } });
    fireEvent.blur(hexBox());
    expect(state().fillColor).toEqual({ r: 0, g: 255, b: 0, a: 1 });
    fireEvent.change(hexBox(), { target: { value: 'nothex' } });
    fireEvent.blur(hexBox());
    expect(state().fillColor).toEqual({ r: 0, g: 255, b: 0, a: 1 });
  });

  it('commits the hex box with Enter without passing the key on to the canvas', () => {
    show(<FillColor />);
    openPicker();
    const onKey = vi.fn();
    document.addEventListener('keydown', onKey);
    fireEvent.change(hexBox(), { target: { value: '#0000ff' } });
    fireEvent.keyDown(hexBox(), { key: 'Enter' });
    document.removeEventListener('keydown', onKey);
    expect(onKey).not.toHaveBeenCalled();
    fireEvent.blur(hexBox());
    expect(state().fillColor).toMatchObject({ r: 0, g: 0, b: 255 });
  });

  it('sets the opacity as a percentage', () => {
    state().setFillColor({ r: 10, g: 20, b: 30, a: 1 });
    show(<FillColor />);
    openPicker();
    const alpha = screen.getAllByLabelText(t('canvas.color.alpha')).find((e) => (e as HTMLInputElement).type === 'number') as HTMLInputElement;
    fireEvent.change(alpha, { target: { value: '40' } });
    fireEvent.blur(alpha);
    expect(state().fillColor).toEqual({ r: 10, g: 20, b: 30, a: 0.4 });
  });

  it('picks a preset swatch but keeps the opacity', () => {
    state().setFillColor({ r: 1, g: 2, b: 3, a: 0.25 });
    show(<FillColor />);
    openPicker();
    const swatches = screen.getAllByRole('button').filter((b) => /^#[0-9a-f]{6}$/i.test(b.getAttribute('aria-label') ?? ''));
    expect(swatches.length).toBeGreaterThan(1);
    fireEvent.click(swatches[0]!);
    expect(state().fillColor.a).toBe(0.25);
    expect(`${state().fillColor.r},${state().fillColor.g},${state().fillColor.b}`).not.toBe('1,2,3');
    expect(swatches[0]!.getAttribute('aria-pressed')).toBe('true');
  });

  it('follows a colour set elsewhere', () => {
    show(<FillColor />);
    openPicker();
    act(() => state().setFillColor({ r: 255, g: 255, b: 255, a: 1 }));
    expect(hexBox().value.toLowerCase()).toBe('#ffffff');
  });
});
