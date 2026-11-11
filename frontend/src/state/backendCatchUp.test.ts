// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackendEvent, BoardDTO, ImageDTO, ModelConfig, SavedWorkflow } from '@/backend';

const fake = vi.hoisted(() => ({
  kind: 'http' as 'http' | 'tauri' | 'mock',
  listeners: new Set<(e: unknown) => void>(),
  bootstrap: vi.fn(),
}));
vi.mock('@/backend', () => ({
  backend: {
    get kind() {
      return fake.kind;
    },
    subscribe: (l: (e: unknown) => void) => {
      fake.listeners.add(l);
      return () => fake.listeners.delete(l);
    },
    bootstrap: fake.bootstrap,
  },
}));

const { applyCatchUp, catchUp, watchForMissedEvents } = await import('./backendCatchUp');
const { useGallery } = await import('./gallery');
const { useModels } = await import('./models');
const { useWorkflows } = await import('./workflows/workflows');

const image = (name: string, over: Partial<ImageDTO> = {}): ImageDTO =>
  ({ name, url: name, thumbnailUrl: name, width: 8, height: 8, createdAt: 0, boardId: null, starred: false, isIntermediate: false, category: 'general', metadata: null, workflow: null, ...over }) as ImageDTO;
const board = (id: string): BoardDTO => ({ id, name: id, archived: false, createdAt: 0 });
const data = (over: Partial<{ boards: BoardDTO[]; images: ImageDTO[]; models: ModelConfig[]; workflows: SavedWorkflow[] }> = {}) => ({
  boards: [],
  images: [],
  models: [],
  workflows: [],
  ...over,
});
const send = (e: BackendEvent) => fake.listeners.forEach((l) => l(e));

beforeEach(() => {
  fake.kind = 'http';
  fake.listeners.clear();
  fake.bootstrap.mockReset();
  useGallery.setState({ images: [], boards: [], selectedBoardId: 'none', autoAddBoardId: 'none', selection: [] });
  useModels.setState({ models: [], selectedKey: null });
  useWorkflows.setState({ library: [] });
});

describe('applyCatchUp', () => {
  it("takes the backend's lists and drops the pictures it no longer has", { tags: ['condition'] }, () => {
    useGallery.setState({ images: [image('gone'), image('kept')], boards: [board('old')], selectedBoardId: 'old' });
    applyCatchUp(data({ boards: [board('new')], images: [image('kept', { starred: true }), image('fresh')], models: [{ key: 'm' } as ModelConfig] }), new Set(['gone', 'kept']));
    const g = useGallery.getState();
    expect(g.images.map((i) => i.name).sort()).toEqual(['fresh', 'kept']);
    expect(g.images.find((i) => i.name === 'kept')?.starred).toBe(true);
    expect(g.boards.map((b) => b.id)).toEqual(['new']);
    expect(g.selectedBoardId).toBe('none');
    expect(useModels.getState().models.map((m) => m.key)).toEqual(['m']);
  });

  it('keeps a picture that arrived while the backend was being read', { tags: ['condition'] }, () => {
    useGallery.setState({ images: [image('arrived'), image('old')] });
    applyCatchUp(data({ images: [image('old')] }), new Set(['old']));
    expect(useGallery.getState().images.map((i) => i.name).sort()).toEqual(['arrived', 'old']);
  });
});

describe('catchUp', () => {
  it('reads once at a time, and once more when asked during a read', { tags: ['condition'] }, async () => {
    let finish: (v: unknown) => void = () => undefined;
    fake.bootstrap.mockImplementationOnce(() => new Promise((r) => (finish = r))).mockResolvedValue(data());
    const first = catchUp();
    void catchUp();
    void catchUp();
    finish(data());
    await first;
    expect(fake.bootstrap).toHaveBeenCalledTimes(2);
  });

  it('logs a failed read and leaves the stores as they were', { tags: ['error-guessing'] }, async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    useGallery.setState({ images: [image('a')] });
    fake.bootstrap.mockRejectedValue(new Error('offline'));
    await catchUp();
    expect(useGallery.getState().images.map((i) => i.name)).toEqual(['a']);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('watchForMissedEvents', () => {
  it('reads again on a page over the network when its socket reopens or it is shown again', { tags: ['scenario'] }, async () => {
    fake.bootstrap.mockResolvedValue(data());
    const stop = watchForMissedEvents();
    send({ type: 'queue_cleared' });
    await vi.waitFor(() => expect(fake.bootstrap).toHaveBeenCalledTimes(1));
    // Hidden, nothing is read; shown again, it reads.
    const shown = (state: DocumentVisibilityState) => {
      Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    shown('hidden');
    await Promise.resolve();
    expect(fake.bootstrap).toHaveBeenCalledTimes(1);
    shown('visible');
    await vi.waitFor(() => expect(fake.bootstrap).toHaveBeenCalledTimes(2));
    stop();
    send({ type: 'queue_cleared' });
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(fake.bootstrap).toHaveBeenCalledTimes(2);
  });

  it('does nothing in the desktop app, which hears every event', { tags: ['equivalence'] }, () => {
    fake.kind = 'tauri';
    watchForMissedEvents();
    send({ type: 'queue_cleared' });
    expect(fake.listeners.size).toBe(0);
    expect(fake.bootstrap).not.toHaveBeenCalled();
  });
});
