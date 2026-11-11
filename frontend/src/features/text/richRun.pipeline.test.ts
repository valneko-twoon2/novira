// @vitest-environment jsdom
// "Finish with AI" from the press of Generate to the fill on the layer: the pictures it prepares, the queue it follows and how it ends.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackendEvent, ImageDTO, ModelConfig, QueueItem } from '@/backend';
import { recordingContext } from '@/backend/mock/canvas2dRecorder.testkit';
import { useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { RICH_FORM_DEFAULTS, useRichForm } from '@/state/text/richForm';
import { useTextEditor } from '@/state/text/textEditor';
import { EMPTY_SCENE, newTextLayer, type TextLayer } from '@/state/text/textModel';

const fake = vi.hoisted(() => {
  const state = { listener: null as ((e: unknown) => void) | null, queue: [] as unknown[], uploads: 0, enqueueFails: false, uploadFailsAt: 0 };
  const backend = {
    subscribe: vi.fn((l: (e: unknown) => void) => {
      state.listener = l;
      return () => {
        state.listener = null;
      };
    }),
    uploadImage: vi.fn(async () => {
      state.uploads++;
      if (state.uploadFailsAt === state.uploads) throw new Error('upload refused');
      return { name: `up${state.uploads}.png`, url: `/u/${state.uploads}.png`, thumbnailUrl: `/t/${state.uploads}.png`, width: 10, height: 10 };
    }),
    deleteImages: vi.fn(async (names: string[]) => void names),
    cancelQueueItem: vi.fn(async (id: number) => void id),
    listQueue: vi.fn(() => state.queue),
    enqueue: vi.fn(async (request: unknown) => {
      if (state.enqueueFails) throw new Error('queue refused');
      void request;
      return [{ id: 1 }, { id: 2 }];
    }),
  };
  return { state, backend, toast: vi.fn() };
});

vi.mock('@/backend', async (original) => ({ ...(await original<typeof import('@/backend')>()), backend: fake.backend, loadImage: vi.fn(async () => ({})) }));
vi.mock('@/state/fonts', async (original) => ({ ...(await original<typeof import('@/state/fonts')>()), ensureFont: vi.fn(async () => undefined) }));
vi.mock('@/state/toasts', () => ({ toast: fake.toast }));

const { attachRich, buildSelectedRich, dropRich, richReadiness, runRich, subscribeRichReadiness, useRichRun } = await import('./richRun');

const model = (key: string, type: ModelConfig['type'], name = key): ModelConfig => ({ key, name, base: 'sdxl', type, format: 'checkpoint', description: '', path: `${name}.safetensors`, size: 1, source: '' });
const size = { width: 400, height: 300 };
const picture = (name: string): ImageDTO => ({ name, url: `/p/${name}`, thumbnailUrl: `/p/${name}`, width: 10, height: 10 }) as ImageDTO;
const item = (id: number, status: QueueItem['status'] = 'completed', error: string | null = null) => ({ id, status, error }) as QueueItem;
const emit = (event: BackendEvent) => fake.state.listener?.(event);
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
};

function selectText(text = 'NOVIRA'): TextLayer {
  const layer = { ...newTextLayer(size, 'NOVIRA'), text };
  useTextEditor.setState({ scene: { ...EMPTY_SCENE, layers: [layer] }, selectedId: layer.id, past: [], future: [] });
  return layer;
}
const current = (id: string) => useTextEditor.getState().scene.layers.find((l) => l.id === id) as TextLayer | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(fake.state, { listener: null, queue: [], uploads: 0, enqueueFails: false, uploadFailsAt: 0 });
  // jsdom draws nothing: a recording context hands out opaque pixels, and a canvas gives its blob at once.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return recordingContext({ canvas: this }).ctx as never;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done: BlobCallback) => done(new Blob(['x'])));
  vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });
  useRichRun.setState({ running: {} });
  useRichForm.setState({ form: { ...RICH_FORM_DEFAULTS, randomSeed: false, seed: 7 } });
  useModels.setState({ models: [model('wai', 'main'), model('cn', 'controlnet', 'union-promax')] });
  useParams.setState({ iterations: 2 });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('richReadiness', () => {
  it('names what is missing: a model, then a text layer with letters', { tags: ['condition'] }, () => {
    selectText();
    useModels.setState({ models: [] });
    expect(richReadiness()).toHaveLength(1);
    useModels.setState({ models: [model('wai', 'main')] });
    selectText('   ');
    expect(richReadiness()).toHaveLength(1);
    selectText();
    expect(richReadiness()).toEqual([]);
  });

  it('tells the listener only when the reasons change, and stops when told to', { tags: ['state-transition'] }, () => {
    selectText();
    const changed = vi.fn();
    const off = subscribeRichReadiness(changed);
    useTextEditor.getState().update(useTextEditor.getState().selectedId as string, { x: 5 });
    expect(changed).not.toHaveBeenCalled();
    selectText('   ');
    expect(changed).toHaveBeenCalledTimes(1);
    off();
    selectText();
    expect(changed).toHaveBeenCalledTimes(1);
  });
});

