// Property test for the backend event reducers: random event sequences go through the real wiring into the real
// stores (queue, gallery, models, packs, downloads, engine, developer log) and the invariants hold after every event.
// The backend is the in-memory mock with `subscribe` and `bootstrap` replaced; nothing leaves the process.
import fc from 'fast-check';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { backend, type BackendEvent, type ImageDTO, type ModelConfig, type Packs, type PackKind, type PackStatus, type QueueItem } from '@/backend';
import { blockExternalNetwork, check } from '@/propertyTest.testkit';
import { useDevLog, MAX_LOG_ENTRIES } from './devLog';
import { useDownloads } from './downloads';
import { useEngine } from './engine';
import { useGallery } from './gallery';
import { usePacks } from './media/packs';
import { useModels } from './models';
import { useNodePacks } from './comfy/nodePacks';
import { useQueue } from './queue';
import { startBackend } from './wiring';

type BootstrapData = Awaited<ReturnType<typeof backend.bootstrap>>;

blockExternalNetwork();

let emit: (e: BackendEvent) => void = () => undefined;

beforeAll(async () => {
  vi.spyOn(backend, 'subscribe').mockImplementation((listener) => {
    emit = listener;
    return () => undefined;
  });
  vi.spyOn(backend, 'bootstrap').mockResolvedValue({ models: [], boards: [], images: [], workflows: [], engine: { state: 'idle' }, packs: {} as Packs } as BootstrapData);
  await startBackend();
  vi.restoreAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 0, 1));
});

afterAll(() => vi.useRealTimers());
afterEach(() => vi.restoreAllMocks());

const KINDS: PackKind[] = ['video', 'turbo', 'music', 'voice', 'inpaint', 'logo'];
const URLS = ['https://github.com/a/one', 'https://github.com/a/two'];
const itemId = fc.integer({ min: 1, max: 6 });
const imageName = fc.integer({ min: 0, max: 8 }).map((n) => `img${n}`);

const queueItem = (id: number, status: QueueItem['status'], destination: QueueItem['destination'], origin: QueueItem['origin'], draft: boolean): QueueItem =>
  ({
    id,
    batchId: 'b',
    status,
    origin,
    destination,
    params: { generationMode: 'txt2img', ...(draft ? { draftAt: 0.4 } : {}) },
    boardId: null,
    initImageUrl: null,
    workflow: null,
    createdAt: 0,
    startedAt: null,
    completedAt: null,
    imageName: null,
    error: null,
  }) as unknown as QueueItem;

const packStatus: fc.Arbitrary<PackStatus> = fc.oneof(
  fc.integer({ min: 0, max: 1e9 }).map((totalBytes): PackStatus => ({ state: 'missing', totalBytes })),
  fc
    .record({ file: fc.constantFrom('a.bin', 'b.bin'), index: fc.integer({ min: 0, max: 2 }), count: fc.constant(3), bytes: fc.integer({ min: 0, max: 1e9 }), totalBytes: fc.integer({ min: 0, max: 1e9 }) })
    .map((r): PackStatus => ({ state: 'downloading', ...r })),
  fc.constantFrom<PackStatus>({ state: 'installing', step: 'pip' }, { state: 'ready' }, { state: 'error', message: 'boom' }),
);

