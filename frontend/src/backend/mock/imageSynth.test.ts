// @vitest-environment jsdom
// The mock's picture painter: deterministic from seed and prompt, scaled to a size cap, and layered over a source
// picture (and mask) when there is one. Drawing is checked on recording 2D contexts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRecordingCanvases } from './canvas2dRecorder.testkit';
import { imageSize, loadImage, progressPreview, synthesize } from './imageSynth';

class FakeImage {
  naturalWidth = 320;
  naturalHeight = 240;
  crossOrigin = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(value: string) {
    queueMicrotask(() => (value.includes('bad') ? this.onerror?.() : this.onload?.()));
  }
}

let canvases: ReturnType<typeof installRecordingCanvases>;
beforeEach(() => {
  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:synth' });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(new Blob(['png'])));
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
  canvases = installRecordingCanvases();
});
afterEach(() => {
  canvases.restore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const callsOf = async (input: Parameters<typeof synthesize>[0]) => {
  const before = canvases.all.length;
  const result = await synthesize(input);
  return { result, rec: canvases.of(result.canvas), made: canvases.all.length - before };
};

describe('synthesize', () => {
  it('draws the same picture for the same seed and prompt, and another for another seed', async () => {
    const a = await callsOf({ width: 64, height: 48, seed: 1, prompt: 'a red fox in snow' });
    const b = await callsOf({ width: 64, height: 48, seed: 1, prompt: 'a red fox in snow' });
    const c = await callsOf({ width: 64, height: 48, seed: 2, prompt: 'a red fox in snow' });
    expect(JSON.stringify(b.rec.calls)).toBe(JSON.stringify(a.rec.calls));
    expect(JSON.stringify(c.rec.calls)).not.toBe(JSON.stringify(a.rec.calls));
    expect(a.result.url).toBe('blob:synth');
  });

  it('paints a background, glowing blobs in additive mode, silhouettes and sparkles, with no source picture involved', async () => {
    const { rec } = await callsOf({ width: 64, height: 48, seed: 3, prompt: '' });
    expect(rec.of('createLinearGradient')).toHaveLength(1);
    expect(rec.of('createRadialGradient').length).toBeGreaterThanOrEqual(6);
    expect(rec.sets.filter((s) => s.name === 'globalCompositeOperation').map((s) => s.value).slice(0, 2)).toEqual(['lighter', 'source-over']);
    expect(rec.of('fill').length).toBeGreaterThanOrEqual(2);
    expect(rec.of('drawImage')).toHaveLength(0);
  });

  it('shrinks a large size to the render limit and keeps a tiny one at 8 pixels', async () => {
    const big = await callsOf({ width: 4096, height: 2048, seed: 1, prompt: 'x' });
    expect([big.result.canvas.width, big.result.canvas.height]).toEqual([1024, 512]);
    const tiny = await callsOf({ width: 1, height: 1, seed: 1, prompt: 'x' });
    expect([tiny.result.canvas.width, tiny.result.canvas.height]).toEqual([8, 8]);
  });

  it('lays the pattern over the source picture with the strength as its opacity, clamped to 0..1', async () => {
    const { rec } = await callsOf({ width: 64, height: 48, seed: 1, prompt: 'x', initImageUrl: 'blob:init-a', strength: 0.5 });
    expect(rec.of('clearRect')).toHaveLength(1);
    expect(rec.of('drawImage').length).toBe(3);
    const alphas = rec.sets.filter((s) => s.name === 'globalAlpha').map((s) => s.value);
    expect(alphas).toEqual([0.5 * 0.85, 0.5 * 0.35, 1]);
    const over = await callsOf({ width: 64, height: 48, seed: 1, prompt: 'x', initImageUrl: 'blob:init-a', strength: 7 });
    expect(over.rec.sets.filter((s) => s.name === 'globalAlpha').map((s) => s.value)[0]).toBe(0.85);
    const dflt = await callsOf({ width: 64, height: 48, seed: 1, prompt: 'x', initImageUrl: 'blob:init-a' });
    expect(dflt.rec.sets.filter((s) => s.name === 'globalAlpha').map((s) => s.value)[0]).toBeCloseTo(0.7 * 0.85);
  });

  it('keeps the pure pattern when the source picture cannot be loaded', async () => {
    const { rec, result } = await callsOf({ width: 64, height: 48, seed: 1, prompt: 'x', initImageUrl: 'blob:bad-init', maskImageUrl: 'blob:mask-ok' });
    expect(rec.of('drawImage')).toHaveLength(0);
    expect(rec.of('clearRect')).toHaveLength(0);
    expect(result.url).toBe('blob:synth');
  });

  it('puts the source back outside the mask: the mask red channel becomes alpha and the redrawn part is cut by it', async () => {
    const { rec, made } = await callsOf({ width: 64, height: 48, seed: 1, prompt: 'x', initImageUrl: 'blob:init-m', maskImageUrl: 'blob:mask-m' });
    // Main canvas, the pattern copy, the alpha canvas and the redrawn canvas.
    expect(made).toBe(4);
    const [, , alpha, redrawn] = canvases.all.slice(-4);
    expect(alpha!.of('putImageData')).toHaveLength(1);
    const put = alpha!.of('putImageData')[0]![0] as { data: Uint8ClampedArray };
    // The recorder's mask is black on the left half and white on the right half.
    expect(put.data[3]).toBe(0);
    expect(put.data[(put.data.length / 4 - 1) * 4 + 3]).toBe(255);
    expect(redrawn!.sets.some((s) => s.name === 'globalCompositeOperation' && s.value === 'destination-in')).toBe(true);
    // Source first, then the redrawn part, after a clear.
    expect(rec.of('clearRect').length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the whole redrawn picture when the mask cannot be loaded', async () => {
    const { rec } = await callsOf({ width: 64, height: 48, seed: 1, prompt: 'x', initImageUrl: 'blob:init-n', maskImageUrl: 'blob:bad-mask' });
    // Only the three draws of the img2img overlay; nothing from the mask step.
    expect(rec.of('drawImage')).toHaveLength(3);
  });

  it('fails when there is no 2D context, and falls back to a data URL when the canvas gives no blob', async () => {
    canvases.restore();
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(synthesize({ width: 64, height: 48, seed: 1, prompt: 'x' })).rejects.toThrow('2d context unavailable');
    spy.mockRestore();
    canvases = installRecordingCanvases();
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((cb) => cb(null));
    expect((await synthesize({ width: 64, height: 48, seed: 1, prompt: 'x' })).url).toBe('data:image/png;base64,AAAA');
  });
});

describe('loadImage and imageSize', () => {
  it('loads a picture once per URL, with CORS only for http(s)', async () => {
    const first = loadImage('https://example.test/a.png');
    expect(loadImage('https://example.test/a.png')).toBe(first);
    expect((await first as unknown as FakeImage).crossOrigin).toBe('anonymous');
    expect((await loadImage('blob:local-a') as unknown as FakeImage).crossOrigin).toBe('');
  });

  it('rejects with the URL when the picture cannot be loaded, and reports the natural size', async () => {
    await expect(loadImage('blob:bad-load')).rejects.toThrow('failed to load blob:bad-load');
    await expect(imageSize('blob:size-a')).resolves.toEqual({ width: 320, height: 240 });
  });
});

describe('progressPreview', () => {
  const final = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    return canvas;
  };

  it('makes a 64 pixel wide preview that is blurred and noisy early and clean at the end', () => {
    const early = progressPreview(final(), 0.1, 5);
    expect(early).toBe('data:image/png;base64,AAAA');
    const earlyCtx = canvases.all.at(-1)!;
    expect(earlyCtx.sets.find((s) => s.name === 'filter')!.value).toBe('blur(5px)');
    const earlyPut = earlyCtx.of('putImageData')[0]![0] as { width: number; height: number; data: Uint8ClampedArray };
    expect([earlyPut.width, earlyPut.height]).toEqual([64, 32]);
    progressPreview(final(), 1, 5);
    const lateCtx = canvases.all.at(-1)!;
    expect(lateCtx.sets.find((s) => s.name === 'filter')!.value).toBe('blur(0px)');
    const latePut = lateCtx.of('putImageData')[0]![0] as { data: Uint8ClampedArray };
    // At the end the pixels equal the picture's (left half black, right half white): no noise.
    expect(latePut.data[0]).toBe(0);
    expect(latePut.data[(64 * 4 * 0) + 63 * 4]).toBe(255);
  });

  it('is empty when no 2D context exists', () => {
    canvases.restore();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(progressPreview(final(), 0.5, 1)).toBe('');
  });
});
