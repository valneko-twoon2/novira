// @vitest-environment jsdom
// The text editor's canvas: it draws the scene, selects and drags layers and their handles, takes keyboard shortcuts,
// zooms and saves the picture to the gallery.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useTextEditor } from '@/state/text/textEditor';
import { EMPTY_SCENE } from '@/state/text/textModel';
import { toast } from '@/state/toasts';
import { TooltipProvider } from '@/ui';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { TextCanvas } from './TextCanvas';

vi.mock('@/state/toasts', async (original) => ({ ...(await original<typeof import('@/state/toasts')>()), toast: vi.fn() }));

let canvases: ReturnType<typeof installRecordingCanvases>;
const state = () => useTextEditor.getState();

beforeEach(() => {
  canvases = installRecordingCanvases();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLCanvasElement) {
    const width = parseFloat(this.style.width) || 100;
    const height = parseFloat(this.style.height) || 100;
    return { left: 0, top: 0, right: width, bottom: height, x: 0, y: 0, width, height, toJSON: () => ({}) };
  });
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
  HTMLCanvasElement.prototype.hasPointerCapture = () => true;
  vi.mocked(toast).mockClear();
  useTextEditor.setState({ scene: { ...EMPTY_SCENE, layers: [] }, selectedId: null, past: [], future: [] });
});
afterEach(() => {
  cleanup();
  canvases.restore();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Runs a store change inside act so the canvas redraws (and remembers the layer sizes) before the next step. */
function add<T>(fn: () => T): T {
  let out!: T;
  act(() => {
    out = fn();
  });
  return out;
}
const renderCanvas = () =>
  render(
    <TooltipProvider>
      <TextCanvas />
    </TooltipProvider>,
  );
const overlay = () => screen.getByTestId('text-overlay');
function pointer(type: string, x: number, y: number, init: MouseEventInit = {}) {
  const e = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true, ...init });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  act(() => {
    overlay().dispatchEvent(e);
  });
}
const key = (k: string, init: KeyboardEventInit = {}) => act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })));

describe('TextCanvas drawing', () => {
  it('shows a hint while the scene is empty and the size in the toolbar', () => {
    renderCanvas();
    expect(screen.getByText('1024 × 1024')).toBeTruthy();
    expect(document.querySelector('.tx-hint')).toBeTruthy();
    add(() => state().addText('Hello'));
    expect(document.querySelector('.tx-hint')).toBeNull();
  });

  it('draws the layers and the frame of the selected one', async () => {
    renderCanvas();
    act(() => void add(() => state().addText('Hello')));
    await waitFor(() => expect(canvases.all.some((r) => r.of('fillText').length > 0)).toBe(true));
    expect(canvases.all.some((r) => r.of('strokeRect').length > 0)).toBe(true);
  });

  it('draws a checkerboard behind a transparent background and while the background picture loads', () => {
    renderCanvas();
    expect(canvases.all.some((r) => r.of('fillRect').length > 0)).toBe(true);
    act(() => state().setBackground({ kind: 'image', imageName: 'missing.png' }));
    expect(canvases.all.some((r) => r.of('fillRect').length > 0)).toBe(true);
  });

  it('loads the background picture from the gallery', async () => {
    const image = { name: 'bg.png', url: 'data:image/png;base64,AAAA', width: 640, height: 480 } as never;
    useGallery.setState({ images: [image] });
    const loaded = {} as HTMLImageElement;
    const spy = vi.spyOn(await import('@/backend'), 'loadImage').mockResolvedValue(loaded);
    renderCanvas();
    act(() => state().setBackground({ kind: 'image', imageName: 'bg.png' }, { width: 640, height: 480 }));
    await waitFor(() => expect(canvases.all.some((r) => r.of('drawImage').some((a) => a[0] === loaded))).toBe(true));
    spy.mockRestore();
    useGallery.setState({ images: [] });
  });
});