const event: fc.Arbitrary<{ at: number; e: BackendEvent }> = fc
  .tuple(
    fc.integer({ min: 0, max: 3000 }),
    fc.oneof(
      fc
        .tuple(itemId, fc.constantFrom<QueueItem['status']>('pending', 'in_progress', 'completed', 'failed', 'canceled'), fc.constantFrom<QueueItem['destination']>('gallery', 'canvas', 'intermediate'), fc.constantFrom<QueueItem['origin']>('generate', 'canvas', 'upscaling', 'workflows'))
        .map(([id, status, dest, origin]) => ({ type: 'queue_item_status_changed' as const, item: queueItem(id, status, dest, origin, false) })),
      fc.constant({ type: 'queue_cleared' as const }),
      fc.boolean().map((isPaused) => ({ type: 'processor_state' as const, isPaused })),
      fc.tuple(itemId, fc.integer({ min: 0, max: 30 })).map(([id, step]) => ({
        type: 'invocation_progress' as const,
        progress: { itemId: id, step, totalSteps: 30, progressImageUrl: null, message: '' },
      })),
      fc
        .tuple(imageName, fc.option(fc.constantFrom<string | null>(null, 'b1'), { nil: null }), fc.constantFrom<ImageDTO['category']>('general', 'user'), fc.option(fc.tuple(itemId, fc.constantFrom<QueueItem['destination']>('gallery', 'canvas', 'intermediate'), fc.constantFrom<QueueItem['origin']>('generate', 'canvas'), fc.boolean()), { nil: null }))
        .map(([name, boardId, category, it]) => ({
          type: 'image_added' as const,
          image: { name, url: `blob:${name}`, thumbnailUrl: `blob:${name}`, width: 8, height: 8, createdAt: 0, boardId, starred: false, isIntermediate: false, category, metadata: null, workflow: null },
          item: it ? queueItem(it[0], 'completed', it[1], it[2], it[3]) : null,
        })),
      fc.tuple(fc.integer({ min: 0, max: 4 }), fc.constantFrom('waiting', 'downloading', 'running', 'completed', 'error', 'cancelled')).map(([n, status]) => ({
        type: 'model_install' as const,
        job: { id: `j${n}`, source: 's', name: 'n', status: status as 'waiting', bytes: 1, totalBytes: 2 },
      })),
      fc.integer({ min: 0, max: 4 }).map((n) => ({ type: 'model_added' as const, model: { key: `m${n}`, name: `M${n}`, type: 'main', base: 'sdxl' } as unknown as ModelConfig })),
      fc.constantFrom('idle', 'extracting', 'starting', 'ready').map((state) => ({ type: 'engine_status' as const, status: { state } as never })),
      fc.tuple(fc.constantFrom(...KINDS), packStatus).map(([kind, status]) => ({ type: 'pack' as const, kind, status })),
      fc.tuple(fc.constantFrom(...URLS), packStatus).map(([url, status]) => ({ type: 'node_pack' as const, url, status })),
      fc.string({ maxLength: 5000 }).map((message) => ({ type: 'log' as const, entry: { at: 1, level: 'info' as const, source: 'backend', message } })),
    ),
  )
  .map(([at, e]) => ({ at, e }));

describe('backend event reducers (properties)', () => {
  it('keep the stores consistent for any event sequence', () => {
    check(
      fc.property(fc.array(event, { maxLength: 60 }), (events) => {
        useQueue.setState({ items: [], progress: null });
        useGallery.setState({ images: [], selection: [], selectedBoardId: 'none' });
        useDownloads.setState({ entries: [] });
        useModels.setState({ models: [], installJobs: [] });
        useDevLog.setState({ entries: [] });
        const order: number[] = [];
        const lastPack = new Map<PackKind, PackStatus>();
        for (const { at, e } of events) {
          vi.setSystemTime(Date.now() + at);
          emit(e);
          const queue = useQueue.getState();
          if (e.type === 'queue_cleared') order.length = 0;
          if (e.type === 'queue_item_status_changed') {
            if (!order.includes(e.item.id)) order.push(e.item.id);
            expect(queue.items.find((i) => i.id === e.item.id)).toEqual(e.item);
            if (e.item.status !== 'in_progress') expect(queue.progress?.itemId).not.toBe(e.item.id);
          }
          const ids = queue.items.map((i) => i.id);
          expect(new Set(ids).size).toBe(ids.length);
          expect(ids).toEqual(order);
          const s = queue.status;
          for (const n of [s.pending, s.inProgress, s.completed, s.failed, s.canceled, s.total]) expect(n).toBeGreaterThanOrEqual(0);

          const gallery = useGallery.getState();
          const names = gallery.images.map((i) => i.name);
          expect(new Set(names).size).toBe(names.length);
          expect(gallery.selection.every((n) => names.includes(n))).toBe(true);
          expect(gallery.page).toBeGreaterThanOrEqual(0);

          const models = useModels.getState();
          expect(new Set(models.models.map((m) => m.key)).size).toBe(models.models.length);
          expect(new Set(models.installJobs.map((j) => j.id)).size).toBe(models.installJobs.length);

          if (e.type === 'pack') lastPack.set(e.kind, e.status);
          for (const [kind, status] of lastPack) expect(usePacks.getState().packs[kind]).toEqual(status);
          if (e.type === 'engine_status') expect(useEngine.getState().status).toEqual(e.status);
          if (e.type === 'node_pack') expect(useNodePacks.getState().jobs[e.url]).toBeTruthy();

          const entries = useDownloads.getState().entries;
          const keys = entries.map((d) => d.key);
          expect(new Set(keys).size).toBe(keys.length);
          for (const d of entries) {
            expect(d.status.state).not.toBe('missing');
            if (d.speed !== null && d.speed !== undefined) {
              expect(Number.isFinite(d.speed)).toBe(true);
              expect(d.speed).toBeGreaterThan(0);
            }
          }

          const log = useDevLog.getState().entries;
          expect(log.length).toBeLessThanOrEqual(MAX_LOG_ENTRIES);
          for (let k = 1; k < log.length; k++) expect(log[k]!.id).toBeGreaterThan(log[k - 1]!.id);
          expect(log.every((l) => l.message.length <= 4001)).toBe(true);
        }
      }),
      60,
    );
  });
});
