import { afterEach, describe, expect, it, vi } from 'vitest';
import { backend, type BoardDTO, type Packs } from '@/backend';
import { useGallery } from './gallery';
import { useQueue } from './queue';
import { useWorkflows } from './workflows/workflows';
import { startBackend } from './wiring';

type BootstrapData = Awaited<ReturnType<typeof backend.bootstrap>>;

const board: BoardDTO = { id: 'b1', name: 'b1', archived: false, createdAt: 0 };

const data = (): BootstrapData => ({
  models: [],
  boards: [board],
  images: [],
  workflows: [],
  engine: { state: 'ready' } as BootstrapData['engine'],
  packs: {} as Packs,
});

afterEach(() => vi.restoreAllMocks());

describe('startBackend', () => {
  it(
    'lets every caller wait for the same start-up, so a repeated call does not resolve before the data is loaded, and fills the queue',
    { tags: ['scenario'] },
    async () => {
      let finish: (d: BootstrapData) => void = () => undefined;
      const bootstrap = vi.spyOn(backend, 'bootstrap').mockImplementation(() => new Promise<BootstrapData>((resolve) => (finish = resolve)));

      // StrictMode runs the start-up effect twice: both calls must settle only after bootstrap has finished.
      const settled: string[] = [];
      const first = startBackend().then(() => settled.push('first'));
      const second = startBackend().then(() => settled.push('second'));
      await new Promise((r) => setTimeout(r, 0));
      expect(settled).toEqual([]);
      expect(bootstrap).toHaveBeenCalledTimes(1);

      // A job another window (the PC, when this is a phone) is running already is in the queue from the start.
      const running = { id: 4, status: 'in_progress' } as ReturnType<typeof backend.listQueue>[number];
      vi.spyOn(backend, 'listQueue').mockReturnValue([running]);
      finish(data());
      await Promise.all([first, second]);
      expect(useQueue.getState().items).toEqual([running]);
      expect(settled.sort()).toEqual(['first', 'second']);
      expect(useGallery.getState().boards).toEqual([board]);
      expect(useWorkflows.getState().library).toEqual([]);

      // Later calls reuse the finished start-up instead of bootstrapping again.
      await startBackend();
      expect(bootstrap).toHaveBeenCalledTimes(1);
    },
  );
});
