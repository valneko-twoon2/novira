// @vitest-environment jsdom
// The "send to ..." actions, opening in a new tab, and copying a picture to the clipboard.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageDTO } from '@/backend';
import { useCanvas } from '@/state/canvas';
import { useVideo } from '@/state/media/video';
import { useTextEditor } from '@/state/text/textEditor';
import { EMPTY_SCENE, newTextLayer } from '@/state/text/textModel';
import { useTextSources } from '@/state/text/textSources';
import { useDevLog } from '@/state/devLog';
import { useToasts } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { useWorkflows } from '@/state/workflows/workflows';
import { canOpenInNewTab, copyImage, editInText, openInNewTab, sendToCanvas, sendToText, sendToVideo, sendToWorkflow } from './actions';

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
  it('imports it into the canvas, switches to the canvas view and says so', { tags: ['scenario'] }, () => {
    const importImage = vi.spyOn(useCanvas.getState(), 'importImage').mockImplementation(() => undefined);
    const img = image('a');
    sendToCanvas(img, 'raster');
    expect(importImage).toHaveBeenCalledWith(img, 'raster');
    expect(useUi.getState().activeTab).toBe('canvas');
    expect(useUi.getState().mainView.canvas).toBe('canvas');
    expect(lastToast()?.status).toBe('success');
  });

  it('makes it the first frame of an image-to-video clip on the generate tab', { tags: ['scenario'] }, () => {
    useUi.getState().setTab('upscaling');
    sendToVideo(image('v'));
    expect(useVideo.getState().form.mode).toBe('image');
    expect(useVideo.getState().form.sourceImageName).toBe('v');
    expect(useUi.getState().activeTab).toBe('generate');
    expect(useUi.getState().media).toBe('video');
  });

  it('puts it behind the text editor at its own size, without leaving the generate tab', { tags: ['scenario'] }, () => {
    useUi.getState().setTab('generate');
    const setBackground = vi.spyOn(useTextEditor.getState(), 'setBackground').mockImplementation(() => undefined);
    sendToText(image('t'));
    expect(useUi.getState().media).toBe('text');
    expect(setBackground).toHaveBeenCalledWith({ kind: 'image', imageName: 't' }, { width: 640, height: 480 });
    expect(lastToast()?.status).toBe('success');
  });

  it('opens the layers a picture was saved from in the text editor, as one undo step', { tags: ['scenario'] }, () => {
    useUi.getState().setTab('upscaling');
    const saved = { ...EMPTY_SCENE, layers: [newTextLayer(EMPTY_SCENE, 'Saved')] };
    useTextSources.setState({ sources: [{ imageName: 's.png', scene: saved }] });
    useTextEditor.setState({ scene: { ...EMPTY_SCENE, layers: [] }, selectedId: 'x', past: [], future: [] });
    expect(editInText(image('s.png'))).toBe(true);
    expect(useTextEditor.getState().scene.layers[0]).toMatchObject({ text: 'Saved' });
    expect(useTextEditor.getState().selectedId).toBeNull();
    expect(useUi.getState().activeTab).toBe('generate');
    expect(useUi.getState().media).toBe('text');
    expect(lastToast()?.status).toBe('success');
    useTextEditor.getState().undo();
    expect(useTextEditor.getState().scene.layers).toHaveLength(0);
  });

  it('does nothing for a picture whose layers are gone', { tags: ['error-guessing'] }, () => {
    useTextSources.setState({ sources: [] });
    useUi.getState().setTab('upscaling');
    useTextEditor.setState({ scene: { ...EMPTY_SCENE, layers: [] }, selectedId: null, past: [], future: [] });
    expect(editInText(image('unknown.png'))).toBe(false);
    expect(useUi.getState().activeTab).toBe('upscaling');
    expect(useTextEditor.getState().past).toHaveLength(0);
    expect(lastToast()).toBeUndefined();
  });

  it('adds it as an image input of the workflow being edited', { tags: ['equivalence'] }, () => {
    const add = vi.spyOn(useWorkflows.getState(), 'addImageInput').mockImplementation(() => undefined);
    const img = image('w');
    sendToWorkflow(img);
    expect(add).toHaveBeenCalledWith(img);
  });
});

describe('opening in a new tab', () => {
  it('opens the picture URL in a browser window, which only the browser build offers', { tags: ['condition'] }, () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(canOpenInNewTab()).toBe(true);
    openInNewTab(image('o'));
    expect(open).toHaveBeenCalledWith('blob:o', '_blank', 'noopener');
  });
});

