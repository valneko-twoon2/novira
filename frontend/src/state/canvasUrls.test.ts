// @vitest-environment jsdom
// Picture URLs of canvas layers: repeated edits (replace a layer's picture, undo limit reached) must not leave every old picture alive.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { layerUrl, layerUrlCount } from '@/backend';
import { LAYER_URL_GRACE_MS } from '@/backend/oneShotUrl';
import { createCanvasStore } from './canvas';
import { UNDO_LIMIT_RANGE } from './settings';

let seq = 0;
beforeEach(() => {
  vi.useFakeTimers();
  URL.createObjectURL = vi.fn(() => `blob:layer/${seq++}`);
  URL.revokeObjectURL = vi.fn() as never;
});
afterEach(() => vi.useRealTimers());

const picture = () => layerUrl(new Blob(['x']));
const image = (url: string) => ({ kind: 'image' as const, id: `i-${url}`, url, imageName: null, x: 0, y: 0, width: 4, height: 4 });

describe('canvas layer URLs', () => {
  it('revokes the pictures that left the layers and the undo history, and keeps the ones still shown', { tags: ['state-transition'] }, () => {
    const store = createCanvasStore({ syncParams: false });
    const base = layerUrlCount();
    store.getState().addEntity('raster');
    const id = store.getState().entities[0]!.id;
    const first = picture();
    store.getState().updateEntity(id, { objects: [image(first)] });
    // Replace the picture again and again (a transform, a filter): the history keeps a few steps, the rest are dead.
    const limit = UNDO_LIMIT_RANGE.default;
    for (let i = 0; i < limit + 40; i++) store.getState().updateEntity(id, { objects: [image(picture())] });
    vi.advanceTimersByTime(2000);
    // A picture made a moment ago is not revoked yet; after the grace period the next report revokes the dead ones.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(LAYER_URL_GRACE_MS);
    store.getState().updateEntity(id, { opacity: 0.9 }, { history: false });
    vi.advanceTimersByTime(2000);
    expect((URL.revokeObjectURL as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
    // Alive: the one on show and the steps the history keeps (never more than its limit plus the current one).
    expect(layerUrlCount() - base).toBeLessThanOrEqual(limit + 2);
    const live = store.getState().entities[0]!.objects[0] as { url: string };
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(live.url);
  });

  it('keeps a picture an undo step can still bring back', { tags: ['state-transition'] }, () => {
    const store = createCanvasStore({ syncParams: false });
    store.getState().addEntity('raster');
    const id = store.getState().entities[0]!.id;
    const a = picture();
    const b = picture();
    store.getState().updateEntity(id, { objects: [image(a)] });
    store.getState().updateEntity(id, { objects: [image(b)] });
    vi.advanceTimersByTime(LAYER_URL_GRACE_MS + 2000);
    store.getState().updateEntity(id, { opacity: 0.9 }, { history: false });
    vi.advanceTimersByTime(2000);
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(a);
    store.getState().undo();
    vi.advanceTimersByTime(2000);
    expect((store.getState().entities[0]!.objects[0] as { url: string }).url).toBe(a);
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(a);
  });
});
