// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { BackendEvent, EnqueueRequest, GenerationMetadata, QueueItem } from '../types';
import { MockBackend, SEED_IMAGE_SPACING_MS } from './MockBackend';
import { MAX_SEED } from './random';
import { MOCK_PICTURES } from './mockPictures';
import { SEED_BOARDS, SEED_IMAGES, SEED_MODELS } from './seedData';

const MAX_COMIC_BYTES = 32 * 1024 * 1024;

// jsdom has no canvas: the picture is a URL made from what the generation was asked for, so equal inputs give an
// equal picture exactly when the backend hands the synthesizer equal inputs.
vi.mock('./imageSynth', async (original) => ({
  ...(await original<typeof import('./imageSynth')>()),
  synthesize: vi.fn(async (input: { width: number; height: number; seed: number; prompt: string }) => ({
    canvas: document.createElement('canvas'),
    url: `synth:${input.seed}:${input.width}x${input.height}:${input.prompt}`,
  })),
  progressPreview: vi.fn((_canvas: unknown, fraction: number, seed: number) => `preview:${seed}:${fraction}`),
  imageSize: vi.fn(async () => ({ width: 64, height: 48 })),
}));

const params = (over: Partial<GenerationMetadata> = {}): GenerationMetadata => ({
  generationMode: 'txt2img',
  positivePrompt: 'a red fox',
  negativePrompt: '',
  modelKey: 'main-juggernaut-xl',
  modelName: 'Juggernaut XL',
  vaeKey: null,
  seed: 1000,
  steps: 3,
  cfgScale: 7,
  cfgRescale: 0,
  scheduler: 'euler',
  width: 512,
  height: 512,
  clipSkip: 0,
  seamlessX: false,
  seamlessY: false,
  loras: [],
  ...over,
});

const request = (over: Partial<EnqueueRequest> = {}, p: Partial<GenerationMetadata> = {}): EnqueueRequest => ({
  origin: 'generate',
  destination: 'gallery',
  params: params(p),
  iterations: 1,
  randomizeSeed: false,
  prepend: false,
  boardId: null,
  ...over,
});

/** A mock backend with no step delay that records every event it sends. */
async function start(scenario: 'default' | 'empty' = 'empty') {
  const backend = new MockBackend(scenario);
  backend.setStepDelay(0);
  const events: BackendEvent[] = [];
  backend.subscribe((e) => events.push(e));
  const boot = await backend.bootstrap();
  const settled = (id: number) =>
    vi.waitFor(() => {
      const item = backend.listQueue().find((q) => q.id === id);
      if (!item || item.status === 'pending' || item.status === 'in_progress') throw new Error(`item ${id} not settled`);
      return item;
    });
  return { backend, events, boot, settled };
}

const statusesOf = (events: BackendEvent[], id: number) =>
  events.flatMap((e) => (e.type === 'queue_item_status_changed' && e.item.id === id ? [e.item.status] : []));



describe('mock backend: start-up', () => {
  it('starts with the sample boards and pictures by default', async () => {
    const { boot } = await start('default');
    expect(boot.boards.map((b) => b.id)).toEqual(SEED_BOARDS.map((b) => b.id));
    expect(boot.images).toHaveLength(SEED_IMAGES.length);
    expect(boot.engine).toEqual({ state: 'ready' });
    // Newest first, and each picture keeps the prompt and seed it was made from.
    const newest = boot.images[0]!;
    const lastSpec = SEED_IMAGES[SEED_IMAGES.length - 1]!;
    expect(newest.metadata).toMatchObject({ positivePrompt: lastSpec.prompt, seed: lastSpec.seed });
    expect(boot.images.every((i, k) => k === 0 || i.createdAt < boot.images[k - 1]!.createdAt)).toBe(true);
  });

  it('reports a mid-range graphics card, so the model recommendations show a mix of fits', async () => {
    const { backend } = await start('default');
    expect(await backend.hardwareInfo()).toEqual({ gpuName: 'Mock GPU', vramBytes: 12 * 1024 ** 3 });
  });

  it('spreads the sample pictures over several days, so the gallery date filter has something to show', async () => {
    const { boot } = await start('default');
    const times = boot.images.map((i) => i.createdAt);
    expect(times.every((t, k) => k === 0 || times[k - 1]! - t === SEED_IMAGE_SPACING_MS)).toBe(true);
    // Local calendar days, as the gallery's date filter sees them.
    const days = new Set(times.map((t) => new Date(t).toDateString()));
    expect(days.size).toBeGreaterThanOrEqual(3);
    expect(days.size).toBeLessThan(times.length);
  });

  it('starts with an empty gallery in the empty scenario but keeps models and workflows', async () => {
    const { boot } = await start('empty');
    expect(boot.boards).toEqual([]);
    expect(boot.images).toEqual([]);
    expect(boot.models.length).toBe(SEED_MODELS.length);
    expect(boot.workflows.length).toBeGreaterThan(0);
  });

  it('returns copies, so changing them does not change the backend', async () => {
    const backend = new MockBackend('default');
    const first = await backend.bootstrap();
    first.boards[0]!.name = 'changed';
    const board = await backend.updateBoard(first.boards[0]!.id, {});
    expect(board.name).toBe(SEED_BOARDS[0]!.name);
  });
});

