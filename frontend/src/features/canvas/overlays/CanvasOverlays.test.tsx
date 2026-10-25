// @vitest-environment jsdom
// The canvas drop tiles shown while pictures are dragged over the canvas, and the canvas keyboard shortcuts.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { useCanvas } from '@/state/canvas';
import { DEFERRED_MIME, IMAGE_MIME } from '@/state/dnd';
import { useGallery } from '@/state/gallery';
import { useParams } from '@/state/params';
import { useToasts } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { CanvasHotkeys } from '../CanvasHotkeys';
import { CanvasDropTargets } from './CanvasDropTargets';

const initial = { canvas: useCanvas.getState(), gallery: useGallery.getState(), toasts: useToasts.getState(), ui: useUi.getState(), params: useParams.getState() };
const image = (name: string) => ({ name, url: `blob:${name}`, thumbnailUrl: `blob:t-${name}`, width: 400, height: 200 }) as never;

beforeEach(() => {
  useCanvas.setState(initial.canvas, true);
  useGallery.setState({ ...initial.gallery, images: [image('a.png'), image('b.png')] }, true);
  useToasts.setState(initial.toasts, true);
  useUi.setState(initial.ui, true);
  useParams.setState(initial.params, true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function transfer(data: Record<string, string>, files: File[] = []) {
  return {
    types: [...Object.keys(data), ...(files.length ? ['Files'] : [])],
    getData: (type: string) => data[type] ?? '',
    files,
    dropEffect: 'none',
  };
}

describe('CanvasDropTargets', () => {
  const host = () => document.getElementById('host')!;
  const show = () =>
    render(
      <div id="host">
        <HostProbe />
      </div>,
    );
  function HostProbe() {
    // The host element exists only after the first render, as in the canvas view.
    return <Targets />;
  }
  function Targets() {
    const el = document.getElementById('host');
    return <CanvasDropTargets host={el} />;
  }
  const dragIn = (types: Record<string, string>, files: File[] = []) => fireEvent.dragEnter(host(), { dataTransfer: transfer(types, files) });
  /** A dragleave towards `to` (jsdom has no DragEvent, so the related target is set by hand). */
  const leave = (from: Element, to: Element | null) => {
    const e = new Event('dragleave', { bubbles: true });
    Object.defineProperty(e, 'relatedTarget', { value: to });
    fireEvent(from, e);
  };
  const names = (...n: string[]) => ({ [IMAGE_MIME]: JSON.stringify(n) });

  it('stays hidden until a picture is dragged in, and hides when the drag ends', () => {
    const { rerender } = show();
    expect(screen.queryByTestId('canvas-drop')).toBeNull();
    rerender(
      <div id="host">
        <Targets />
      </div>,
    );
    dragIn({ 'text/plain': 'x' });
    expect(screen.queryByTestId('canvas-drop')).toBeNull();
    dragIn(names('a.png'));
    expect(screen.getByTestId('canvas-drop')).toBeTruthy();
    act(() => void window.dispatchEvent(new Event('dragend')));
    expect(screen.queryByTestId('canvas-drop')).toBeNull();
  });

  const startDrag = (data: Record<string, string>, files: File[] = []) => {
    const view = show();
    view.rerender(
      <div id="host">
        <Targets />
      </div>,
    );
    dragIn(data, files);
  };

  it('imports a dropped gallery picture as the layer type of the tile', async () => {
    startDrag(names('a.png'));
    fireEvent.drop(screen.getByText(t('canvas.drop.control')), { dataTransfer: transfer(names('a.png')) });
    await waitFor(() => expect(useCanvas.getState().entities.map((e) => e.type)).toEqual(['control']));
    expect(screen.queryByTestId('canvas-drop')).toBeNull();
  });

  it('adds a dropped picture as a global reference image', async () => {
    startDrag(names('a.png', 'b.png'));
    fireEvent.drop(screen.getByText(t('canvas.drop.global')), { dataTransfer: transfer(names('a.png', 'b.png')) });
    await waitFor(() => expect(useParams.getState().refImages).toHaveLength(2));
  });

  it('uploads dropped files and imports them', async () => {
    const uploaded = image('up.png');
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue(uploaded);
    const file = new File(['x'], 'x.png', { type: 'image/png' });
    startDrag({}, [file, new File(['y'], 'y.txt', { type: 'text/plain' })]);
    fireEvent.drop(screen.getByText(t('canvas.drop.raster')), { dataTransfer: transfer({}, [file, new File(['y'], 'y.txt', { type: 'text/plain' })]) });
    await waitFor(() => expect(useCanvas.getState().entities).toHaveLength(1));
    expect(upload).toHaveBeenCalledTimes(1);
    expect(useGallery.getState().images.some((i) => i.name === 'up.png')).toBe(true);
  });

  it('does nothing for a drop without pictures, and reports a failed import', async () => {
    startDrag(names());
    fireEvent.drop(screen.getByText(t('canvas.drop.inpaint')), { dataTransfer: transfer({}) });
    await waitFor(() => expect(screen.queryByTestId('canvas-drop')).toBeNull());
    expect(useCanvas.getState().entities).toHaveLength(0);

    vi.spyOn(backend, 'uploadImage').mockRejectedValue(new Error('too big'));
    const file = new File(['x'], 'x.png', { type: 'image/png' });
    cleanup();
    startDrag({}, [file]);
    fireEvent.drop(screen.getByText(t('canvas.drop.regional')), { dataTransfer: transfer({}, [file]) });
    await waitFor(() => expect(useToasts.getState().toasts.at(-1)).toMatchObject({ status: 'error', description: 'too big' }));
  });

  it('highlights the tile under the pointer and ignores the area between tiles', () => {
    startDrag(names('a.png'));
    const tile = screen.getByText(t('canvas.drop.raster')).closest('.canvas-drop__target')!;
    fireEvent.dragOver(tile, { dataTransfer: transfer(names('a.png')) });
    expect(tile.className).toContain('is-over');
    leave(tile, screen.getByTestId('canvas-drop'));
    expect(tile.className).not.toContain('is-over');
    const area = screen.getByTestId('canvas-drop');
    fireEvent.dragOver(area, { dataTransfer: transfer(names('a.png')) });
    fireEvent.dragOver(area, { dataTransfer: transfer({ 'text/plain': 'x' }) });
    fireEvent.drop(area, { dataTransfer: transfer(names('a.png')) });
    expect(screen.queryByTestId('canvas-drop')).toBeNull();
  });

  it('hides when the drag leaves the area for the outside', () => {
    startDrag({ [DEFERRED_MIME]: JSON.stringify({ kind: 'layer', id: 'x' }) });
    const area = screen.getByTestId('canvas-drop');
    leave(area, area.firstElementChild);
    expect(screen.getByTestId('canvas-drop')).toBeTruthy();
    leave(area, null);
    expect(screen.queryByTestId('canvas-drop')).toBeNull();
  });
});

describe('CanvasHotkeys', () => {
  const press = (key: string, init: KeyboardEventInit = {}) => act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })));
  const state = () => useCanvas.getState();

  it('switches tools with letters and swaps with q', () => {
    render(<CanvasHotkeys />);
    for (const [key, tool] of [['b', 'brush'], ['e', 'eraser'], ['m', 'mosaic'], ['u', 'rect'], ['v', 'move'], ['c', 'bbox'], ['h', 'view'], ['i', 'colorPicker']] as const) {
      press(key);
      expect(state().tool).toBe(tool);
    }
    press('b');
    press('e');
    press('q');
    expect(state().tool).toBe('brush');
  });

  it('resizes the brush, eraser and mosaic with the bracket keys', () => {
    render(<CanvasHotkeys />);
    act(() => state().setBrushWidth(20));
    press('b');
    press(']');
    expect(state().brushWidth).toBeGreaterThan(20);
    press('[');
    press('[');
    expect(state().brushWidth).toBeLessThan(23);
    press('e');
    const eraser = state().eraserWidth;
    press(']');
    expect(state().eraserWidth).toBeGreaterThan(eraser);
    press('m');
    const mosaic = state().mosaicWidth;
    press('[');
    expect(state().mosaicWidth).toBeLessThan(mosaic);
  });

  it('undoes and redoes, and deletes the selected layer or reference image', () => {
    render(<CanvasHotkeys />);
    const id = state().addEntity('raster');
    state().select(id);
    press('Delete');
    expect(state().entities).toHaveLength(0);
    press('z', { ctrlKey: true });
    expect(state().entities).toHaveLength(1);
    press('z', { ctrlKey: true, shiftKey: true });
    expect(state().entities).toHaveLength(0);
    press('y', { ctrlKey: true });

    useParams.getState().addRefImage({ modelKey: null });
    const ref = useParams.getState().refImages[0]!;
    act(() => state().select(ref.id));
    press('Delete');
    expect(useParams.getState().refImages).toHaveLength(0);
    act(() => state().select(null));
    press('Delete');
  });

  it('zooms and fits the view', () => {
    render(<CanvasHotkeys />);
    const before = state().viewport;
    press('+', { code: 'Equal' });
    expect(state().viewport.scale).toBeGreaterThan(before.scale);
    press('-');
    press('0', { ctrlKey: true });
    press('1', { ctrlKey: true });
    expect(state().viewport.scale).toBe(1);
    press('R', { shiftKey: true });
    press('C', { shiftKey: true });
  });

  it('accepts or discards staged results and steps through them from the keyboard', () => {
    render(<CanvasHotkeys />);
    useGallery.setState({ images: [image('a.png'), image('b.png')] });
    act(() => {
      state().addStagedImage('a.png');
      state().addStagedImage('b.png');
    });
    press('ArrowLeft');
    expect(state().stagedIndex).toBe(0);
    press('ArrowRight');
    expect(state().stagedIndex).toBe(1);
    press('Enter');
    expect(state().entities).toHaveLength(1);
    expect(state().stagedImageNames).toEqual([]);
    act(() => state().addStagedImage('a.png'));
    press('Escape');
    expect(state().stagedImageNames).toEqual([]);
  });
});
