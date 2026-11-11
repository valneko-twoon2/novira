// @vitest-environment jsdom
// The mock tells the pages what changed in the gallery, the models and the workflow library, as the backend does
// (`boards_changed`, `images_changed`, `models_changed`, `workflows_changed`).
import { describe, expect, it, vi } from 'vitest';
import type { BackendEvent } from '../types';
import { MockBackend } from './MockBackend';

vi.mock('./imageSynth', async (original) => ({
  ...(await original<typeof import('./imageSynth')>()),
  imageSize: vi.fn(async () => ({ width: 64, height: 48 })),
}));

/** A started mock and the events it sends from now on. */
async function started() {
  const backend = new MockBackend('default');
  const boot = await backend.bootstrap();
  const events: BackendEvent[] = [];
  backend.subscribe((e) => events.push(e));
  return { backend, boot, events };
}

const of = <T extends BackendEvent['type']>(events: BackendEvent[], type: T) => events.filter((e): e is Extract<BackendEvent, { type: T }> => e.type === type);

describe('mock backend: change events', { tags: [] }, () => {
  it('tells the whole board list after a board is made, renamed and deleted', { tags: ['scenario'] }, async () => {
    const { backend, events } = await started();
    const made = await backend.createBoard('Fresh');
    expect(of(events, 'boards_changed').at(-1)?.boards.some((b) => b.id === made.id && b.name === 'Fresh')).toBe(true);
    await backend.updateBoard(made.id, { name: 'Renamed' });
    expect(of(events, 'boards_changed').at(-1)?.boards.find((b) => b.id === made.id)?.name).toBe('Renamed');
    await backend.deleteBoard(made.id, false);
    expect(of(events, 'boards_changed').at(-1)?.boards.some((b) => b.id === made.id)).toBe(false);
  });

  it('tells which pictures changed, left and came back', { tags: ['scenario', 'state-transition'] }, async () => {
    const { backend, boot, events } = await started();
    const name = boot.images[0]!.name;
    await backend.updateImages([name], { starred: true });
    expect(of(events, 'images_changed').at(-1)).toMatchObject({ images: [{ name, starred: true }], removed: [] });
    await backend.deleteImages([name, 'not-there.png']);
    expect(of(events, 'images_changed').at(-1)).toEqual({ type: 'images_changed', images: [], removed: [name] });
    await backend.restoreImages([name]);
    expect(of(events, 'images_changed').at(-1)).toMatchObject({ images: [{ name }], removed: [] });
  });

  it('tells nothing when nothing in the gallery changed', { tags: ['condition', 'boundary'] }, async () => {
    const { backend, events } = await started();
    await backend.updateImages(['not-there.png'], { starred: true });
    await backend.deleteImages(['not-there.png']);
    await backend.restoreImages(['not-there.png']);
    expect(of(events, 'images_changed')).toEqual([]);
  });

  it("tells where a deleted board's pictures went", { tags: ['condition'] }, async () => {
    const { backend, boot, events } = await started();
    const withPictures = boot.boards.find((b) => boot.images.some((i) => i.boardId === b.id))!;
    const names = boot.images.filter((i) => i.boardId === withPictures.id).map((i) => i.name);
    await backend.deleteBoard(withPictures.id, true);
    expect(of(events, 'images_changed').at(-1)).toEqual({ type: 'images_changed', images: [], removed: names });
  });

  it(
    'tells the models after one is edited or removed, and the library after a workflow is saved or deleted',
    { tags: ['scenario'] },
    async () => {
      const { backend, boot, events } = await started();
      const key = boot.models[0]!.key;
      await backend.updateModel(key, { name: 'Edited' });
      expect(of(events, 'models_changed').at(-1)?.models.find((m) => m.key === key)?.name).toBe('Edited');
      await backend.deleteModel(key);
      expect(of(events, 'models_changed').at(-1)?.models.some((m) => m.key === key)).toBe(false);
      const saved = await backend.saveWorkflow({ name: 'Mine', description: '', author: '', tags: [], graph: {} });
      expect(of(events, 'workflows_changed').at(-1)?.workflows.some((w) => w.id === saved.id)).toBe(true);
      await backend.deleteWorkflow(saved.id);
      expect(of(events, 'workflows_changed').at(-1)?.workflows.some((w) => w.id === saved.id)).toBe(false);
    },
  );
});