describe('a run from Generate to the fill', () => {
  it(
    'makes the base and the line picture, follows the batch and puts each cut picture on the layer',
    { tags: ['scenario', 'state-transition'] },
    async () => {
      const layer = selectText();
      const request = await buildSelectedRich(false);
      expect(fake.backend.uploadImage).toHaveBeenCalledTimes(2);
      attachRich([item(1, 'pending'), item(2, 'pending')], request);
      expect(useRichRun.getState().running[layer.id]).toEqual({ done: 0, total: 2 });

      emit({ type: 'image_added', image: picture('r1.png'), item: item(1) });
      await flush();
      const first = current(layer.id)?.rich;
      expect(first?.candidates).toHaveLength(1);
      expect(useRichRun.getState().running[layer.id]).toEqual({ done: 1, total: 2 });
      expect(useTextEditor.getState().past).toHaveLength(1);

      emit({ type: 'image_added', image: picture('r2.png'), item: item(2) });
      await flush();
      const second = current(layer.id)?.rich;
      expect(second?.candidates).toHaveLength(2);
      expect(second?.candidates[1]).toBe(first?.imageName);
      expect(useTextEditor.getState().past).toHaveLength(1);
      expect(useRichRun.getState().running).toEqual({});
      // The pictures made for the run only are deleted when it is over: the base, the line and the engine's two results.
      const deleted = fake.backend.deleteImages.mock.calls.flatMap((c) => c[0] as string[]);
      expect(deleted).toEqual(expect.arrayContaining(['up1.png', 'up2.png', 'r1.png', 'r2.png']));
      expect(fake.backend.subscribe).toHaveBeenCalledTimes(1);
      expect(fake.state.listener).toBeNull();
    },
  );

  it('draws a new seed per run when the seed is random and shows it in the form', { tags: ['condition'] }, async () => {
    selectText();
    useRichForm.setState({ form: { ...RICH_FORM_DEFAULTS, randomSeed: true, seed: 0 } });
    await buildSelectedRich(false);
    const seed = useRichForm.getState().form.seed;
    expect(Number.isInteger(seed)).toBe(true);
  });

  it('handles events that came before the queue told the items, once it does', { tags: ['state-transition'] }, async () => {
    const layer = selectText();
    const request = await buildSelectedRich(true);
    emit({ type: 'image_added', image: picture('early.png'), item: item(1) });
    await flush();
    expect(current(layer.id)?.rich).toBeUndefined();
    attachRich([item(1, 'in_progress')], request);
    await flush();
    expect(current(layer.id)?.rich?.candidates).toHaveLength(1);
    expect(useRichRun.getState().running).toEqual({});
  });

  it('reports a failed item once, and ends the run when the last item is over', { tags: ['state-transition'] }, async () => {
    const layer = selectText();
    const request = await buildSelectedRich(false);
    attachRich([item(1, 'pending'), item(2, 'pending')], request);
    emit({ type: 'queue_item_status_changed', item: item(1, 'failed', 'out of memory') });
    emit({ type: 'queue_item_status_changed', item: item(2, 'failed', 'out of memory') });
    expect(fake.toast).toHaveBeenCalledTimes(1);
    expect(fake.toast.mock.calls[0]?.[0]).toMatchObject({ status: 'error', description: 'out of memory' });
    expect(useRichRun.getState().running).toEqual({});
    expect(current(layer.id)?.rich).toBeUndefined();
    await flush();
    expect(fake.backend.deleteImages).toHaveBeenCalled();
  });

  it(
    'counts a canceled item as over without a report, and ignores items that are not its own',
    { tags: ['state-transition', 'condition'] },
    async () => {
      selectText();
      const request = await buildSelectedRich(false);
      attachRich([item(1, 'pending')], request);
      emit({ type: 'queue_item_status_changed', item: item(9, 'failed', 'someone else') });
      emit({ type: 'image_added', image: picture('other.png'), item: item(9) });
      emit({ type: 'image_added', image: picture('plain.png'), item: null });
      expect(fake.toast).not.toHaveBeenCalled();
      expect(useRichRun.getState().running).not.toEqual({});
      emit({ type: 'queue_item_status_changed', item: item(1, 'canceled') });
      expect(fake.toast).not.toHaveBeenCalled();
      expect(useRichRun.getState().running).toEqual({});
    },
  );

  it('on a cleared queue ends only the items that are no longer waiting', { tags: ['state-transition'] }, async () => {
    selectText();
    const request = await buildSelectedRich(false);
    attachRich([item(1, 'pending'), item(2, 'pending')], request);
    fake.state.queue = [item(2, 'pending')];
    emit({ type: 'queue_cleared' });
    expect(Object.values(useRichRun.getState().running)[0]).toEqual({ done: 1, total: 2 });
    fake.state.queue = [];
    emit({ type: 'queue_cleared' });
    expect(useRichRun.getState().running).toEqual({});
  });

  it(
    'drops a picture that arrives after the layer is gone, deletes it and cancels what still waits',
    { tags: ['error-guessing'] },
    async () => {
      const layer = selectText();
      const request = await buildSelectedRich(false);
      attachRich([item(1, 'pending'), item(2, 'pending')], request);
      useTextEditor.setState({ scene: EMPTY_SCENE, selectedId: null });
      emit({ type: 'image_added', image: picture('late.png'), item: item(1) });
      await flush();
      expect(current(layer.id)).toBeUndefined();
      expect(fake.backend.deleteImages.mock.calls.flatMap((c) => c[0] as string[])).toContain('up3.png');
      expect(fake.backend.cancelQueueItem).toHaveBeenCalledWith(2);
      emit({ type: 'image_added', image: picture('later.png'), item: item(2) });
      await flush();
      expect(fake.backend.uploadImage).toHaveBeenCalledTimes(3);
    },
  );

  it('reports a picture that cannot be stored and goes on', { tags: ['error-guessing'] }, async () => {
    const layer = selectText();
    const request = await buildSelectedRich(false);
    attachRich([item(1, 'pending')], request);
    fake.state.uploadFailsAt = 3;
    emit({ type: 'image_added', image: picture('r1.png'), item: item(1) });
    await flush();
    expect(fake.toast).toHaveBeenCalledTimes(1);
    expect(current(layer.id)?.rich).toBeUndefined();
    expect(useRichRun.getState().running).toEqual({});
  });
});