describe('copying a picture', () => {
  const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const png = (type = 'image/png') => new Blob([new Uint8Array([...PNG_HEAD, 1, 2, 3])], { type });
  const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6])], { type: 'image/jpeg' });
  const answer = (blob: Blob, status = 200) => vi.fn().mockResolvedValue({ ok: status < 400, status, blob: async () => blob });

  /** The clipboard as the browser has it: the item keeps what it was given, and `write` hands that to the test. */
  function stubClipboard(write = vi.fn().mockResolvedValue(undefined)) {
    vi.stubGlobal('ClipboardItem', class { constructor(public items: Record<string, Blob | Promise<Blob>>) {} });
    vi.stubGlobal('navigator', { clipboard: { write } });
    return write;
  }
  type Items = { items: Record<string, Promise<Blob>> }[];
  /** The picture the first write was given: a promise, settled when the picture has been read. */
  const givenItem = (write: ReturnType<typeof vi.fn>): Promise<Blob> => ((write.mock.calls[0]?.[0] ?? []) as Items)[0]?.items['image/png'] ?? Promise.reject(new Error('nothing was written'));

  it(
    'asks the clipboard at once, before the picture has been read, and reports success when it is on the clipboard',
    { tags: ['state-transition'] },
    async () => {
      const write = stubClipboard();
      let release: (b: Blob) => void = () => undefined;
      vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => (release = (b) => resolve({ ok: true, status: 200, blob: async () => b })))));
      const done = copyImage(image('c'));
      expect(write).toHaveBeenCalledTimes(1);
      expect(lastToast()).toBeUndefined();
      release(png());
      await done;
      expect(lastToast()?.status).toBe('success');
    },
  );

  it('puts nothing on the clipboard for a video or a sound, and says nothing', { tags: ['equivalence'] }, async () => {
    const write = stubClipboard();
    const fetchMock = answer(png());
    vi.stubGlobal('fetch', fetchMock);
    for (const mediaType of ['video', 'audio'] as const) await copyImage({ ...image('v'), mediaType });
    expect(write).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lastToast()).toBeUndefined();
  });

  it('puts the stored PNG on the clipboard as it is, without decoding or encoding it', { tags: ['scenario'] }, async () => {
    const write = stubClipboard();
    const stored = png('application/octet-stream');
    const fetchMock = answer(stored);
    vi.stubGlobal('fetch', fetchMock);
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');
    const bitmap = vi.fn();
    vi.stubGlobal('createImageBitmap', bitmap);
    await copyImage(image('p'));
    const given = await givenItem(write);
    expect(fetchMock).toHaveBeenCalledWith('blob:p');
    expect(given.type).toBe('image/png');
    expect(given.size).toBe(stored.size);
    expect(toBlob).not.toHaveBeenCalled();
    expect(bitmap).not.toHaveBeenCalled();
  });

  it('converts a picture that is not a PNG, off the main thread', { tags: ['equivalence'] }, async () => {
    const write = stubClipboard();
    vi.stubGlobal('fetch', answer(jpeg()));
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 8, height: 6, close }));
    const drawn = vi.fn();
    const converted = new Blob(['converted'], { type: 'image/png' });
    vi.stubGlobal('OffscreenCanvas', class { constructor(public width: number, public height: number) {} getContext() { return { drawImage: drawn }; } convertToBlob = vi.fn().mockResolvedValue(converted); });
    await copyImage(image('j'));
    expect(await givenItem(write)).toBe(converted);
    expect(drawn).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(lastToast()?.status).toBe('success');
  });

  it('converts through a canvas on the page where there is no OffscreenCanvas', { tags: ['condition'] }, async () => {
    const write = stubClipboard();
    vi.stubGlobal('fetch', answer(jpeg()));
    vi.stubGlobal('createImageBitmap', undefined);
    vi.stubGlobal('OffscreenCanvas', undefined);
    URL.createObjectURL = vi.fn(() => 'blob:source');
    URL.revokeObjectURL = vi.fn();
    const converted = new Blob(['canvas'], { type: 'image/png' });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(converted));
    vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (this: HTMLImageElement) {
      queueMicrotask(() => this.onload?.(new Event('load')));
    });
    await copyImage(image('j'));
    expect(await givenItem(write)).toBe(converted);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:source');
    expect(lastToast()?.status).toBe('success');
  });

  it(
    'says the copy failed, with the reason, and writes the reason to the developer log, when the picture cannot be read',
    { tags: ['error-guessing'] },
    async () => {
      stubClipboard(vi.fn((items: Items) => (items[0]?.items['image/png'] ?? Promise.resolve()).then(() => undefined)));
      vi.stubGlobal('fetch', answer(new Blob([]), 404));
      await copyImage(image('gone'));
      expect(lastToast()).toMatchObject({ status: 'error', description: expect.stringContaining('404') });
      expect(useDevLog.getState().entries.at(-1)).toMatchObject({ level: 'error', source: 'gallery', message: expect.stringContaining('gone') });
    },
  );

  it(
    'reports a clipboard that refuses the write, naming the browser error in the developer log',
    { tags: ['error-guessing'] },
    async () => {
      stubClipboard(vi.fn().mockRejectedValue(Object.assign(new Error('Document is not focused.'), { name: 'NotAllowedError' })));
      vi.stubGlobal('fetch', answer(png()));
      await copyImage(image('n'));
      expect(lastToast()?.status).toBe('error');
      expect(useDevLog.getState().entries.at(-1)?.message).toContain('NotAllowedError');
    },
  );

  it(
    'warns, and does not read the picture, where the browser has no picture clipboard',
    { tags: ['error-guessing', 'condition'] },
    async () => {
      vi.stubGlobal('ClipboardItem', undefined);
      vi.stubGlobal('navigator', { clipboard: { write: vi.fn() } });
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      await copyImage(image('u'));
      expect(lastToast()?.status).toBe('warning');
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});