describe('TextCanvas editing', () => {
  it('selects the layer under the pointer and drags it', () => {
    renderCanvas();
    const id = add(() => state().addText('Hi'));
    act(() => state().select(null));
    const layer = () => state().scene.layers.find((l) => l.id === id)!;
    const { x, y } = layer();
    pointer('pointerdown', x, y);
    expect(state().selectedId).toBe(id);
    pointer('pointermove', x + 30, y + 20);
    pointer('pointerup', x + 30, y + 20);
    expect(layer()).toMatchObject({ x: x + 30, y: y + 20 });
    pointer('pointerdown', 5, 5);
    expect(state().selectedId).toBeNull();
    pointer('pointermove', 6, 6);
    pointer('pointerup', 6, 6);
  });

  it('ignores other mouse buttons and shows the right cursor while hovering', () => {
    renderCanvas();
    const id = add(() => state().addText('Hi'));
    const { x, y } = state().scene.layers.find((l) => l.id === id)!;
    pointer('pointerdown', x, y, { button: 2 });
    expect(state().past).toHaveLength(1);
    pointer('pointermove', x, y);
    expect(overlay().style.cursor).toBe('move');
    pointer('pointermove', 3, 3);
    expect(overlay().style.cursor).toBe('default');
  });

  it('scales the text from a corner handle', () => {
    renderCanvas();
    const id = add(() => state().addText('Hi'));
    act(() => state().select(id));
    const layer = state().scene.layers.find((l) => l.id === id)!;
    // Find the corner handle by hovering: it is the only place showing the resize cursor.
    let found: [number, number] | null = null;
    for (let dx = 5; dx < 400 && !found; dx += 1) {
      for (const dy of [67, 68, 66, 65, 69, 70, 64]) {
        pointer('pointermove', layer.x + dx, layer.y + dy);
        if (overlay().style.cursor === 'nwse-resize') {
          found = [layer.x + dx, layer.y + dy];
          break;
        }
      }
    }
    expect(found).not.toBeNull();
    const before = layer.style.fontSize;
    pointer('pointerdown', ...found!);
    pointer('pointermove', layer.x + (found![0] - layer.x) * 2, layer.y + (found![1] - layer.y) * 2);
    pointer('pointerup', 0, 0);
    expect(state().scene.layers[0]!.style.fontSize).toBeGreaterThan(before);
  });

  it('drags a bubble\'s pointer and resizes it from a corner', () => {
    renderCanvas();
    const id = add(() => state().addBubble('round', 'Hi'));
    act(() => state().select(id));
    const bubble = () => state().scene.layers.find((l) => l.id === id)! as Extract<ReturnType<typeof state>['scene']['layers'][number], { type: 'bubble' }>;
    const b = bubble();
    pointer('pointerdown', b.x + b.tail.x, b.y + b.tail.y);
    pointer('pointermove', b.x + 50, b.y + 200);
    pointer('pointerup', b.x + 50, b.y + 200);
    expect(bubble().tail).toMatchObject({ x: 50, y: 200 });
    const w = b.width;
    pointer('pointermove', b.x + w / 2, b.y + b.height / 2);
    expect(overlay().style.cursor).toBe('nwse-resize');
    pointer('pointerdown', b.x + w / 2, b.y + b.height / 2);
    pointer('pointermove', b.x + w, b.y + b.height);
    pointer('pointerup', 0, 0);
    expect(bubble().width).toBe(Math.round(w * 2));
    // A locked layer offers no handles.
    act(() => state().update(id, { locked: true }));
    pointer('pointermove', b.x + w, b.y + b.height);
    expect(overlay().style.cursor).not.toBe('nwse-resize');
  });

  it('nudges, deletes, duplicates and undoes from the keyboard', () => {
    renderCanvas();
    const id = add(() => state().addText('Hi'));
    const at = () => state().scene.layers.find((l) => l.id === id)!;
    const { x, y } = at();
    key('ArrowRight');
    key('ArrowDown', { shiftKey: true });
    key('ArrowLeft');
    key('ArrowUp');
    expect(at()).toMatchObject({ x, y: y + 9 });
    act(() => state().update(id, { locked: true }));
    key('ArrowRight');
    expect(at().x).toBe(x);
    act(() => state().update(id, { locked: false }));
    key('d', { ctrlKey: true });
    expect(state().scene.layers).toHaveLength(2);
    key('Delete');
    expect(state().scene.layers).toHaveLength(1);
    key('z', { ctrlKey: true });
    expect(state().scene.layers).toHaveLength(2);
    key('z', { ctrlKey: true, shiftKey: true });
    expect(state().scene.layers).toHaveLength(1);
    key('y', { ctrlKey: true });
  });

  it('does nothing from the keyboard without a selection', () => {
    renderCanvas();
    add(() => state().addText('Hi'));
    act(() => state().select(null));
    key('Delete');
    key('d', { ctrlKey: true });
    expect(state().scene.layers).toHaveLength(1);
  });
});

describe('TextCanvas toolbar', () => {
  it('steps the zoom and goes back to fit', () => {
    renderCanvas();
    const shown = () => document.querySelector('.tx-toolbar__zoom')!.textContent;
    expect(shown()).toBe('100%');
    fireEvent.click(screen.getByLabelText(t('text.zoom.out')));
    expect(shown()).toBe('75%');
    fireEvent.click(screen.getByLabelText(t('text.zoom.in')));
    fireEvent.click(screen.getByLabelText(t('text.zoom.in')));
    expect(shown()).toBe('150%');
    fireEvent.click(screen.getByLabelText(t('text.zoom.fit')));
    expect(shown()).toBe('100%');
  });

  it('undoes and redoes with the buttons', () => {
    renderCanvas();
    add(() => state().addText('Hi'));
    const undo = screen.getByLabelText(t('text.undo'));
    fireEvent.click(undo);
    expect(state().scene.layers).toHaveLength(0);
    fireEvent.click(screen.getByLabelText(t('text.redo')));
    expect(state().scene.layers).toHaveLength(1);
  });

  it('saves the picture to the gallery and reports success or failure', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(blob);
    };
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue({ name: 'saved.png', url: 'u', width: 1, height: 1 } as never);
    renderCanvas();
    add(() => state().addText('Hi'));
    fireEvent.click(screen.getByTestId('text-save'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' })));
    expect(upload).toHaveBeenCalledWith(blob, expect.objectContaining({ category: 'user' }));

    upload.mockRejectedValue(new Error('disk full'));
    fireEvent.click(screen.getByTestId('text-save'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', description: 'disk full' })));

    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(null);
    };
    fireEvent.click(screen.getByTestId('text-save'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'empty image' })));
  });
});
