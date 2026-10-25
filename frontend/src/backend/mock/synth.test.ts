// @vitest-environment jsdom
// The mock's audio, mask and video synthesisers: deterministic output from a seed, and graceful behaviour without a browser API.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from '@/backend/mock/canvas2dRecorder.testkit';
import { audioUrl, synthMusic, synthSpeech, waveformThumbnail } from './audioSynth';
import { pointsOf, sourceOf, synthMask } from './maskSynth';
import { synthesizeVideo } from './videoSynth';
import type { ComfyGraph } from '../types';

afterEach(() => vi.unstubAllGlobals());

const header = (wav: Uint8Array) => new TextDecoder().decode(wav.slice(0, 4)) + new TextDecoder().decode(wav.slice(8, 12));
const samples = (wav: Uint8Array) => (wav.length - 44) / 2;

describe('audioSynth', () => {
  it('makes a WAV of the asked length, the same one for the same seed', () => {
    const a = synthMusic(1, 2);
    expect(header(a)).toBe('RIFFWAVE');
    expect(samples(a)).toBe(2 * 22050);
    expect(synthMusic(1, 2)).toEqual(a);
    expect(synthMusic(2, 2)).not.toEqual(a);
  });

  it('keeps music within the length limit and the tempo floor', () => {
    expect(samples(synthMusic(1, 100, 10))).toBe(12 * 22050);
    expect(samples(synthMusic(1, 0))).toBe(22050);
  });

  it('turns text into one burst per character, silent for spaces, capped in length', () => {
    const speech = synthSpeech('ab c', 3);
    expect(samples(speech)).toBe(4 * Math.round(0.11 * 22050));
    expect(synthSpeech('ab c', 3)).toEqual(speech);
    expect(samples(synthSpeech('', 3))).toBe(Math.round(0.11 * 22050));
    expect(samples(synthSpeech('あ'.repeat(500), 1))).toBeLessThanOrEqual(12 * 22050);
  });

  it('gives a URL for a clip, an object URL when there is one and a data URL otherwise', () => {
    const wav = synthSpeech('hi', 1);
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:clip' });
    expect(audioUrl(wav)).toBe('blob:clip');
    vi.stubGlobal('URL', {});
    expect(audioUrl(wav)).toMatch(/^data:audio\/wav;base64,/);
  });

  it('draws a thumbnail of the waveform as bars, or nothing without a canvas', () => {
    const canvases = installRecordingCanvases();
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
    expect(waveformThumbnail(synthMusic(1, 1))).toBe('data:image/png;base64,AAAA');
    const rec = canvases.all[0]!;
    expect(rec.of('fillRect')).toHaveLength(1 + 48);
    spy.mockRestore();
    canvases.restore();
    const none = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(waveformThumbnail(synthMusic(1, 1))).toBe('');
    none.mockRestore();
  });
});

describe('maskSynth', () => {
  const graph = (inputs: Record<string, unknown>, image?: unknown): ComfyGraph =>
    ({
      prompt: {
        a: { class_type: 'Sam2Segmentation', inputs },
        ...(image ? { b: { class_type: 'LoadImage', inputs: { image } } } : {}),
      },
    }) as unknown as ComfyGraph;

  it('reads the clicked points and the source picture from the graph', () => {
    const g = graph({ coordinates_positive: '[{"x":1,"y":2}]', coordinates_negative: '[{"x":3,"y":4}]' }, { $image: 'cat.png' });
    expect(pointsOf(g)).toEqual([
      { x: 1, y: 2, include: true },
      { x: 3, y: 4, include: false },
    ]);
    expect(sourceOf(g)).toBe('cat.png');
  });

  it('survives broken point lists and a missing picture', () => {
    expect(pointsOf(graph({ coordinates_positive: 'not json' }))).toEqual([]);
    expect(pointsOf({ prompt: {} } as unknown as ComfyGraph)).toEqual([]);
    expect(sourceOf(graph({}))).toBeNull();
  });

  it('paints included blobs white and excluded blobs black on a black picture', async () => {
    const canvases = installRecordingCanvases();
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(null);
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,BBBB');
    const url = await synthMask(100, 80, [
      { x: 10, y: 10, include: true },
      { x: 20, y: 20, include: false },
    ]);
    expect(url).toBe('data:image/png;base64,BBBB');
    const rec = canvases.all[0]!;
    expect(rec.of('arc')).toHaveLength(2);
    expect(rec.of('arc')[0]![2]).toBeCloseTo(80 * 0.18);
    expect(rec.sets.filter((s) => s.name === 'fillStyle').map((s) => s.value)).toEqual(['#000', '#fff', '#000']);
    canvases.restore();
    vi.restoreAllMocks();
  });

  it('rejects when there is no canvas', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(synthMask(10, 10, [])).rejects.toThrow('no canvas');
    vi.restoreAllMocks();
  });
});

describe('videoSynth', () => {
  it('gives up where recording is not available', async () => {
    expect(await synthesizeVideo(document.createElement('canvas'), { frames: 4, fps: 10 })).toBeNull();
  });

  it('records a pan and zoom over the picture and returns a URL', async () => {
    vi.useFakeTimers();
    const canvases = installRecordingCanvases();
    class FakeRecorder {
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {}
      stop() {
        this.ondataavailable?.({ data: new Blob(['x']) });
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:video' });
    HTMLCanvasElement.prototype.captureStream = (() => ({})) as never;
    const source = document.createElement('canvas');
    source.width = 960;
    source.height = 480;
    const pending = synthesizeVideo(source, { frames: 100, fps: 10 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toBe('blob:video');
    const out = canvases.all.find((r) => r.of('drawImage').length > 0)!;
    // Frames are capped at 36, and the output is scaled down to 480 px.
    expect(out.of('drawImage')).toHaveLength(36);
    expect(out.ctx.canvas.width).toBe(480);
    canvases.restore();
    vi.useRealTimers();
    delete (HTMLCanvasElement.prototype as { captureStream?: unknown }).captureStream;
  });

  it('gives up when the output canvas has no context', async () => {
    vi.stubGlobal('MediaRecorder', class {});
    HTMLCanvasElement.prototype.captureStream = (() => ({})) as never;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(await synthesizeVideo(document.createElement('canvas'), { frames: 4, fps: 10 })).toBeNull();
    vi.restoreAllMocks();
    delete (HTMLCanvasElement.prototype as { captureStream?: unknown }).captureStream;
  });
});