describe('mock backend: generation', () => {
  it('runs an item through pending, in progress and completed with step progress and the image', async () => {
    const { backend, events, settled } = await start();
    const [item] = await backend.enqueue(request());
    const done = await settled(item!.id);
    expect(statusesOf(events, item!.id)).toEqual(['pending', 'in_progress', 'completed']);
    const steps = events.flatMap((e) => (e.type === 'invocation_progress' && e.progress.itemId === item!.id ? [e.progress.step] : []));
    expect(steps).toEqual([1, 2, 3]);
    const added = events.find((e) => e.type === 'image_added');
    expect(added?.type === 'image_added' && added.image.name).toBe(done.imageName);
    expect(added?.type === 'image_added' && added.item?.id).toBe(item!.id);
    expect(backend.queueStatus()).toMatchObject({ completed: 1, pending: 0, inProgress: 0, total: 1 });
  });

  it('records the sampling a newer family runs in place of the scheduler setting, as the backend does', async () => {
    const { backend, settled } = await start();
    const images = async () => (await backend.bootstrap()).images;
    const [flux] = await backend.enqueue(request({}, { modelKey: 'main-flux-schnell', scheduler: 'euler_a' }));
    await settled(flux!.id);
    expect((await images())[0]!.metadata).toMatchObject({ scheduler: 'euler_a', sampling: { sampler: 'euler', scheduler: 'simple' } });
    const [xl] = await backend.enqueue(request({}, { scheduler: 'euler_a', sampling: { sampler: 'euler', scheduler: 'simple' } }));
    await settled(xl!.id);
    expect((await images())[0]!.metadata?.sampling).toBeUndefined();
  });

  it('makes the same picture from the same seed and prompt', async () => {
    const a = await start();
    const b = await start();
    const [x] = await a.backend.enqueue(request());
    const [y] = await b.backend.enqueue(request());
    await a.settled(x!.id);
    await b.settled(y!.id);
    const url = (events: BackendEvent[]) => events.flatMap((e) => (e.type === 'image_added' ? [e.image.url] : []))[0];
    expect(url(a.events)).toBeDefined();
    expect(url(a.events)).toBe(url(b.events));

    const c = await start();
    const [z] = await c.backend.enqueue(request({}, { seed: 1001 }));
    await c.settled(z!.id);
    expect(url(c.events)).not.toBe(url(a.events));
  });

  it('varies the seed per iteration as seed + i, keeping MAX_SEED and wrapping after it', async () => {
    const { backend } = await start();
    await backend.pauseProcessor();
    const [single] = await backend.enqueue(request({}, { seed: MAX_SEED }));
    expect(single!.params.seed).toBe(MAX_SEED);
    const items = await backend.enqueue(request({ iterations: 3 }, { seed: MAX_SEED - 1 }));
    expect(items.map((i) => i.params.seed)).toEqual([MAX_SEED - 1, MAX_SEED, 0]);
    expect(new Set(items.map((i) => i.batchId)).size).toBe(1);
  });

  it('fails an item whose prompt contains [fail]', async () => {
    const { backend, events, settled } = await start();
    const [item] = await backend.enqueue(request({}, { positivePrompt: 'a cat [FAIL]' }));
    const done = await settled(item!.id);
    expect(done.status).toBe('failed');
    expect(done.error).toMatch(/failure/i);
    expect(done.imageName).toBeNull();
    expect(events.some((e) => e.type === 'image_added')).toBe(false);
  });

  it('fails an item whose prompt contains [oom] as out of memory, and other failures without a kind', async () => {
    const { backend, settled } = await start();
    const [oom] = await backend.enqueue(request({}, { positivePrompt: 'a cat [oom]' }));
    const done = await settled(oom!.id);
    expect(done.status).toBe('failed');
    expect(done.errorKind).toBe('out_of_memory');
    expect(done.error).toMatch(/out of memory/);
    const [other] = await backend.enqueue(request({}, { positivePrompt: '[fail]' }));
    expect((await settled(other!.id)).errorKind).toBeNull();
  });

  it('retries an item smaller with the same seed, and refuses sizes the backend would refuse', async () => {
    const { backend, settled } = await start();
    const [oom] = await backend.enqueue(request({}, { positivePrompt: '[oom]', seed: 42, width: 512, height: 768 }));
    await settled(oom!.id);
    await expect(backend.retryQueueItem(oom!.id, { width: 444, height: 664 })).rejects.toThrow(/multiples of 8/);
    await expect(backend.retryQueueItem(oom!.id, { width: 520, height: 664 })).rejects.toThrow(/size before/);
    const copy = await backend.retryQueueItem(oom!.id, { width: 440, height: 664 });
    expect(copy).toMatchObject({ params: { width: 440, height: 664, seed: 42, positivePrompt: '[oom]' }, errorKind: null });
    const [video] = await backend.enqueue(request({}, { generationMode: 'video', positivePrompt: '[oom]' }));
    await settled(video!.id);
    await expect(backend.retryQueueItem(video!.id, { width: 256, height: 256 })).rejects.toThrow(/made from a prompt/);
  });

  it('switches low-memory mode with a pretend restart, or waits for the next start while a job runs', async () => {
    const { backend, events } = await start();
    expect(await backend.lowMemoryMode()).toEqual({ enabled: false, ownedEngine: true, pendingRestart: false });
    expect(await backend.setLowMemoryMode(true)).toEqual({ enabled: true, ownedEngine: true, pendingRestart: false });
    expect(events.filter((e) => e.type === 'engine_status').map((e) => e.type === 'engine_status' && e.status.state)).toEqual(['starting', 'ready']);

    backend.setStepDelay(50);
    const [running] = await backend.enqueue(request({}, { steps: 20 }));
    await vi.waitFor(() => expect(backend.listQueue().find((q) => q.id === running!.id)?.status).toBe('in_progress'));
    expect(await backend.setLowMemoryMode(false)).toEqual({ enabled: false, ownedEngine: true, pendingRestart: true });
    await backend.cancelQueueItem(running!.id);
    await backend.restartEngine();
    expect((await backend.lowMemoryMode()).pendingRestart).toBe(false);
  });

  it('fails a voice item with nothing to read', async () => {
    const { backend, settled } = await start();
    const [item] = await backend.enqueue(request({}, { generationMode: 'voice', voice: { text: '  ' } as GenerationMetadata['voice'] }));
    const done = await settled(item!.id);
    expect(done.status).toBe('failed');
    expect(done.error).toMatch(/no text/i);
  });

  it('keeps drafts and canvas results out of the gallery', async () => {
    const { backend, events, settled } = await start();
    const [draft] = await backend.enqueue(request({ boardId: 'b1' }, { steps: 10, draftAt: 0.35 }));
    const [staged] = await backend.enqueue(request({ destination: 'canvas', boardId: 'b1' }));
    await settled(draft!.id);
    await settled(staged!.id);
    const images = events.flatMap((e) => (e.type === 'image_added' ? [e.image] : []));
    expect(images.map((i) => [i.isIntermediate, i.boardId])).toEqual([
      [true, 'b1'],
      [true, null],
    ]);
    // A draft stops early.
    const draftSteps = events.filter((e) => e.type === 'invocation_progress' && e.progress.itemId === draft!.id);
    expect(draftSteps.length).toBeLessThan(10);
  });

  it('keeps the guidance on the queue item and hands the mask to the picture', async () => {
    const { backend, events, settled } = await start();
    const control = { imageUrl: 'blob:c', modelKey: 'cn', weight: 0.75, beginEnd: [0, 0.75] as [number, number], controlMode: 'balanced' as const };
    const reference = { imageUrl: 'blob:r', modelKey: 'ipa', clipVisionModel: 'ViT-H' as const, weight: 0.5, beginEnd: [0, 1] as [number, number], method: 'style' as const };
    const [item] = await backend.enqueue(
      request({ initImageUrl: 'blob:src', maskImageUrl: 'blob:mask', controlLayers: [control], refImages: [reference] }, { generationMode: 'inpaint', controlLayerCount: 1, refImageCount: 1 }),
    );
    expect(item).toMatchObject({ maskImageUrl: 'blob:mask', controlLayers: [control], refImages: [reference] });
    // The picture remembers its guidance (the desktop backend does the same), so it can be derived again.
    expect(item!.params).toMatchObject({ controlLayers: [control], refImages: [reference] });
    await settled(item!.id);
    const added = events.flatMap((e) => (e.type === 'image_added' ? [e.image] : [])).at(-1);
    expect(MOCK_PICTURES).toContain(added!.url);
    const [plain] = await backend.enqueue(request());
    expect(plain).toMatchObject({ maskImageUrl: null, controlLayers: [], refImages: [] });
    expect(plain!.params.refImages).toBeUndefined();
  });

  it('refuses the guidance the desktop backend refuses', async () => {
    const { backend } = await start();
    const control = { imageUrl: 'blob:c', modelKey: 'cn', weight: 0.75, beginEnd: [0, 0.75] as [number, number], controlMode: 'balanced' as const };
    await expect(backend.enqueue(request({ initImageUrl: 'blob:src' }, { generationMode: 'inpaint' }))).rejects.toThrow(/need a mask/);
    await expect(backend.enqueue(request({ maskImageUrl: 'blob:m' }))).rejects.toThrow(/only used for inpaint/);
    await expect(backend.enqueue(request({ controlLayers: Array(9).fill(control) }, { controlLayerCount: 9 }))).rejects.toThrow(/At most 8/);
    await expect(backend.enqueue(request({ controlLayers: [control] }))).rejects.toThrow(/count/);
    await expect(backend.enqueue(request({ controlLayers: [{ ...control, beginEnd: [0.8, 0.2] }] }, { controlLayerCount: 1 }))).rejects.toThrow(/begin and end/);
    await expect(backend.enqueue(request({ controlLayers: [{ ...control, weight: -1 }] }, { controlLayerCount: 1 }))).rejects.toThrow(/weight/);
    await expect(backend.enqueue(request({ controlLayers: [control] }, { generationMode: 'video', controlLayerCount: 1 }))).rejects.toThrow(/image generation/);
    // Regional layers: their count, a region, a prompt.
    const region = { imageUrl: 'blob:r', positivePrompt: 'a hat', negativePrompt: null, autoNegative: false };
    await expect(backend.enqueue(request({ regionalLayers: [region] }))).rejects.toThrow(/regional guidance count/);
    await expect(backend.enqueue(request({ regionalLayers: [{ ...region, positivePrompt: ' ' }] }, { regionalGuidanceCount: 1 }))).rejects.toThrow(/no prompt/);
    await expect(backend.enqueue(request({ regionalLayers: [{ ...region, imageUrl: '' }] }, { regionalGuidanceCount: 1 }))).rejects.toThrow(/region is missing/);
    await expect(backend.enqueue(request({ regionalLayers: Array(9).fill(region) }, { regionalGuidanceCount: 9 }))).rejects.toThrow(/At most 8/);
    // Pictures given to the model as references: at most four, each a picture.
    await expect(backend.enqueue(request({ referencePictures: Array(5).fill('blob:p') }))).rejects.toThrow(/At most 4 reference pictures/);
    await expect(backend.enqueue(request({ referencePictures: [''] }))).rejects.toThrow(/Reference picture 1/);
    await expect(backend.enqueue(request({ referencePictures: ['blob:p'] }, { generationMode: 'video' }))).rejects.toThrow(/image generation/);
    expect(backend.listQueue()).toEqual([]);
  });

  it('keeps the regional layers on the queue item and the picture', async () => {
    const { backend } = await start();
    const region = { imageUrl: 'blob:r', positivePrompt: 'a hat', negativePrompt: 'blur', autoNegative: true };
    const [item] = await backend.enqueue(request({ regionalLayers: [region] }, { regionalGuidanceCount: 1 }));
    expect(item).toMatchObject({ regionalLayers: [region] });
    expect(item!.params).toMatchObject({ regionalLayers: [region], regionalGuidanceCount: 1 });
    const [plain] = await backend.enqueue(request());
    expect(plain).toMatchObject({ regionalLayers: [] });
    expect(plain!.params.regionalLayers).toBeUndefined();
  });

  it('scales the picture of an upscale', async () => {
    const { backend, events, settled } = await start();
    const [item] = await backend.enqueue(request({}, { generationMode: 'upscale', upscaleScale: 4, width: 100, height: 50 }));
    await settled(item!.id);
    const image = events.flatMap((e) => (e.type === 'image_added' ? [e.image] : []))[0]!;
    expect([image.width, image.height]).toEqual([400, 200]);
  });

  it('enlarges a picture with the high-resolution fix, counts both passes and keeps the first size in its settings', async () => {
    const { backend, events, settled } = await start();
    const hiresFix = { scale: 1.5, strength: 0.45, steps: 2 };
    const [item] = await backend.enqueue(request({}, { width: 512, height: 680, hiresFix }));
    await settled(item!.id);
    const image = events.flatMap((e) => (e.type === 'image_added' ? [e.image] : []))[0]!;
    // 680 x 1.5 = 1020, snapped to 1024 like the backend.
    expect([image.width, image.height]).toEqual([768, 1024]);
    expect(image.metadata).toMatchObject({ width: 512, height: 680, hiresFix });
    const totals = events.flatMap((e) => (e.type === 'invocation_progress' && e.progress.itemId === item!.id ? [e.progress.totalSteps] : []));
    expect(new Set(totals)).toEqual(new Set([5]));
  });

  it('enlarges a picture drawn over a source with the high-resolution fix', async () => {
    const { backend, events, settled } = await start();
    const [item] = await backend.enqueue(request({}, { generationMode: 'img2img', strength: 0.6, width: 512, height: 512, hiresFix: { scale: 1.5, strength: 0.45 } }));
    expect((await settled(item!.id)).status).toBe('completed');
    const image = events.flatMap((e) => (e.type === 'image_added' ? [e.image] : []))[0]!;
    expect([image.width, image.height]).toEqual([768, 768]);
  });

  it('refuses the high-resolution fix outside text and image to image', async () => {
    const { backend, settled } = await start();
    const [item] = await backend.enqueue(request({}, { generationMode: 'upscale', hiresFix: { scale: 1.5, strength: 0.45 } }));
    const done = await settled(item!.id);
    expect([done.status, done.error]).toEqual(['failed', 'The high-resolution fix is only available for text to image and image to image']);
  });
});

