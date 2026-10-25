// @vitest-environment jsdom
// The "send to ..." actions, opening in a new tab, and the successful image copy.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { useCanvas } from '@/state/canvas';
import { useVideo } from '@/state/media/video';
import { useTextEditor } from '@/state/text/textEditor';
import { useToasts } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { useWorkflows } from '@/state/workflows/workflows';
import { canOpenInNewTab, copyImage, openInNewTab, sendToCanvas, sendToText, sendToVideo, sendToWorkflow } from './actions';

const initial = { toasts: useToasts.getState(), ui: useUi.getState() };
const image = (name: string): ImageDTO =>
  ({ name, url: `blob:${name}`, thumbnailUrl: `blob:t-${name}`, width: 640, height: 480, workflow: null, metadata: null }) as unknown as ImageDTO;
const lastToast = () => useToasts.getState().toasts.at(-1);

beforeEach(() => {
  useToasts.setState(initial.toasts, true);
  useUi.setState(initial.ui, true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('sending a picture to another screen', () => {
  it('imports it into the canvas, switches to the canvas view and says so', () => {
    const importImage = vi.spyOn(useCanvas.getState(), 'importImage').mockImplementation(() => undefined);
    const img = image('a');
    sendToCanvas(img, 'raster');
    expect(importImage).toHaveBeenCalledWith(img, 'raster');
    expect(useUi.getState().activeTab).toBe('canvas');
    expect(useUi.getState().mainView.canvas).toBe('canvas');
    expect(lastToast()?.status).toBe('success');
  });

  it('makes it the first frame of an image-to-video clip on the generate tab', () => {
    useUi.getState().setTab('upscaling');
    sendToVideo(image('v'));
    expect(useVideo.getState().form.mode).toBe('image');
    expect(useVideo.getState().form.sourceImageName).toBe('v');
    expect(useUi.getState().activeTab).toBe('generate');
    expect(useUi.getState().media).toBe('video');
  });

  it('puts it behind the text editor at its own size, without leaving the generate tab', () => {
    useUi.getState().setTab('generate');
    const setBackground = vi.spyOn(useTextEditor.getState(), 'setBackground').mockImplementation(() => undefined);
    sendToText(image('t'));
    expect(useUi.getState().media).toBe('text');
    expect(setBackground).toHaveBeenCalledWith({ kind: 'image', imageName: 't' }, { width: 640, height: 480 });
    expect(lastToast()?.status).toBe('success');
  });

  it('adds it as an image input of the workflow being edited', () => {
    const add = vi.spyOn(useWorkflows.getState(), 'addImageInput').mockImplementation(() => undefined);
    const img = image('w');
    sendToWorkflow(img);
    expect(add).toHaveBeenCalledWith(img);
  });
});

describe('opening in a new tab', () => {
  it('opens the picture URL in a browser window, which only the browser build offers', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(canOpenInNewTab()).toBe(true);
    openInNewTab(image('o'));
    expect(open).toHaveBeenCalledWith('blob:o', '_blank', 'noopener');
  });
});

describe('copying a picture', () => {
  it('writes a PNG to the clipboard and reports success', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('ClipboardItem', class { constructor(public items: Record<string, Blob>) {} });
    vi.stubGlobal('navigator', { clipboard: { write } });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(new Blob(['png'], { type: 'image/png' })));
    vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (this: HTMLImageElement) {
      queueMicrotask(() => this.onload?.(new Event('load')));
    });
    await copyImage(image('c'));
    expect(write).toHaveBeenCalledTimes(1);
    expect(lastToast()?.status).toBe('success');
  });

  it('loads a remote picture with cross-origin access and reports a failed PNG conversion', async () => {
    vi.stubGlobal('ClipboardItem', class {});
    vi.stubGlobal('navigator', { clipboard: { write: vi.fn() } });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(null));
    let crossOrigin: string | null = null;
    vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (this: HTMLImageElement) {
      crossOrigin = this.crossOrigin;
      queueMicrotask(() => this.onload?.(new Event('load')));
    });
    await copyImage({ ...image('r'), url: 'https://example.test/r.png' });
    expect(crossOrigin).toBe('anonymous');
    expect(lastToast()?.status).toBe('error');
  });
});
