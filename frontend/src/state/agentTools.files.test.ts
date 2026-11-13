// @vitest-environment jsdom
// The tools for work on what is already made and on the queue: a board's pictures by its name or path, the export
// dialog opened with the assistant's choices, how many runs generate queues, cancelling only the assistant's own
// queue items, and where the engine's folders are.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type AgentToolCall, type BoardDTO, type EngineSettings } from '@/backend';
import { boardsNamed, createToolRun, runAgentTool, type ToolRun } from './agentTools';
import { useShareDialog } from './dialogs/share';
import { useEngine } from './engine';
import { useGallery } from './gallery';
import { useQueue } from './queue';
import { useSettings } from './settings';

const enqueue = vi.hoisted(() => vi.fn());
vi.mock('./invoke', () => ({ enqueueActive: enqueue }));

let run: ToolRun;
const call = (tool: string, args: unknown = {}) => runAgentTool({ callId: 'c-1', tool, args, readGated: false } satisfies AgentToolCall, run);

const board = (id: string, name: string, parentId: string | null = null): BoardDTO => ({ id, name, archived: false, createdAt: 0, parentId });
const image = (name: string, boardId: string | null, extra = {}) =>
  ({ name, url: '', thumbnailUrl: '', width: 3360, height: 5056, createdAt: name.charCodeAt(0), boardId, starred: false, isIntermediate: false, category: 'general', workflow: null, metadata: null, ...extra }) as never;

// Ganyu/Ganyu（）/Done holds two finished pictures; another board of the same name sits elsewhere.
const BOARDS = [board('g', 'Ganyu'), board('g2', 'Ganyu（）', 'g'), board('done', 'Done', 'g2'), board('other', 'Other'), board('done2', 'Done', 'other')];

beforeEach(() => {
  run = createToolRun(async () => 'once');
  useSettings.getState().set({ assistantReadAccess: 'always' });
  useGallery.setState({
    boards: BOARDS,
    images: [image('a.png', 'done'), image('b.png', 'done'), image('c.png', 'g'), image('d.png', null), image('e.png', 'done', { isIntermediate: true })],
  });
  useShareDialog.setState({ names: null, preset: null });
});
afterEach(() => {
  vi.restoreAllMocks();
  enqueue.mockReset();
});

describe('a board by name or path', { tags: [] }, () => {
  it('matches the whole path first, then a path that ends with the words, ignoring case and width', { tags: ['equivalence'] }, () => {
    expect(boardsNamed(BOARDS, 'Ganyu/Ganyu（）/Done').map((b) => b.id)).toEqual(['done']);
    expect(boardsNamed(BOARDS, ' ganyu / GANYU() / done ').map((b) => b.id)).toEqual(['done']);
    expect(boardsNamed(BOARDS, 'Ganyu（）/Done').map((b) => b.id)).toEqual(['done']);
    expect(boardsNamed(BOARDS, 'Ganyu').map((b) => b.id)).toEqual(['g']);
    // Two boards are named Done: both are returned, so the model is asked for the path.
    expect(boardsNamed(BOARDS, 'Done').map((b) => b.id).sort()).toEqual(['done', 'done2']);
    expect(boardsNamed(BOARDS, 'one')).toEqual([]);
    expect(boardsNamed(BOARDS, ' / ')).toEqual([]);
  });

  it('lists the pictures of that board only, with the board on each, and none for pictures in no board', { tags: ['equivalence', 'condition'] }, async () => {
    expect(await call('list_gallery_images', { board: 'Ganyu/Ganyu（）/Done' })).toEqual({
      ok: true,
      content: { total: 2, images: [expect.objectContaining({ name: 'b.png', board: 'Ganyu/Ganyu（）/Done', width: 3360 }), expect.objectContaining({ name: 'a.png' })] },
    });
    // A board does not take in its subfolders' pictures.
    expect(await call('list_gallery_images', { board: 'Ganyu' })).toMatchObject({ content: { total: 1, images: [{ name: 'c.png', board: 'Ganyu' }] } });
    expect(await call('list_gallery_images', { board: 'none' })).toMatchObject({ content: { total: 1, images: [{ name: 'd.png' }] } });
  });

  it('answers with the boards when none or several match, instead of an empty list', { tags: ['error-guessing'] }, async () => {
    expect(await call('list_gallery_images', { board: 'Nope' })).toEqual({
      ok: true,
      content: { total: 0, images: [], note: 'No board is named "Nope".', boards: ['Ganyu', 'Ganyu/Ganyu（）', 'Ganyu/Ganyu（）/Done', 'Other', 'Other/Done'] },
    });
    expect(await call('list_gallery_images', { board: 'Done' })).toMatchObject({ content: { total: 0, boards: ['Ganyu/Ganyu（）/Done', 'Other/Done'], note: expect.stringContaining('whole path') } });
  });
});

describe('exporting pictures', { tags: [] }, () => {
  it('opens the export dialog on the gallery pictures with the choices, and writes nothing itself', { tags: ['scenario'] }, async () => {
    const write = vi.spyOn(backend, 'exportImages');
    const answer = await call('export_pictures', { names: ['a.png', 'b.png', 'a.png', 'gone.png', 'e.png'], format: 'jpeg', quality: 92 });
    expect(answer).toEqual({ ok: true, content: { opened: 2, notFound: ['gone.png', 'e.png'], note: expect.stringContaining('presses its export button') } });
    expect(useShareDialog.getState().names).toEqual(['a.png', 'b.png']);
    expect(useShareDialog.getState().preset?.choices).toEqual({ format: 'jpeg', quality: 92 });
    expect(run.log).toEqual([{ kind: 'export', count: 2 }]);
    expect(write).not.toHaveBeenCalled();
  });

  it('refuses an unknown format and pictures that are not in the gallery, opening nothing', { tags: ['error-guessing'] }, async () => {
    expect(await call('export_pictures', { names: ['a.png'], format: 'gif' })).toMatchObject({ ok: false });
    expect(await call('export_pictures', { names: ['gone.png'], format: 'png' })).toMatchObject({ ok: false, content: expect.stringContaining('list_gallery_images') });
    expect(useShareDialog.getState().names).toBeNull();
    expect(run.log).toEqual([]);
  });
});