describe('mock backend: queue control', () => {
  it('holds items while paused and runs them after resuming', async () => {
    const { backend, events, settled } = await start();
    await backend.pauseProcessor();
    const [item] = await backend.enqueue(request());
    expect(backend.queueStatus()).toMatchObject({ pending: 1, isPaused: true });
    await backend.resumeProcessor();
    expect((await settled(item!.id)).status).toBe('completed');
    expect(events.filter((e) => e.type === 'processor_state').map((e) => e.type === 'processor_state' && e.isPaused)).toEqual([true, false]);
  });

  it('puts a prepended batch before the waiting items', async () => {
    const { backend } = await start();
    await backend.pauseProcessor();
    const [a] = await backend.enqueue(request());
    const [b] = await backend.enqueue(request());
    const [front] = await backend.enqueue(request({ prepend: true }));
    expect(backend.listQueue().map((q) => q.id)).toEqual([front!.id, a!.id, b!.id]);
  });

  it('cancels a waiting item and a whole batch, and ignores finished ones', async () => {
    const { backend } = await start();
    await backend.pauseProcessor();
    const [one] = await backend.enqueue(request());
    const batch = await backend.enqueue(request({ iterations: 2 }));
    await backend.cancelQueueItem(one!.id);
    await backend.cancelBatch(batch[0]!.batchId);
    expect(backend.listQueue().map((q) => q.status)).toEqual(['canceled', 'canceled', 'canceled']);
    // Cancelling again changes nothing.
    await backend.cancelQueueItem(one!.id);
    expect(backend.queueStatus()).toMatchObject({ canceled: 3, total: 3 });
  });

  it('cancels the running item without producing an image', async () => {
    const { backend, events } = await start();
    backend.setStepDelay(20);
    const [item] = await backend.enqueue(request({}, { steps: 50 }));
    await vi.waitFor(() => expect(backend.listQueue()[0]!.status).toBe('in_progress'));
    await backend.cancelQueueItem(item!.id);
    await new Promise((r) => setTimeout(r, 60));
    expect(backend.listQueue()[0]!.status).toBe('canceled');
    expect(events.some((e) => e.type === 'image_added')).toBe(false);
  });

  it('retries a failed item with the same seed and refuses to retry a completed one', async () => {
    const { backend, settled } = await start();
    const [bad] = await backend.enqueue(request({}, { positivePrompt: '[fail]', seed: 77 }));
    await settled(bad!.id);
    const copy = await backend.retryQueueItem(bad!.id);
    expect(copy).toMatchObject({ params: { seed: 77 } });
    expect(['pending', 'in_progress']).toContain(copy!.status);
    expect(copy!.id).not.toBe(bad!.id);

    const [good] = await backend.enqueue(request());
    await settled(good!.id);
    expect(await backend.retryQueueItem(good!.id)).toBeNull();
  });

  it('prunes finished items but keeps waiting ones, and clears everything', async () => {
    const { backend, settled } = await start();
    const [done] = await backend.enqueue(request());
    await settled(done!.id);
    await backend.pauseProcessor();
    const [waiting] = await backend.enqueue(request());
    await backend.pruneQueue();
    expect(backend.listQueue().map((q: QueueItem) => q.id)).toEqual([waiting!.id]);
    await backend.clearQueue();
    expect(backend.queueStatus().total).toBe(0);
  });

  it('refuses to restart the engine while a job is running', async () => {
    const { backend } = await start();
    backend.setStepDelay(20);
    const [item] = await backend.enqueue(request({}, { steps: 50 }));
    await vi.waitFor(() => expect(backend.listQueue()[0]!.status).toBe('in_progress'));
    await expect(backend.restartEngine()).rejects.toThrow(/running/);
    await backend.cancelQueueItem(item!.id);
  });
});

