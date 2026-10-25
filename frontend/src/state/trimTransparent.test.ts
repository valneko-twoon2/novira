// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type ImageDTO } from '@/backend';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { t } from '@/i18n';
import { useGallery } from './gallery';
import { useToasts } from './toasts';
import { trimTransparent } from './trim';

const image = { name: 'cut.png', url: 'blob:cut', boardId: 'b1', category: 'general' } as ImageDTO;
const saved = { name: 'cut-trim.png' } as ImageDTO;
const lastToast = () => useToasts.getState().toasts.at(-1);

/** A stand-in for Image that loads (or fails) as soon as its source is set. */
function stubImage(opts: { fail?: boolean; width?: number; height?: number }) {
  const created: { crossOrigin: string }[] = [];
  class FakeImage {
    crossOrigin = '';
    naturalWidth = opts.width ?? 10;
    naturalHeight = opts.height ?? 10;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() {
      created.push(this);
    }
    set src(_v: string) {
      queueMicrotask(() => (opts.fail ? this.onerror?.() : this.onload?.()));
    }
  }
  vi.stubGlobal('Image', FakeImage);
  return created;
}

let canvases: ReturnType<typeof installRecordingCanvases>;
let blobResult: Blob | null;
beforeEach(() => {
  useToasts.setState({ toasts: [] });
  blobResult = new Blob(['png'], { type: 'image/png' });
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(blobResult);
  };
});
afterEach(() => {
  canvases?.restore();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('trimTransparent', () => {
  it('saves a crop of the opaque area next to the original and adds it to the gallery', async () => {
    stubImage({ width: 10, height: 10 });
    canvases = installRecordingCanvases({ pixel: (x, y) => [0, 0, 0, x >= 2 && x < 6 && y >= 3 && y < 5 ? 255 : 0] });
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue(saved);
    const addImage = vi.spyOn(useGallery.getState(), 'addImage');
    useGallery.setState({ addImage });

    const result = await trimTransparent(image);

    expect(result).toBe(saved);
    expect(upload).toHaveBeenCalledWith(expect.any(Blob), { boardId: 'b1', category: 'general' });
    expect(addImage).toHaveBeenCalledWith(saved);
    expect(lastToast()).toMatchObject({ status: 'success', title: t('gallery.trim.saved', { width: 4, height: 2 }) });
    const draws = canvases.all.flatMap((r) => r.of('drawImage'));
    expect(draws).toContainEqual([expect.anything(), 2, 3, 4, 2, 0, 0, 4, 2]);
  });

  it('asks for cross-origin access only for remote pictures', async () => {
    const created = stubImage({});
    canvases = installRecordingCanvases({ pixel: () => [0, 0, 0, 255] });
    await trimTransparent({ ...image, url: 'https://example.test/a.png' });
    await trimTransparent(image);
    expect(created.map((i) => i.crossOrigin)).toEqual(['anonymous', '']);
  });

  it('warns when the whole picture is transparent', async () => {
    stubImage({});
    canvases = installRecordingCanvases({ pixel: () => [0, 0, 0, 0] });
    const upload = vi.spyOn(backend, 'uploadImage');
    expect(await trimTransparent(image)).toBeNull();
    expect(lastToast()).toMatchObject({ status: 'warning', title: t('gallery.trim.empty') });
    expect(upload).not.toHaveBeenCalled();
  });

  it('says so when there is no margin to trim', async () => {
    stubImage({});
    canvases = installRecordingCanvases({ pixel: () => [0, 0, 0, 255] });
    const upload = vi.spyOn(backend, 'uploadImage');
    expect(await trimTransparent(image)).toBeNull();
    expect(lastToast()).toMatchObject({ status: 'info', title: t('gallery.trim.nothing') });
    expect(upload).not.toHaveBeenCalled();
  });

  it('reports a picture that cannot be loaded', async () => {
    stubImage({ fail: true });
    expect(await trimTransparent(image)).toBeNull();
    expect(lastToast()).toMatchObject({ status: 'error', title: t('gallery.trim.failed'), description: 'image load failed' });
  });

  it('reports a canvas that cannot encode the crop, and a missing 2d context', async () => {
    stubImage({});
    canvases = installRecordingCanvases({ pixel: (x) => [0, 0, 0, x < 5 ? 255 : 0] });
    blobResult = null;
    expect(await trimTransparent(image)).toBeNull();
    expect(lastToast()).toMatchObject({ status: 'error', description: 'empty image' });
    canvases.restore();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(await trimTransparent(image)).toBeNull();
    expect(lastToast()).toMatchObject({ status: 'error', description: 'no canvas' });
  });
});