describe('runs and the queue', { tags: [] }, () => {
  it('runs as many times as count says, and warns when the count box made several runs', { tags: ['decision-table'] }, async () => {
    enqueue.mockResolvedValueOnce({ items: [{ id: 21 }] });
    expect(await call('generate', { target: 'screen', count: 1 })).toEqual({ ok: true, content: { queued: [21] } });
    expect(enqueue).toHaveBeenLastCalledWith({ pictures: 1 });
    enqueue.mockResolvedValueOnce({ items: [{ id: 22 }, { id: 23 }, { id: 24 }] });
    expect(await call('generate', { target: 'screen' })).toEqual({ ok: true, content: { queued: [22, 23, 24], note: expect.stringContaining('cancel the others now with cancel_queue') } });
    expect(enqueue).toHaveBeenLastCalledWith({});
    // Asked for three: no warning.
    enqueue.mockResolvedValueOnce({ items: [{ id: 25 }, { id: 26 }, { id: 27 }] });
    expect(await call('generate', { target: 'screen', count: 3 })).toEqual({ ok: true, content: { queued: [25, 26, 27] } });
  });

  it('cancels only the unfinished items it queued, and says why it left the others', { tags: ['decision-table', 'state-transition'] }, async () => {
    enqueue.mockResolvedValueOnce({ items: [{ id: 31 }, { id: 32 }, { id: 33 }] });
    await call('generate', { target: 'screen' });
    const cancel = vi.spyOn(backend, 'cancelQueueItem').mockResolvedValue();
    useQueue.setState({
      items: [
        { id: 31, status: 'pending' },
        { id: 32, status: 'in_progress' },
        { id: 33, status: 'completed' },
        { id: 40, status: 'pending' },
      ] as never,
    });
    const answer = await call('cancel_queue', { ids: [31, 32, 33, 40, 31] });
    expect(cancel.mock.calls.map((c) => c[0])).toEqual([31, 32]);
    expect(answer).toEqual({ ok: true, content: { canceled: [31, 32], notCanceled: ['33: already completed', '40: not queued by you (the user cancels it in the queue)'] } });
    expect(run.log.at(-1)).toEqual({ kind: 'canceled', count: 2 });
    // Nothing it may cancel: an error, and no chip.
    const before = run.log.length;
    expect(await call('cancel_queue', { ids: [40] })).toMatchObject({ ok: false, content: expect.stringContaining('Nothing was canceled') });
    expect(await call('cancel_queue', { ids: [] })).toMatchObject({ ok: false });
    expect(run.log).toHaveLength(before);
  });

  it('reports a cancel the backend refused', { tags: ['error-guessing'] }, async () => {
    enqueue.mockResolvedValueOnce({ items: [{ id: 51 }] });
    await call('generate', { target: 'screen' });
    useQueue.setState({ items: [{ id: 51, status: 'pending' }] as never });
    vi.spyOn(backend, 'cancelQueueItem').mockRejectedValue(new Error('gone'));
    expect(await call('cancel_queue', { ids: [51] })).toEqual({ ok: false, content: 'Nothing was canceled: 51: gone' });
  });
});

describe('where the engine is', { tags: [] }, () => {
  const settings = (patch: Partial<EngineSettings>) =>
    ({ dataDir: 'C:\\novira-data', comfyuiRoot: 'C:\\novira-data\\comfyui', comfyuiMode: 'owned', comfyuiDir: null, comfyuiUrl: null, comfyuiOutputDir: 'C:\\novira-data\\comfyui\\portable\\ComfyUI\\output', ...patch }) as EngineSettings;

  it('gives the full paths of the install, its output and the data folder, by how novira reaches ComfyUI', { tags: ['equivalence'] }, async () => {
    useEngine.setState({ status: { state: 'ready' } });
    vi.spyOn(backend, 'engineSettings').mockResolvedValueOnce(settings({}));
    expect(await call('get_engine_info')).toEqual({
      ok: true,
      content: { engine: 'novira installs and runs its own ComfyUI', state: 'ready', installFolder: 'C:\\novira-data\\comfyui', outputFolder: 'C:\\novira-data\\comfyui\\portable\\ComfyUI\\output', dataFolder: 'C:\\novira-data' },
    });
    vi.spyOn(backend, 'engineSettings').mockResolvedValueOnce(settings({ comfyuiMode: 'folder', comfyuiDir: 'D:\\ComfyUI', comfyuiOutputDir: 'D:\\ComfyUI\\output' }));
    expect(await call('get_engine_info')).toMatchObject({ content: { comfyuiFolder: 'D:\\ComfyUI', outputFolder: 'D:\\ComfyUI\\output' } });
    vi.spyOn(backend, 'engineSettings').mockResolvedValueOnce(settings({ comfyuiMode: 'url', comfyuiUrl: 'http://127.0.0.1:8188', comfyuiOutputDir: null }));
    expect(await call('get_engine_info')).toMatchObject({ content: { address: 'http://127.0.0.1:8188', outputFolder: expect.stringContaining('not known') } });
  });
});