describe('mock backend: boards and images', () => {
  it('creates, renames and archives boards', async () => {
    const { backend } = await start();
    const board = await backend.createBoard('Cats');
    expect(board).toMatchObject({ name: 'Cats', archived: false });
    expect(await backend.updateBoard(board.id, { name: 'Dogs', archived: true })).toMatchObject({ id: board.id, name: 'Dogs', archived: true });
    await expect(backend.updateBoard('missing', { name: 'x' })).rejects.toThrow(/not found/);
  });

  it('trims board names and rejects blank ones on create and rename, like the real backend', async () => {
    const { backend } = await start();
    const board = await backend.createBoard('  Cats  ');
    expect(board.name).toBe('Cats');
    await expect(backend.createBoard('   ')).rejects.toThrow(/empty/);
    expect(await backend.updateBoard(board.id, { name: '  Dogs  ' })).toMatchObject({ name: 'Dogs' });
    await expect(backend.updateBoard(board.id, { name: '  ', archived: true })).rejects.toThrow(/empty/);
    const boards = (await backend.bootstrap()).boards;
    expect(boards.find((b) => b.id === board.id)).toMatchObject({ name: 'Dogs', archived: false });
  });

  it('deleting a board either deletes its images or moves them to Uncategorized', async () => {
    const { backend } = await start();
    const keep = await backend.createBoard('keep');
    const drop = await backend.createBoard('drop');
    const a = await backend.saveImageFromUrl('blob:a', { boardId: keep.id });
    const b = await backend.saveImageFromUrl('blob:b', { boardId: drop.id });

    expect(await backend.deleteBoard(keep.id, false)).toEqual({ deletedImages: [] });
    expect(await backend.deleteBoard(drop.id, true)).toEqual({ deletedImages: [b.name] });
    // Image a survives without a board; image b is gone.
    const moved = await backend.updateImages([a.name, b.name], {});
    expect(moved.map((i) => [i.name, i.boardId])).toEqual([[a.name, null]]);
  });

  it('saves an image, announces it, and updates or deletes it by name', async () => {
    const { backend, events } = await start();
    const image = await backend.saveImageFromUrl('blob:x', { boardId: null, category: 'user' });
    expect(image).toMatchObject({ width: 64, height: 48, category: 'user', isIntermediate: false, starred: false });
    expect(events.some((e) => e.type === 'image_added' && e.image.name === image.name && e.item === null)).toBe(true);

    const [starred] = await backend.updateImages([image.name], { starred: true, boardId: 'b' });
    expect(starred).toMatchObject({ starred: true, boardId: 'b' });
    await backend.deleteImages([image.name]);
    expect(await backend.updateImages([image.name], { starred: false })).toEqual([]);
  });

  it('gives every image a unique name', async () => {
    const { backend } = await start();
    const names = new Set<string>();
    for (let i = 0; i < 5; i++) names.add((await backend.saveImageFromUrl(`blob:${i}`, { boardId: null })).name);
    expect(names.size).toBe(5);
  });
});

