// @vitest-environment jsdom
// Rendering the Face Rig animation: one pack request per pose, a GIF of the answers, and a video recorded from them.
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { backend } from '@/backend';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { encodeVideo, renderGif, renderVideo, videoType } from './animation';
import { EMPTY_RIG, type RigState } from './rig';

const poses: RigState[] = [EMPTY_RIG, { ...EMPTY_RIG, w: { au12: 1 } }, { ...EMPTY_RIG, w: { au12: 0.5 } }];
let canvases: ReturnType<typeof installRecordingCanvases>;
let preview: MockInstance<typeof backend.faceRigPreview>;

class FakeImage {
  naturalWidth = 4;
  naturalHeight = 4;
  src = '';
  decode() {
    return Promise.resolve();
  }
}

beforeEach(() => {
  canvases = installRecordingCanvases({ pixel: () => [10, 200, 90, 255] });
  vi.stubGlobal('Image', FakeImage);
  preview = vi.spyOn(backend, 'faceRigPreview').mockResolvedValue({ image: 'blob:pose' } as never);
});
afterEach(() => {
  canvases.restore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('renderGif', () => {
  it('asks the pack for each pose, sending the picture only with the first request, and reports progress', async () => {
    const progress = vi.fn();
    const gif = await renderGif('face.png', poses, 10, progress, new AbortController().signal);
    expect(String.fromCharCode(...gif.slice(0, 6))).toBe('GIF89a');
    expect(preview).toHaveBeenCalledTimes(3);
    expect(preview.mock.calls.map((c) => (c[0] as { image: string | null }).image)).toEqual(['face.png', null, null]);
    expect(progress.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
    const keys = new Set(preview.mock.calls.map((c) => (c[0] as { nodeKey: string }).nodeKey));
    expect(keys.size).toBe(1);
  });

  it('sends the picture again when the pack lost it', async () => {
    preview.mockResolvedValueOnce({ image: 'blob:a' } as never).mockResolvedValueOnce({ needsFrame: true } as never);
    await renderGif('face.png', poses.slice(0, 2), 10, () => {}, new AbortController().signal);
    const sent = preview.mock.calls.map((c) => (c[0] as { image: string | null }).image);
    expect(sent).toEqual(['face.png', null, 'face.png']);
  });

  it('throws the pack\'s message, and when the pack never accepts the picture', async () => {
    preview.mockResolvedValue({ error: 'pack stopped' } as never);
    await expect(renderGif('face.png', poses, 10, () => {}, new AbortController().signal)).rejects.toThrow('pack stopped');
    preview.mockResolvedValue({ needsFrame: true } as never);
    await expect(renderGif('face.png', poses, 10, () => {}, new AbortController().signal)).rejects.toThrow('did not accept');
  });

  it('stops when aborted', async () => {
    const abort = new AbortController();
    abort.abort();
    await expect(renderGif('face.png', poses, 10, () => {}, abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(preview).not.toHaveBeenCalled();
  });

  it('fails when the answer cannot be drawn', async () => {
    canvases.restore();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(renderGif('face.png', poses, 10, () => {}, new AbortController().signal)).rejects.toThrow('no canvas');
  });
});

describe('video', () => {
  class FakeRecorder {
    static isTypeSupported = (type: string) => type === 'video/webm;codecs=vp8';
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    start = vi.fn();
    stop = () => {
      this.ondataavailable?.({ data: new Blob(['frame']) });
      this.ondataavailable?.({ data: new Blob([]) });
      this.onstop?.();
    };
  }
  const track = { stop: vi.fn() };

  beforeEach(() => {
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    HTMLCanvasElement.prototype.captureStream = (() => ({ getTracks: () => [track] })) as never;
    vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });
  });
  afterEach(() => {
    delete (HTMLCanvasElement.prototype as { captureStream?: unknown }).captureStream;
  });

  it('picks the best supported type', () => {
    expect(videoType()).toBe('video/webm;codecs=vp8');
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => false });
    expect(videoType()).toBeNull();
  });

  it('records the frames one after another and releases the stream', async () => {
    vi.useFakeTimers();
    const frames = [1, 2, 3].map(() => ({ data: new Uint8ClampedArray(16), width: 2, height: 2 }));
    const pending = encodeVideo(frames, 100, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(100);
    const blob = await pending;
    expect(blob.type).toBe('video/webm;codecs=vp8');
    expect(blob.size).toBe(5);
    expect(track.stop).toHaveBeenCalled();
    expect(canvases.all.some((r) => r.of('putImageData').length === 3)).toBe(true);
    vi.useRealTimers();
  });

  it('refuses without frames or a canvas and stops the recording when aborted', async () => {
    await expect(encodeVideo([], 10, new AbortController().signal)).rejects.toThrow('no frames');
    const frame = { data: new Uint8ClampedArray(4), width: 1, height: 1 };
    const abort = new AbortController();
    abort.abort();
    await expect(encodeVideo([frame], 10, abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
    canvases.restore();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(encodeVideo([frame], 10, new AbortController().signal)).rejects.toThrow('no canvas');
  });

  it('renders the poses and then records them', async () => {
    vi.useFakeTimers();
    const pending = renderVideo('face.png', poses, 100, () => {}, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(500);
    expect((await pending).size).toBe(5);
    vi.useRealTimers();
  });
});