describe('what cannot start or is refused', () => {
  it('says there is nothing to paint when no text layer is selected', { tags: ['condition'] }, async () => {
    useTextEditor.setState({ scene: EMPTY_SCENE, selectedId: null });
    await expect(buildSelectedRich(false)).rejects.toThrow();
  });

  it('cleans up the pictures already made when a later step of the build fails', { tags: ['error-guessing'] }, async () => {
    selectText();
    fake.state.uploadFailsAt = 2;
    await expect(buildSelectedRich(false)).rejects.toThrow('upload refused');
    expect(fake.backend.deleteImages).toHaveBeenCalledWith(['up1.png']);
    expect(fake.state.listener).toBeNull();
  });

  it('a queue that refuses the batch leaves nothing behind and shows a toast', { tags: ['error-guessing'] }, async () => {
    const layer = selectText();
    fake.state.enqueueFails = true;
    await runRich(layer.id);
    expect(fake.toast).toHaveBeenCalledTimes(1);
    expect(fake.backend.deleteImages).toHaveBeenCalledWith(['up1.png', 'up2.png']);
    expect(fake.state.listener).toBeNull();
    expect(useRichRun.getState().running).toEqual({});
  });

  it('runRich queues a batch for the layer and follows it', { tags: ['scenario'] }, async () => {
    const layer = selectText();
    await runRich(layer.id);
    expect(fake.backend.enqueue).toHaveBeenCalledTimes(1);
    expect(useRichRun.getState().running[layer.id]).toEqual({ done: 0, total: 2 });
  });

  it('dropRich and attachRich ignore a request that is not a run of its own', { tags: ['error-guessing'] }, () => {
    const stranger = {} as never;
    dropRich(stranger);
    attachRich([item(1)], stranger);
    expect(useRichRun.getState().running).toEqual({});
  });
});
