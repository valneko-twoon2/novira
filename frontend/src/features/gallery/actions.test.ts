// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type GenerationMetadata, type ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useGalleryUndo } from '@/state/galleryUndo';
import { useParams } from '@/state/params';
import { useToasts } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { useWorkflows } from '@/state/workflows/workflows';
import {
  addAsReference,
  boardName,
  canLoadImageWorkflow,
  copyImage,
  copyText,
  deleteImagesNow,
  downloadImages,
  loadImageWorkflow,
  moveImagesToBoard,
  recall,
  sendToUpscale,
  setStarred,
  uploadFiles,
} from './actions';

const initial = { gallery: useGallery.getState(), params: useParams.getState(), toasts: useToasts.getState(), ui: useUi.getState() };

const image = (name: string, over: Partial<ImageDTO> = {}): ImageDTO =>
  ({ name, url: `blob:${name}`, thumbnailUrl: `blob:t-${name}`, width: 640, height: 480, workflow: null, metadata: null, ...over }) as ImageDTO;
const lastToast = () => useToasts.getState().toasts.at(-1);

beforeEach(() => {
  useGallery.setState(initial.gallery, true);
  useParams.setState(initial.params, true);
  useToasts.setState(initial.toasts, true);
  useUi.setState(initial.ui, true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('boardName', () => {
  it('names the uncategorized pseudo board and any board that is gone the same way', () => {
    useGallery.getState().setBoards([{ id: 'b1', name: 'Cats', archived: false, createdAt: 0 }]);
    expect(boardName('b1')).toBe('Cats');
    expect(boardName('none')).toBe(boardName('missing'));
  });
});

describe('moving, starring and deleting', () => {
  it('moves images to a board (null for the uncategorized one) and stores the updated images', async () => {
    useGallery.setState({ images: [image('a')] });
    const update = vi.spyOn(backend, 'updateImages').mockResolvedValue([image('a', { boardId: 'b1' })]);
    await moveImagesToBoard(['a'], 'b1');
    expect(update).toHaveBeenLastCalledWith(['a'], { boardId: 'b1' });
    await moveImagesToBoard(['a'], 'none');
    expect(update).toHaveBeenLastCalledWith(['a'], { boardId: null });
    expect(useGallery.getState().images[0]?.boardId).toBe('b1');
    expect(lastToast()?.status).toBe('success');
  });

  it('does nothing for an empty selection', async () => {
    const update = vi.spyOn(backend, 'updateImages');
    const del = vi.spyOn(backend, 'deleteImages');
    await moveImagesToBoard([], 'b1');
    await setStarred([], true);
    await deleteImagesNow([]);
    expect(update).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(useToasts.getState().toasts).toEqual([]);
  });

  it('stars images through the backend', async () => {
    const update = vi.spyOn(backend, 'updateImages').mockResolvedValue([image('a', { starred: true })]);
    await setStarred(['a'], true);
    expect(update).toHaveBeenCalledWith(['a'], { starred: true });
  });

  it('deletes images in the backend, drops them from the store and reports it', async () => {
    useGallery.setState({ images: [image('a'), image('b')] });
    vi.spyOn(backend, 'deleteImages').mockResolvedValue(undefined);
    await deleteImagesNow(['a']);
    expect(useGallery.getState().images.map((i) => i.name)).toEqual(['b']);
    expect(lastToast()?.status).toBe('success');
  });

  it('offers an undo with the toast, and the button brings the pictures back', async () => {
    useGallery.setState({ images: [image('a'), image('b')] });
    useGalleryUndo.setState({ undo: [], redo: [] });
    vi.spyOn(backend, 'deleteImages').mockResolvedValue(undefined);
    vi.spyOn(backend, 'restoreImages').mockResolvedValue([image('a')]);
    await deleteImagesNow(['a']);
    expect(useGalleryUndo.getState().undo).toEqual([['a']]);
    const action = lastToast()?.actions?.[0];
    expect(action?.label).toBe(t('gallery.undoDelete.action'));
    action?.run();
    await vi.waitFor(() => expect(useGallery.getState().images.map((i) => i.name).sort()).toEqual(['a', 'b']));
  });
});

describe('uploadFiles', () => {
  const file = (name: string, type: string) => new File(['x'], name, { type });

  it('uploads only image files into the auto-add board, then shows them selected in the assets view', async () => {
    useGallery.setState({ autoAddBoardId: 'b1', page: 3 });
    const upload = vi.spyOn(backend, 'uploadImage').mockImplementation(async (f) => image((f as File).name));
    await uploadFiles([file('a.png', 'image/png'), file('notes.txt', 'text/plain'), file('b.png', 'image/png')]);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenCalledWith(expect.anything(), { boardId: 'b1' });
    const g = useGallery.getState();
    expect(g.selectedBoardId).toBe('b1');
    expect(g.view).toBe('assets');
    expect(g.page).toBe(0);
    expect(g.selection).toEqual(['b.png']);
  });

  it('uses no board when none is set to receive new pictures, and does nothing when no file is an image', async () => {
    const upload = vi.spyOn(backend, 'uploadImage').mockResolvedValue(image('a.png'));
    await uploadFiles([file('notes.txt', 'text/plain')]);
    expect(upload).not.toHaveBeenCalled();
    expect(useToasts.getState().toasts).toEqual([]);
    await uploadFiles([file('a.png', 'image/png')]);
    expect(upload).toHaveBeenCalledWith(expect.anything(), { boardId: null });
    expect(useGallery.getState().selectedBoardId).toBe('none');
  });
});

describe('recall', () => {
  const meta = { seed: 7, positivePrompt: 'p' } as GenerationMetadata;

  it('recalls the size even without metadata', () => {
    const size = vi.spyOn(useParams.getState(), 'recallSize').mockImplementation(() => undefined);
    recall(image('a'), 'size');
    expect(size).toHaveBeenCalledWith(640, 480);
    expect(lastToast()?.status).toBe('info');
  });

  it('warns instead of recalling when the picture has no metadata', () => {
    const remix = vi.spyOn(useParams.getState(), 'remix').mockImplementation(() => ({ kind: 'none' }));
    for (const kind of ['remix', 'prompt', 'seed', 'all'] as const) recall(image('a'), kind);
    expect(remix).not.toHaveBeenCalled();
    expect(lastToast()?.status).toBe('warning');
  });

  it('says when the model was found by name, or not found and kept', () => {
    const p = useParams.getState();
    const all = vi.spyOn(p, 'recallAll').mockImplementation(() => ({ kind: 'missing', name: 'WAI-v17' }));
    recall(image('a', { metadata: meta }), 'all');
    expect(lastToast()).toMatchObject({ status: 'warning', description: t('gallery.toast.recallModelMissing', { name: 'WAI-v17' }) });
    const found = { key: 'k', name: 'waiIllustriousSDXL_v170' } as never;
    vi.spyOn(p, 'remix').mockImplementation(() => ({ kind: 'name', model: found }));
    recall(image('a', { metadata: meta }), 'remix');
    expect(lastToast()).toMatchObject({ status: 'info', description: t('gallery.toast.recallModelByName', { name: 'waiIllustriousSDXL_v170' }) });
    all.mockImplementation(() => ({ kind: 'key', key: 'k' }));
    recall(image('a', { metadata: meta }), 'all');
    expect(lastToast()?.description).toBeUndefined();
  });

  it('routes each kind to its own recall', () => {
    const p = useParams.getState();
    const spies = {
      remix: vi.spyOn(p, 'remix').mockImplementation(() => ({ kind: 'none' })),
      prompt: vi.spyOn(p, 'recallPrompts').mockImplementation(() => undefined),
      seed: vi.spyOn(p, 'recallSeed').mockImplementation(() => undefined),
      all: vi.spyOn(p, 'recallAll').mockImplementation(() => ({ kind: 'none' })),
    };
    const img = image('a', { metadata: meta });
    recall(img, 'remix');
    recall(img, 'prompt');
    recall(img, 'seed');
    recall(img, 'all');
    expect(spies.remix).toHaveBeenCalledWith(meta);
    expect(spies.prompt).toHaveBeenCalledWith(meta);
    expect(spies.seed).toHaveBeenCalledWith(7);
    expect(spies.all).toHaveBeenCalledWith(meta);
    expect(useToasts.getState().toasts.map((t) => t.title)).toHaveLength(4);
  });
});

describe('copying', () => {
  it('warns when the browser cannot write images to the clipboard', async () => {
    vi.stubGlobal('ClipboardItem', undefined);
    await copyImage(image('a'));
    expect(lastToast()?.status).toBe('warning');
  });

  it('reports a failed image copy when the picture cannot be loaded', async () => {
    vi.stubGlobal('ClipboardItem', class {});
    vi.stubGlobal('navigator', { clipboard: { write: vi.fn() } });
    vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (this: HTMLImageElement) {
      queueMicrotask(() => this.onerror?.(new Event('error')));
    });
    await copyImage(image('a'));
    expect(lastToast()?.status).toBe('error');
  });

  it('copies text and reports success, or failure when the clipboard refuses', async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await copyText('hello');
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(lastToast()?.status).toBe('success');
    await copyText('again');
    expect(lastToast()?.status).toBe('error');
  });
});

describe('downloadImages', () => {
  it('clicks one temporary link per image, named after the image, and removes it again', () => {
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(`${this.download}|${this.getAttribute('href')}`);
    });
    downloadImages([image('a.png'), image('b.png')]);
    expect(clicked).toEqual(['a.png|blob:a.png', 'b.png|blob:b.png']);
    expect(document.querySelectorAll('a')).toHaveLength(0);
  });
});

