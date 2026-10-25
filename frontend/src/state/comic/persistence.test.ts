// The restore-and-save watcher keeps module state (it starts once), so every test loads fresh modules.
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { BackendClient, ComicRecord } from '@/backend';

type Modules = {
  backend: BackendClient;
  persistence: typeof import('./persistence');
  store: typeof import('./store');
  document: typeof import('./document');
};

let m: Modules;
let list: MockInstance<BackendClient['listComics']>;
let save: MockInstance<BackendClient['saveComic']>;
let remove: MockInstance<BackendClient['deleteComic']>;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const [{ backend }, persistence, store, document] = await Promise.all([
    import('@/backend'),
    import('./persistence'),
    import('./store'),
    import('./document'),
  ]);
  m = { backend, persistence, store, document };
  list = vi.spyOn(backend, 'listComics').mockResolvedValue([]);
  save = vi.spyOn(backend, 'saveComic').mockResolvedValue();
  remove = vi.spyOn(backend, 'deleteComic').mockResolvedValue();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const recordOf = (project: import('./document').ComicProject): ComicRecord => ({
  id: project.id,
  updatedAt: project.updatedAt,
  document: m.document.serializeComicProject(project),
});

describe('saving comic projects', () => {
  it('does not write anything when the saved projects cannot be read', async () => {
    list.mockRejectedValue(new Error('locked'));
    await m.persistence.restoreAndWatchComics();
    m.store.useComic.getState().setProjects([m.document.newProject('Lost')]);
    m.store.useComic.getState().createProject('New');
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('reads the saved projects into the store, newest first, and opens the first', async () => {
    const older = { ...m.document.newProject('Older'), updatedAt: 1 };
    const newer = { ...m.document.newProject('Newer'), updatedAt: 9 };
    list.mockResolvedValue([recordOf(older), recordOf(newer), { id: 'bad', updatedAt: 3, document: { version: m.document.COMIC_VERSION + 1 } }]);
    await m.persistence.restoreAndWatchComics();
    const s = m.store.useComic.getState();
    expect(s.projects.map((p) => p.name)).toEqual(['Newer', 'Older']);
    expect(s.activeProjectId).toBe(newer.id);
  });

  it('saves a changed project once, one second after the last change', async () => {
    const project = { ...m.document.newProject('Changed'), updatedAt: 1 };
    list.mockResolvedValue([recordOf(project)]);
    await m.persistence.restoreAndWatchComics();
    m.store.useComic.getState().renameProject(project.id, 'Renamed');
    m.store.useComic.getState().renameProject(project.id, 'Renamed again');
    await vi.advanceTimersByTimeAsync(999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledOnce();
    const [id, document] = save.mock.calls[0]!;
    expect(id).toBe(project.id);
    expect(document).toMatchObject({ version: m.document.COMIC_VERSION, id: project.id, name: 'Renamed again' });
  });

  it('removes a deleted project from the database at once', async () => {
    const project = { ...m.document.newProject('Gone'), updatedAt: 1 };
    list.mockResolvedValue([recordOf(project)]);
    await m.persistence.restoreAndWatchComics();
    m.store.useComic.getState().deleteProject(project.id);
    expect(remove).toHaveBeenCalledWith(project.id);
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps the screen when a save fails, and saves the next change', async () => {
    const project = { ...m.document.newProject('Flaky'), updatedAt: 1 };
    list.mockResolvedValue([recordOf(project)]);
    save.mockRejectedValueOnce(new Error('disk full'));
    await m.persistence.restoreAndWatchComics();
    m.store.useComic.getState().renameProject(project.id, 'First');
    await vi.advanceTimersByTimeAsync(1000);
    m.store.useComic.getState().renameProject(project.id, 'Second');
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(m.store.useComic.getState().projects[0]!.name).toBe('Second');
  });
});

describe('saving the layers of the pages', () => {
  const image = (name: string) => ({ name, url: `url:${name}`, thumbnailUrl: '', width: 400, height: 300, createdAt: 0, boardId: null, starred: false, isIntermediate: true, category: 'general' }) as import('@/backend').ImageDTO;

  it('stores a picture that lives only in the page before the project is written, and the page takes the stored one', async () => {
    const project = { ...m.document.newProject('Painted'), updatedAt: 1 };
    list.mockResolvedValue([recordOf(project)]);
    const upload = vi.spyOn(m.backend, 'saveImageFromUrl').mockResolvedValue(image('stored.png'));
    await m.persistence.restoreAndWatchComics();
    const page = m.store.useComic.getState().projects[0]!.pages[0]!;
    const layer = { id: 'r', type: 'raster' as const, seq: 3, name: null, isEnabled: true, isLocked: false, opacity: 1, x: 0, y: 0, objects: [{ kind: 'image' as const, id: 'o', url: 'blob:live', imageName: null, x: 1, y: 2, width: 30, height: 40 }] };
    m.store.useComic.getState().setPageCanvas(page.id, { ...page.canvas, entities: [...page.canvas.entities, layer] });
    await vi.advanceTimersByTimeAsync(1000);
    expect(upload).toHaveBeenCalledWith('blob:live', expect.objectContaining({ isIntermediate: true }));
    const saved = save.mock.calls[0]![1] as { pages: { canvas: { entities: { objects: unknown[] }[] } }[] };
    expect(saved.pages[0]!.canvas.entities.flatMap((e) => e.objects)).toEqual([expect.objectContaining({ id: 'o', imageName: 'stored.png', url: '' })]);
    const live = m.store.useComic.getState().projects[0]!.pages[0]!.canvas.entities.flatMap((e) => e.objects);
    expect(live).toEqual([expect.objectContaining({ imageName: 'stored.png' })]);
  });

  it('warns once when a project comes close to what the backend keeps, and still saves it', async () => {
    const project = { ...m.document.newProject('Huge'), updatedAt: 1 };
    list.mockResolvedValue([recordOf(project)]);
    const { useToasts } = await import('../toasts');
    await m.persistence.restoreAndWatchComics();
    m.store.useComic.getState().renameProject(project.id, 'x'.repeat(m.persistence.WARN_PROJECT_BYTES));
    await vi.advanceTimersByTimeAsync(1000);
    m.store.useComic.getState().renameProject(project.id, 'y'.repeat(m.persistence.WARN_PROJECT_BYTES));
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(useToasts.getState().toasts.filter((t) => t.status === 'warning')).toHaveLength(1);
  });

  it('writes a version 1 project with a turned picture only once the picture is baked', async () => {
    const { useGallery } = await import('../gallery');
    useGallery.setState({ images: [image('sky.png')] });
    const bakeOne = vi.spyOn(await import('./bakeRotation'), 'bakeOne');
    let finish: (name: string) => void = () => undefined;
    bakeOne.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const v1 = { version: 1, id: 'old', name: 'Old', updatedAt: 1, pages: [{ id: 'p', panels: [], layers: [{ id: 'pic', kind: 'image', imageName: 'sky.png', view: { cx: 0.5, cy: 0.5, scale: 0.5, rotation: 45 } }] }] };
    list.mockResolvedValue([{ id: 'old', updatedAt: 1, document: v1 }]);
    const restored = m.persistence.restoreAndWatchComics();
    await vi.advanceTimersByTimeAsync(0);
    m.store.useComic.getState().renameProject('old', 'Changed while baking');
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).not.toHaveBeenCalled();
    finish('turned.png');
    await restored;
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledOnce();
    const saved = save.mock.calls[0]![1] as { version: number; pages: { canvas: { entities: { objects: { imageName: string; flipX?: boolean }[] }[] } }[] };
    expect(saved.version).toBe(2);
    expect(saved.pages[0]!.canvas.entities.flatMap((e) => e.objects)).toEqual([expect.objectContaining({ imageName: 'turned.png' })]);
  });

  it('does not write a version 1 project whose turned picture could not be baked, and tells the user', async () => {
    const { useGallery } = await import('../gallery');
    const { useToasts } = await import('../toasts');
    useGallery.setState({ images: [image('sky.png')] });
    vi.spyOn(await import('./bakeRotation'), 'bakeOne').mockRejectedValue(new Error('no canvas'));
    const v1 = { version: 1, id: 'old', name: 'Old', updatedAt: 1, pages: [{ id: 'p', panels: [], layers: [{ id: 'pic', kind: 'image', imageName: 'sky.png', view: { rotation: -30 } }] }] };
    list.mockResolvedValue([{ id: 'old', updatedAt: 1, document: v1 }]);
    await m.persistence.restoreAndWatchComics();
    expect(useToasts.getState().toasts.map((t) => t.status)).toContain('error');
    m.store.useComic.getState().renameProject('old', 'Changed');
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).not.toHaveBeenCalled();
    // The picture is still shown, unturned, for this run.
    expect(m.store.useComic.getState().projects[0]!.pages[0]!.canvas.entities.flatMap((e) => e.objects)).toEqual([expect.objectContaining({ imageName: 'sky.png' })]);
  });
});