describe('mock backend: models, workflows and packs', () => {
  it('refuses the unfinished download paths the backend refuses, before deleting any', async () => {
    const { backend } = await start();
    await expect(backend.deleteUnfinishedDownloads(['../outside', 'x'.repeat(512)])).resolves.toEqual([]);
    for (const bad of [[''], ['a\u0007b'], ['x'.repeat(513)], ['あ'.repeat(171)], Array.from({ length: 1001 }, (_, i) => `p${i}`)]) {
      await expect(backend.deleteUnfinishedDownloads(bad), String(bad[0]).slice(0, 10)).rejects.toThrow();
    }
    await expect(backend.deleteUnfinishedDownloads(Array.from({ length: 1000 }, (_, i) => `p${i}`))).resolves.toEqual([]);
  });

  it("offers every node of ComfyUI's own, in ComfyUI's order, with the hand-made ones in their place and no file names", async () => {
    const { backend } = await start();
    const defs = await backend.nodeDefs();
    const core = Object.entries(defs).filter(([, d]) => /^(nodes|comfy_extras)(\.|$)/.test(d.python_module ?? ''));
    expect(core.length).toBeGreaterThan(600);
    const names = Object.keys(defs);
    expect(names.indexOf('KSampler')).toBeLessThan(names.indexOf('SaveVideo'));
    // The hand-made definition (its model list holds the mock's files) wins over the read one.
    expect(JSON.stringify(defs.CheckpointLoaderSimple)).toBe(JSON.stringify((await import('./comfyCoreDefs')).CORE_NODE_DEFS.CheckpointLoaderSimple));
    expect(await backend.comfyUiLocale()).toBeNull();
  });

  it('reports an install from a bad source as an error', async () => {
    const { backend, events } = await start();
    const job = await backend.installModel('this-will-fail');
    expect(job.status).toBe('waiting');
    await vi.waitFor(() => {
      const last = events.filter((e) => e.type === 'model_install').at(-1);
      expect(last?.type === 'model_install' && last.job.status).toBe('error');
    });
    expect(events.some((e) => e.type === 'model_added')).toBe(false);
  });

  it('names an install after the starter model or the last part of the source', async () => {
    const { backend } = await start();
    const job = await backend.installModel('C:\\models\\fancy-model.safetensors');
    expect(job.name).toBe('fancy-model.safetensors');
    await backend.cancelInstall(job.id);
  });

  it('updates and deletes models, keeping the key', async () => {
    const { backend, boot } = await start();
    const key = boot.models[0]!.key;
    expect(await backend.updateModel(key, { name: 'Renamed', key: 'hijack' })).toMatchObject({ key, name: 'Renamed' });
    await backend.deleteModel(key);
    await expect(backend.updateModel(key, { name: 'x' })).rejects.toThrow(/not found/);
  });

  it('saves a new user workflow, updates it in place and deletes it', async () => {
    const { backend } = await start();
    const saved = await backend.saveWorkflow({ name: 'Mine', description: '', author: '', tags: [], graph: {} });
    expect(saved).toMatchObject({ category: 'user', name: 'Mine' });
    const again = await backend.saveWorkflow({ id: saved.id, name: 'Mine 2', description: '', author: '', tags: [], graph: {} });
    expect(again.id).toBe(saved.id);
    // A default workflow is never overwritten: saving it makes a user copy.
    const copy = await backend.saveWorkflow({ id: 'default-t2i-sdxl', name: 'Copy', description: '', author: '', tags: [], graph: {} });
    expect(copy.id).not.toBe('default-t2i-sdxl');
    await backend.deleteWorkflow(saved.id);
    // Like the backend, the mock keeps only a workflow with a name and a graph that is an object.
    await expect(backend.saveWorkflow({ name: ' ', description: '', author: '', tags: [], graph: {} })).rejects.toThrow('name');
    await expect(backend.saveWorkflow({ name: 'x', description: '', author: '', tags: [], graph: null })).rejects.toThrow('graph');
  });

  it('keeps the saved canvas document in memory', async () => {
    const { backend } = await start();
    expect(await backend.loadCanvas()).toBeNull();
    await backend.saveCanvas('{"version":1}');
    expect(await backend.loadCanvas()).toBe('{"version":1}');
  });

  it('hands the screen state over once, then answers with the saved one', async () => {
    const { backend } = await start();
    expect(await backend.adoptUiState(null)).toBeNull();
    expect(await backend.adoptUiState('{}')).toBeNull();
    expect(await backend.adoptUiState('{"novira.a":"1"}')).toBeNull();
    expect(await backend.adoptUiState(null)).toBe('{"novira.a":"1"}');
    await backend.saveUiState('{"novira.a":"2"}');
    expect(await backend.adoptUiState('{"novira.b":"x"}')).toBe('{"novira.a":"2"}');
  });

  it('keeps the saved comics oldest change first and refuses what the backend refuses', async () => {
    const { backend } = await start();
    expect(await backend.listComics()).toEqual([]);
    await backend.saveComic('comic-a', { title: 'A' });
    await backend.saveComic('comic-b', { title: 'B' });
    // Saving comic-a again makes it the newest, though its id sorts first: the order is by change, not by id.
    await backend.saveComic('comic-a', { title: 'A2' });
    const listed = await backend.listComics();
    expect(listed.map((c) => [c.id, c.document])).toEqual([
      ['comic-b', { title: 'B' }],
      ['comic-a', { title: 'A2' }],
    ]);
    for (const id of ['', 'a b', 'a/b', 'a.b', 'é', 'x'.repeat(65)]) {
      await expect(backend.saveComic(id, {})).rejects.toThrow(/comic id/);
    }
    await expect(backend.saveComic('comic-a', [1])).rejects.toThrow(/JSON object/);
    await expect(backend.saveComic('comic-a', null)).rejects.toThrow(/JSON object/);
    await expect(backend.saveComic('comic-a', 'text')).rejects.toThrow(/JSON object/);
    expect((await backend.listComics()).map((c) => c.document)).toEqual([{ title: 'B' }, { title: 'A2' }]);
  });

  it('measures the comic size cap on the JSON text, as the backend does', async () => {
    const { backend } = await start();
    // `{"x":"` and `"}` are 8 bytes around the string: this text is exactly the cap, the next byte over it.
    await backend.saveComic('big', { x: 'a'.repeat(MAX_COMIC_BYTES - 8) });
    await expect(backend.saveComic('big', { x: 'a'.repeat(MAX_COMIC_BYTES - 7) })).rejects.toThrow(/too large/);
    expect((await backend.listComics()).map((c) => c.document)).toEqual([{ x: 'a'.repeat(MAX_COMIC_BYTES - 8) }]);
  });

  it('deletes a saved comic and does nothing for one that is not there', async () => {
    const { backend } = await start();
    await backend.saveComic('comic-a', { title: 'A' });
    await backend.saveComic('comic-b', { title: 'B' });
    await backend.deleteComic('comic-a');
    await backend.deleteComic('missing');
    expect((await backend.listComics()).map((c) => c.id)).toEqual(['comic-b']);
  });

  it('keeps the comics across a reload in the storage it is given, and reads damaged storage as none', async () => {
    const kept = new Map<string, string>();
    const storage = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v) };
    const first = new MockBackend('empty', false, storage);
    await first.saveComic('comic-a', { title: 'A' });
    await first.saveComic('comic-b', { title: 'B' });
    await first.deleteComic('comic-b');
    const reloaded = new MockBackend('empty', false, storage);
    expect((await reloaded.listComics()).map((c) => [c.id, c.document])).toEqual([['comic-a', { title: 'A' }]]);
    kept.set('novira.mock.comics', '{not json');
    expect(await new MockBackend('empty', false, storage).listComics()).toEqual([]);
    expect(await new MockBackend('empty').listComics()).toEqual([]);
  });

  it('accepts only GitHub repository addresses for node packs', async () => {
    const { backend } = await start();
    await expect(backend.installNodePack('https://example.com/a/b')).rejects.toThrow(/GitHub/);
    await expect(backend.removeNodePack('NotInstalled')).rejects.toThrow(/not installed/);
  });

  it('remembers whether API keys are set, treating blank keys as unset', async () => {
    const { backend } = await start();
    await backend.setCivitaiKey('  ');
    expect(await backend.hasCivitaiKey()).toBe(false);
    await backend.setCivitaiKey('k');
    expect(await backend.hasCivitaiKey()).toBe(true);
    await backend.setHuggingFaceToken('t');
    await backend.setHuggingFaceToken(null);
    expect(await backend.hasHuggingFaceToken()).toBe(false);
  });
});