describe('sending pictures elsewhere', () => {
  it('adds a reference image and says so', () => {
    const add = vi.spyOn(useParams.getState(), 'addRefImage');
    addAsReference(image('a'));
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ imageName: 'a', imageUrl: 'blob:a' }));
    expect(lastToast()?.status).toBe('success');
  });

  it('opens the upscaling tab with the picture as its source', () => {
    const img = image('a');
    sendToUpscale(img);
    expect(useParams.getState().upscale.initialImage).toBe(img);
    expect(useUi.getState().activeTab).toBe('upscaling');
  });
});

describe('opening a picture as a workflow', () => {
  it('can open a picture that carries a workflow, and loads it under the workflow name or the image name', () => {
    const load = vi.spyOn(useWorkflows.getState(), 'loadWorkflow').mockImplementation(() => undefined);
    const wf = { nodes: [] };
    expect(canLoadImageWorkflow(image('a', { workflow: wf }))).toBe(true);
    loadImageWorkflow(image('a', { workflow: wf, metadata: { workflowName: 'W' } as unknown as GenerationMetadata }));
    expect(load).toHaveBeenLastCalledWith(wf, 'W');
    loadImageWorkflow(image('b', { workflow: wf }));
    expect(load).toHaveBeenLastCalledWith(wf, 'b');
    expect(useUi.getState().activeTab).toBe('workflows');
    expect(lastToast()?.status).toBe('success');
  });

  it('builds a graph from the settings of a plain picture only when the workflow store accepts it', () => {
    const can = vi.spyOn(useWorkflows.getState(), 'canLoadImage').mockReturnValue(false);
    const loadImage = vi.spyOn(useWorkflows.getState(), 'loadImage').mockImplementation(() => undefined);
    expect(canLoadImageWorkflow(image('a'))).toBe(false);
    loadImageWorkflow(image('a'));
    expect(loadImage).not.toHaveBeenCalled();
    can.mockReturnValue(true);
    expect(canLoadImageWorkflow(image('a'))).toBe(true);
    loadImageWorkflow(image('a'));
    expect(loadImage).toHaveBeenCalledTimes(1);
  });
});
