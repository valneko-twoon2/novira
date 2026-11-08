// @vitest-environment jsdom
// The blob URLs the page makes for the backend and for canvas layers: revoked once read, or once nothing shows them.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { holdLayerUrls, LAYER_URL_GRACE_MS, layerUrl, layerUrlCount, oneShotUrl, oneShotUrlCount, releaseOneShotUrl, storeOnce } from './oneShotUrl';

let seq = 0;
let revoke: ReturnType<typeof vi.fn>;
beforeEach(() => {
  revoke = vi.fn();
  URL.createObjectURL = vi.fn(() => `blob:test/${seq++}`);
  URL.revokeObjectURL = revoke as never;
});
afterEach(() => vi.restoreAllMocks());

const blob = () => new Blob(['x']);

describe('one-shot URLs', () => {
  it('revokes a URL it made once, and leaves any other URL alone', () => {
    const before = oneShotUrlCount();
    const url = oneShotUrl(blob());
    expect(oneShotUrlCount()).toBe(before + 1);
    releaseOneShotUrl('blob:someone-elses');
    expect(revoke).not.toHaveBeenCalled();
    releaseOneShotUrl(url);
    expect(revoke).toHaveBeenCalledWith(url);
    expect(oneShotUrlCount()).toBe(before);
    releaseOneShotUrl(url);
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it('stores a one-shot URL once and gives the same answer when it is named again', async () => {
    const url = oneShotUrl(blob());
    const save = vi.fn(async () => {
      releaseOneShotUrl(url);
      return '/novira-image/full/a.png';
    });
    expect(await storeOnce(url, 'general', save)).toBe('/novira-image/full/a.png');
    expect(await storeOnce(url, 'general', save)).toBe('/novira-image/full/a.png');
    expect(save).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it('forgets a failed store, and does not remember a URL it does not own', async () => {
    const url = oneShotUrl(blob());
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('/novira-image/full/b.png');
    await expect(storeOnce(url, 'mask', save)).rejects.toThrow('offline');
    expect(await storeOnce(url, 'mask', save)).toBe('/novira-image/full/b.png');
    const plain = vi.fn(async () => '/x');
    await storeOnce('blob:not-owned', 'mask', plain);
    await storeOnce('blob:not-owned', 'mask', plain);
    expect(plain).toHaveBeenCalledTimes(2);
  });
});

describe('layer URLs', () => {
  const later = () => Date.now() + LAYER_URL_GRACE_MS + 1;

  it('revokes a URL no canvas uses any more, but not a new one (it is put into a layer a moment later)', () => {
    const base = layerUrlCount();
    const a = layerUrl(blob());
    const b = layerUrl(blob());
    expect(layerUrlCount()).toBe(base + 2);
    expect(holdLayerUrls('c1', new Set([b]))).toBe(0);
    expect(revoke).not.toHaveBeenCalled();
    expect(holdLayerUrls('c1', new Set([b]), later())).toBe(1);
    expect(revoke).toHaveBeenCalledWith(a);
    expect(revoke).not.toHaveBeenCalledWith(b);
    expect(layerUrlCount()).toBe(base + 1);
    expect(holdLayerUrls('c1', new Set(), later())).toBe(1);
    expect(revoke).toHaveBeenCalledWith(b);
  });

  it('keeps a URL another canvas still holds', () => {
    const shared = layerUrl(blob());
    holdLayerUrls('c2', new Set([shared]), later());
    holdLayerUrls('c3', new Set([shared]), later());
    expect(holdLayerUrls('c2', new Set(), later())).toBe(0);
    expect(revoke).not.toHaveBeenCalled();
    expect(holdLayerUrls('c3', new Set(), later())).toBe(1);
    expect(revoke).toHaveBeenCalledWith(shared);
  });
});
