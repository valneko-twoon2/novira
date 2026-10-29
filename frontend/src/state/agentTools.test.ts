// @vitest-environment jsdom
// The tool dispatcher: every tool reaches the app's own appliers (with an undo snapshot first and the screen opened),
// reads are gated by the user's permission, and errors come back to the model as tool errors.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type AgentToolCall } from '@/backend';
import { registerAgentEditor, registerAgentModelSelector, registerAgentWorkflow, type AgentEditor } from './agentRegistry';
import { createToolRun, currentScreen, DECLINED, DECLINED_WEB, isReadGated, MAX_ANSWER_CHARS, runAgentTool, TOOL_NAMES, webQuestion, type PermissionChoice, type ToolRun } from './agentTools';
import { useNodePacks } from './comfy/nodePacks';
import { useRegistry } from './comfy/registry';
import { useGallery } from './gallery';
import { useModels } from './models';
import { useParams } from './params';
import { useQueue } from './queue';
import { useSettings } from './settings';
import { useUi } from './ui';

const enqueue = vi.hoisted(() => vi.fn());
vi.mock('./invoke', () => ({ enqueueActive: enqueue }));

const initial = { ui: useUi.getState(), models: useModels.getState(), params: useParams.getState() };

/** A fake editor that records what it is given. */
function editor(name: string, applies = true): AgentEditor & { applied: unknown[][]; restored: unknown[]; snapshots: number } {
  const e = {
    applied: [] as unknown[][],
    restored: [] as unknown[],
    snapshots: 0,
    context: () => ({ editor: name }),
    apply: (ops: unknown[]) => {
      e.applied.push(ops);
      return applies;
    },
    snapshot: () => {
      e.snapshots++;
      return { before: name };
    },
    restore: (s: unknown) => void e.restored.push(s),
  };
  return e;
}

let asked: string[] = [];
let askedArgs: unknown[] = [];
let answer: PermissionChoice = 'once';
let run: ToolRun;
const call = (tool: string, args: unknown = {}, readGated = false) => runAgentTool({ callId: 'c-1', tool, args, readGated } satisfies AgentToolCall, run);

beforeEach(() => {
  asked = [];
  askedArgs = [];
  answer = 'once';
  run = createToolRun(async (tool, args) => {
    asked.push(tool);
    askedArgs.push(args);
    return answer;
  });
  useUi.setState(initial.ui, true);
  useModels.setState(initial.models, true);
  useParams.setState(initial.params, true);
  useSettings.getState().set({ assistantReadAccess: 'ask', assistantWebAccess: 'ask' });
});
afterEach(() => vi.restoreAllMocks());

describe('the tool list', () => {
  it('has a handler for every tool the backend offers, and no other', () => {
    const rust = readFileSync(resolve(process.cwd(), '../backend/crates/novira-core/src/agent/tools.rs'), 'utf8');
    const offered = [...rust.matchAll(/^\s+name: "([a-z_]+)",$/gm)].map((m) => m[1]);
    expect([...TOOL_NAMES].sort()).toEqual([...offered].sort());
  });

  it('tags the same reads as the backend', () => {
    const rust = readFileSync(resolve(process.cwd(), '../backend/crates/novira-core/src/agent/tools.rs'), 'utf8');
    const body = rust.slice(rust.indexOf('pub fn is_read_gated'), rust.indexOf('pub fn check_call'));
    expect([...body.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]).sort()).toEqual(['get_generation_settings', 'get_image_info', 'list_gallery_images', 'lookup_reference', 'view_comic_page']);
    expect(isReadGated('list_gallery_images', {})).toBe(true);
    expect(isReadGated('get_image_info', { name: 'a' })).toBe(true);
    expect(isReadGated('get_generation_settings', { includePrompts: true })).toBe(true);
    expect(isReadGated('get_generation_settings', {})).toBe(false);
    expect(isReadGated('lookup_reference', { query: 'kimono' })).toBe(true);
    expect(isReadGated('view_comic_page', { page: 1 })).toBe(true);
    for (const tool of TOOL_NAMES.filter((t) => !['list_gallery_images', 'get_image_info', 'get_generation_settings', 'lookup_reference', 'view_comic_page'].includes(t))) expect(isReadGated(tool, { includePrompts: true })).toBe(false);
  });

  it('answers an unknown tool, a failing tool and an oversized answer with an error', async () => {
    expect(await call('delete_images')).toMatchObject({ ok: false });
    registerAgentEditor('text', { ...editor('text'), context: () => ({ huge: 'x'.repeat(MAX_ANSWER_CHARS + 1) }) });
    expect(await call('get_text_scene')).toMatchObject({ ok: false, content: expect.stringContaining('too large') });
    registerAgentEditor('text', {
      ...editor('text'),
      context: () => {
        throw new Error('boom');
      },
    });
    expect(await call('get_text_scene')).toEqual({ ok: false, content: 'The tool failed: boom' });
  });
});

describe('the editors', () => {
  const screens = { text: editor('text'), workflows: editor('workflows'), video: editor('video'), music: editor('music'), voice: editor('voice'), canvas: editor('canvas'), comic: editor('comic') };
  beforeEach(() => {
    for (const [screen, e] of Object.entries(screens)) {
      e.applied.length = 0;
      e.snapshots = 0;
      registerAgentEditor(screen as never, e);
    }
  });

  it.each([
    ['edit_text', { ops: [{ op: 'remove' }] }, 'text', [{ op: 'remove' }], { kind: 'editText', count: 1 }, 'generate', 'text'],
    ['edit_workflow', { ops: [{ op: 'connect' }] }, 'workflows', [{ op: 'connect' }], { kind: 'editWorkflow', count: 1 }, 'workflows', undefined],
    ['edit_comic', { ops: [{ op: 'addPage' }, { op: 'addPage' }] }, 'comic', [{ op: 'addPage' }, { op: 'addPage' }], { kind: 'editComic', count: 2 }, 'comic', undefined],
    ['set_form', { kind: 'video', fields: { seconds: 3 } }, 'video', [{ seconds: 3 }], { kind: 'video', count: 1 }, 'generate', 'video'],
    ['set_form', { kind: 'music', fields: { bpm: 90, tags: 'x' } }, 'music', [{ bpm: 90, tags: 'x' }], { kind: 'music', count: 2 }, 'generate', 'music'],
    ['set_form', { kind: 'voice', fields: { text: 'hi' } }, 'voice', [{ text: 'hi' }], { kind: 'voice', count: 1 }, 'generate', 'voice'],
    ['set_pose', { people: [{ x: 0.5 }] }, 'canvas', [{ people: [{ x: 0.5 }], add: false }], { kind: 'pose', count: 1 }, 'canvas', undefined],
  ] as const)('%s reaches the %s editor after a snapshot, opens its screen and is logged', async (tool, args, screen, ops, log, tab, media) => {
    useUi.setState({ activeTab: 'models', media: 'image' });
    const result = await call(tool, args);
    expect(result).toEqual({ ok: true, content: { applied: true, now: { editor: screen } } });
    expect(screens[screen].applied).toEqual([ops]);
    expect(run.editSnapshots).toEqual({ [screen]: { before: screen } });
    expect(run.log).toEqual([log]);
    expect(useUi.getState().activeTab).toBe(tab);
    if (media) expect(useUi.getState().media).toBe(media);
  });

  it('keeps one snapshot per editor however many calls change it', async () => {
    await call('edit_comic', { ops: [{ op: 'addPage' }] });
    await call('edit_comic', { ops: [{ op: 'addPage' }] });
    expect(screens.comic.snapshots).toBe(1);
    expect(run.log).toHaveLength(2);
  });

  it('tells the model when no operation took effect, and logs nothing', async () => {
    registerAgentEditor('text', editor('text', false));
    expect(await call('edit_text', { ops: [{ op: 'nope' }] })).toMatchObject({ ok: false, content: expect.stringContaining('None of the operations') });
    expect(run.log).toEqual([]);
  });

  it('answers an edit with the shorter answer of the editor when it has one, and a read with the whole context', async () => {
    registerAgentEditor('comic', { ...editor('comic'), context: () => ({ whole: true }), answer: () => ({ short: true }) });
    expect(await call('edit_comic', { ops: [{ op: 'addPage' }] })).toEqual({ ok: true, content: { applied: true, now: { short: true } } });
    expect(await call('get_comic_page')).toEqual({ ok: true, content: { whole: true } });
  });

  it('reads each editor without changing anything', async () => {
    for (const [tool, args, screen] of [['get_text_scene', {}, 'text'], ['get_comic_page', {}, 'comic'], ['get_pose', {}, 'canvas'], ['get_form', { kind: 'music' }, 'music']] as const) {
      expect(await call(tool, args)).toEqual({ ok: true, content: { editor: screen } });
    }
    expect(run.log).toEqual([]);
    expect(run.editSnapshots).toEqual({});
  });

  it('opens a graph the assistant made with the registered opener, and gives the node types and recipes', async () => {
    const open = vi.fn(() => ({ dropped: [] }));
    registerAgentWorkflow(open, () => [{ type: 'math', inputs: [], outputs: [] }], () => [{ id: 'r' } as never]);
    expect(await call('get_workflow')).toEqual({ ok: true, content: { graph: { editor: 'workflows' }, nodeTypes: [{ type: 'math', inputs: [], outputs: [] }], recipes: [{ id: 'r' }] } });
    await call('create_workflow', { name: 'Flow', graph: { nodes: [], edges: [] } });
    expect(open).toHaveBeenCalledWith('Flow', { nodes: [], edges: [] });
    expect(run.editSnapshots).toHaveProperty('workflows');
    expect(run.log).toEqual([{ kind: 'workflow', key: 'Flow' }]);
    expect(useUi.getState().activeTab).toBe('workflows');
    registerAgentWorkflow(() => ({ dropped: [] }), () => []);
  });

  it('answers with the reason when a graph does not open, and lists what an opened graph left out', async () => {
    registerAgentWorkflow(() => ({ error: 'The graph was not opened: there is no node type "x"', dropped: [] }), () => []);
    useUi.setState({ activeTab: 'models' });
    expect(await call('create_workflow', { name: 'Flow', graph: { nodes: [], edges: [] } })).toEqual({ ok: false, content: expect.stringContaining('no node type "x"') });
    expect(run.log).toEqual([]);
    expect(useUi.getState().activeTab).toBe('models');
    registerAgentWorkflow(() => ({ dropped: ['a.b -> c.d: no such input'] }), () => []);
    expect(await call('create_workflow', { name: 'Flow', graph: { nodes: [], edges: [] } })).toMatchObject({ ok: true, content: { opened: 'Flow', dropped: ['a.b -> c.d: no such input'] } });
    registerAgentWorkflow(() => ({ dropped: [] }), () => []);
  });

  it('searches the nodes of ComfyUI with the registered search, asking for eight by default', async () => {
    const search = vi.fn(() => ({ ready: true, total: 1, matches: [] }));
    registerAgentWorkflow(() => ({ dropped: [] }), () => [], () => [], search);
    expect(await call('search_comfy_nodes', { query: 'save audio' })).toEqual({ ok: true, content: { ready: true, total: 1, matches: [] } });
    expect(search).toHaveBeenCalledWith('save audio', 8);
    await call('search_comfy_nodes', { limit: 3 });
    expect(search).toHaveBeenLastCalledWith('', 3);
    expect(run.log).toEqual([]);
    expect(run.editSnapshots).toEqual({});
    registerAgentWorkflow(() => ({ dropped: [] }), () => []);
  });

  it('tells the model what an edit left out, and why when nothing took effect', async () => {
    registerAgentEditor('workflows', { ...editor('workflows'), skipped: () => ['op 1 (connect): a LATENT output cannot feed a IMAGE input'] });
    expect(await call('edit_workflow', { ops: [{ op: 'connect' }] })).toMatchObject({ ok: true, content: { applied: true, skipped: ['op 1 (connect): a LATENT output cannot feed a IMAGE input'] } });
    registerAgentEditor('workflows', { ...editor('workflows', false), skipped: () => ['op 1 (addNode): there is no node type "x"'] });
    expect(await call('edit_workflow', { ops: [{ op: 'addNode' }] })).toEqual({ ok: false, content: expect.stringContaining('there is no node type "x"') });
  });
});

describe('the Generate tab', () => {
  beforeEach(() => {
    useModels.setState({ models: [{ key: 'm1', name: 'M', type: 'main', base: 'sdxl' } as never, { key: 'l1', name: 'L', type: 'lora', base: 'sdxl' } as never] });
  });

  it('lists the models and selects one with the registered selector, keeping the settings first', async () => {
    const select = vi.fn();
    registerAgentModelSelector(select);
    expect(await call('list_models', { type: 'lora' })).toMatchObject({ ok: true, content: { models: [{ key: 'l1', type: 'lora' }] } });
    expect(await call('select_model', { key: 'l1' })).toMatchObject({ ok: false });
    expect(await call('select_model', { key: 'nope' })).toMatchObject({ ok: false });
    expect(run.snapshot).toBeUndefined();
    expect(await call('select_model', { key: 'm1' })).toMatchObject({ ok: true });
    expect(select.mock.calls[0]![0]).toMatchObject({ key: 'm1' });
    expect(run.snapshot).toHaveProperty('modelKey');
    expect(run.log).toEqual([{ kind: 'model', key: 'm1' }]);
    registerAgentModelSelector((m) => useParams.getState().set({ modelKey: m.key }));
  });

  it('adds a LoRA with its weight', async () => {
    expect(await call('add_lora', { key: 'm1' })).toMatchObject({ ok: false });
    await call('add_lora', { key: 'l1', weight: 0.6 });
    expect(useParams.getState().loras.find((l) => l.key === 'l1')?.weight).toBe(0.6);
    expect(run.log).toEqual([{ kind: 'lora', key: 'l1', weight: 0.6 }]);
  });

  it('sets prompts and parameters: a size on the grid, a fixed seed, a known scheduler only', async () => {
    expect(await call('set_generation_settings', { scheduler: 'warp' })).toMatchObject({ ok: false, content: expect.stringContaining('Unknown scheduler') });
    await call('set_generation_settings', { positivePrompt: 'a cat', width: 641, height: 384, scheduler: 'euler', seed: 9, steps: 12 });
    expect(useParams.getState()).toMatchObject({ positivePrompt: 'a cat', width: 640, height: 384, scheduler: 'euler', seed: 9, steps: 12, shouldRandomizeSeed: false, aspectRatio: 'free' });
    expect(run.log).toEqual([{ kind: 'prompt' }, { kind: 'params', summary: '640×384 / 12 steps / euler / seed 9' }]);
  });

  it('reads the settings without the prompts unless asked for them', async () => {
    useParams.getState().set({ positivePrompt: 'secret', steps: 21 });
    const plain = await call('get_generation_settings', {});
    expect(plain).toMatchObject({ ok: true, content: { steps: 21 } });
    expect(plain.content).not.toHaveProperty('positivePrompt');
    expect(asked).toEqual([]);
    expect(await call('get_generation_settings', { includePrompts: true })).toMatchObject({ ok: true, content: { positivePrompt: 'secret' } });
    expect(asked).toEqual(['get_generation_settings']);
  });

  it('queues what the screen would, and reports why nothing was queued', async () => {
    enqueue.mockResolvedValueOnce({ items: [{ id: 7 }, { id: 8 }] }).mockResolvedValueOnce({ problems: ['No model'] });
    expect(await call('generate', { target: 'screen' })).toEqual({ ok: true, content: { queued: [7, 8] } });
    expect(run.log).toEqual([{ kind: 'queued', count: 2 }]);
    expect(await call('generate', { target: 'screen' })).toEqual({ ok: false, content: 'Nothing was queued: No model' });
  });

  it('tells the state of queue items by id', async () => {
    useQueue.setState({ items: [{ id: 1, status: 'failed', error: 'oom', imageName: null } as never, { id: 2, status: 'completed', error: null, imageName: 'b.png' } as never] });
    expect(await call('get_queue_status', { ids: [2] })).toEqual({ ok: true, content: [{ id: 2, status: 'completed', picture: 'b.png' }] });
    expect(await call('get_queue_status', {})).toMatchObject({ content: [{ id: 1, error: 'oom' }, { id: 2 }] });
  });

  it('names the screen and gives the guide', async () => {
    useUi.setState({ activeTab: 'generate', media: 'music' });
    expect(currentScreen()).toBe('music');
    expect(await call('get_screen')).toMatchObject({ ok: true, content: { screen: 'music' } });
    const guide = await call('get_app_guide');
    expect((guide.content as { id: string }[]).some((g) => g.id === 'tab.extensions')).toBe(true);
  });
});

describe('the gallery and permission', () => {
  const image = (name: string, prompt: string, extra = {}) =>
    ({ name, url: '', thumbnailUrl: '', width: 8, height: 8, createdAt: name.charCodeAt(0), boardId: null, starred: false, isIntermediate: false, category: 'general', workflow: null, metadata: { positivePrompt: prompt, negativePrompt: '', modelKey: 'm', modelName: 'M', generationMode: 'txt2img', seed: 1, steps: 2, cfgScale: 3, scheduler: 'euler', width: 8, height: 8 }, ...extra }) as never;
  beforeEach(() => useGallery.setState({ images: [image('a.png', 'a cat'), image('b.png', 'a dog', { starred: true }), image('c.png', 'mask', { isIntermediate: true })] }));

  it('asks before reading, lists the newest pictures with their prompts, and leaves helper pictures out', async () => {
    const listed = await call('list_gallery_images', {}, true);
    expect(asked).toEqual(['list_gallery_images']);
    expect(listed).toMatchObject({ ok: true, content: { total: 2, images: [{ name: 'b.png', prompt: 'a dog' }, { name: 'a.png' }] } });
    expect(await call('list_gallery_images', { search: 'CAT', starredOnly: false })).toMatchObject({ content: { total: 1 } });
    expect(await call('list_gallery_images', { starredOnly: true })).toMatchObject({ content: { total: 1, images: [{ name: 'b.png' }] } });
  });

  it('tells how one picture was made, and not a helper picture', async () => {
    expect(await call('get_image_info', { name: 'a.png' })).toMatchObject({ ok: true, content: { generation: { positivePrompt: 'a cat', steps: 2 } } });
    expect(await call('get_image_info', { name: 'c.png' })).toMatchObject({ ok: false });
  });

  it('a decline reads nothing and says so; the backend tag alone is enough to ask', async () => {
    answer = 'deny';
    expect(await call('get_image_info', { name: 'a.png' })).toEqual({ ok: false, content: DECLINED });
    // A tool the frontend does not consider a read is still asked about when the backend tags the call.
    answer = 'once';
    await call('get_screen', {}, true);
    expect(asked).toEqual(['get_image_info', 'get_screen']);
  });

  it('never asks with always or never, and asks the questions of parallel calls one at a time', async () => {
    useSettings.getState().set({ assistantReadAccess: 'never' });
    expect(await call('list_gallery_images')).toEqual({ ok: false, content: DECLINED });
    useSettings.getState().set({ assistantReadAccess: 'always' });
    expect((await call('list_gallery_images')).ok).toBe(true);
    expect(asked).toEqual([]);
    useSettings.getState().set({ assistantReadAccess: 'ask' });
    answer = 'always';
    const both = await Promise.all([call('list_gallery_images'), call('get_image_info', { name: 'a.png' })]);
    expect(both.every((r) => r.ok)).toBe(true);
    // After "always allow" on the first question the second is not asked.
    expect(asked).toEqual(['list_gallery_images']);
    expect(useSettings.getState().assistantReadAccess).toBe('always');
  });
});

describe('looking at a drawn comic page', () => {
  const onViewer = () => useUi.setState({ activeTab: 'comic', mainView: { ...useUi.getState().mainView, comic: 'viewer' } });

  it('works only on the comic screen, and asks first', async () => {
    const view = vi.fn(async (page: number) => `page-${page}.jpg`);
    registerAgentEditor('comic', { ...editor('comic'), view });
    useUi.setState({ activeTab: 'generate' });
    expect(await call('view_comic_page', { page: 1 })).toMatchObject({ ok: false, content: expect.stringContaining('comic screen') });
    expect(view).not.toHaveBeenCalled();
    onViewer();
    expect(await call('view_comic_page', { page: 2 })).toEqual({ ok: true, content: { page: 2, picture: 'page-2.jpg' } });
    expect(asked).toEqual(['view_comic_page', 'view_comic_page']);
  });

  it('looks at nothing when the user declines, and passes on why a page cannot be shown', async () => {
    const view = vi.fn(async () => {
      throw new Error('Page 3 has no drawn panel yet: draw it first.');
    });
    registerAgentEditor('comic', { ...editor('comic'), view });
    onViewer();
    answer = 'deny';
    expect(await call('view_comic_page', { page: 3 })).toEqual({ ok: false, content: DECLINED });
    expect(view).not.toHaveBeenCalled();
    answer = 'once';
    expect(await call('view_comic_page', { page: 3 })).toMatchObject({ ok: false, content: expect.stringContaining('no drawn panel') });
  });
});

describe('looking facts up on the web', () => {
  const hit = { title: 'Edo period', extract: 'The Edo period lasted 1603-1868.', url: 'https://en.wikipedia.org/wiki/Edo_period' };

  it('asks first, then returns the articles with the licence notice; the question carries the words', async () => {
    const lookup = vi.spyOn(backend, 'lookupReference').mockResolvedValue([hit]);
    const out = await call('lookup_reference', { query: '  Edo   period\n', language: 'en' }, true);
    expect(asked).toEqual(['lookup_reference']);
    expect(askedArgs[0]).toEqual({ query: '  Edo   period\n', language: 'en' });
    expect(lookup).toHaveBeenCalledWith('en', 'Edo   period');
    expect(out).toMatchObject({ ok: true, content: { language: 'en', results: [hit], license: expect.stringContaining('CC BY-SA') } });
  });

  it('is asked about even when the backend does not tag the call, and defaults to Japanese', async () => {
    const lookup = vi.spyOn(backend, 'lookupReference').mockResolvedValue([]);
    const out = await call('lookup_reference', { query: '鎧' });
    expect(asked).toEqual(['lookup_reference']);
    expect(lookup).toHaveBeenCalledWith('ja', '鎧');
    expect(out).toMatchObject({ ok: true, content: { language: 'ja', results: [], note: expect.stringContaining('No article matched') } });
    // Any other language value is treated as Japanese here; the backend schema refuses it before it gets this far.
    await call('lookup_reference', { query: 'x', language: 'fr' });
    expect(lookup).toHaveBeenLastCalledWith('ja', 'x');
  });

  it('a decline looks nothing up and tells the model not to ask again this request', async () => {
    const lookup = vi.spyOn(backend, 'lookupReference');
    answer = 'deny';
    const out = await call('lookup_reference', { query: 'kimono' });
    expect(out).toEqual({ ok: false, content: DECLINED_WEB });
    expect(DECLINED_WEB).toContain('Do not ask for this again in this request');
    expect(DECLINED_WEB).not.toBe(DECLINED);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('an empty query is an error and a failing lookup comes back as a tool error', async () => {
    const lookup = vi.spyOn(backend, 'lookupReference').mockRejectedValue(new Error('Cannot reach Wikipedia'));
    expect(await call('lookup_reference', { query: '   ' })).toMatchObject({ ok: false, content: expect.stringContaining('needs a query') });
    expect(lookup).not.toHaveBeenCalled();
    expect(await call('lookup_reference', { query: 'kimono' })).toEqual({ ok: false, content: 'The tool failed: Cannot reach Wikipedia' });
  });

  it('has its own always-allow: it never rides on the one for pictures, nor the other way round', async () => {
    vi.spyOn(backend, 'lookupReference').mockResolvedValue([hit]);
    useGallery.setState({ images: [] });
    // Always allowing pictures does not allow the web: the question is still asked.
    useSettings.getState().set({ assistantReadAccess: 'always' });
    await call('lookup_reference', { query: 'kimono' });
    expect(asked).toEqual(['lookup_reference']);
    // "Always allow" for the web sets only the web setting.
    useSettings.getState().set({ assistantReadAccess: 'ask' });
    answer = 'always';
    await call('lookup_reference', { query: 'kimono' });
    expect(useSettings.getState().assistantWebAccess).toBe('always');
    expect(useSettings.getState().assistantReadAccess).toBe('ask');
    asked = [];
    expect((await call('lookup_reference', { query: 'kimono' })).ok).toBe(true);
    expect(asked).toEqual([]);
    // The pictures are still asked about.
    await call('list_gallery_images');
    expect(asked).toEqual(['list_gallery_images']);
    // Never for the web refuses without asking, whatever pictures say.
    asked = [];
    useSettings.getState().set({ assistantWebAccess: 'never', assistantReadAccess: 'always' });
    expect(await call('lookup_reference', { query: 'kimono' })).toEqual({ ok: false, content: DECLINED_WEB });
    expect(asked).toEqual([]);
  });
});

describe('extensions', () => {
  const reg = { id: 'foo', name: 'ComfyUI-Foo', description: 'Draws foo', publisher: 'someone', repository: 'https://github.com/someone/ComfyUI-Foo', icon: null, downloads: 1, stars: 1, version: '1.0.0', updated: null, license: null };
  beforeEach(() => useNodePacks.setState({ packs: { available: true, installed: [], comfyVersion: null, restartNeeded: false } }));
  afterEach(() => {
    useRegistry.setState({ nodes: null });
    useNodePacks.setState({ packs: null });
  });

  it('finds the extensions a query names, and the one asked about by id', async () => {
    useRegistry.setState({ nodes: [reg] });
    expect(await call('search_extensions', { query: 'What does ComfyUI-Foo do?' })).toMatchObject({ ok: true, content: { extensions: [{ id: 'ext:ComfyUI-Foo' }] } });
    expect(await call('search_extensions', { ids: ['ext:ComfyUI-Foo'] })).toMatchObject({ content: { extensions: [{ id: 'ext:ComfyUI-Foo', about: 'Draws foo' }] } });
    const plain = await call('search_extensions', {});
    expect((plain.content as { packs: unknown[] }).packs.length).toBeGreaterThan(5);
  });

  it('reads the registry when the query names something and it is not loaded yet, but not otherwise', async () => {
    const read = vi.spyOn(backend, 'registryNodes').mockResolvedValue([reg]);
    await call('search_extensions', { query: '背景を消したい' });
    expect(read).not.toHaveBeenCalled();
    await call('search_extensions', { query: 'ComfyUI-Foo' });
    expect(read).toHaveBeenCalledTimes(1);
    expect(useRegistry.getState().nodes).toEqual([reg]);
  });

  it('shows only known extensions as cards, and changes nothing', async () => {
    useRegistry.setState({ nodes: [reg] });
    expect(await call('recommend_packs', { ids: ['made-up'] })).toMatchObject({ ok: false });
    expect(await call('recommend_packs', { ids: ['rmbg', 'made-up', 'ext:ComfyUI-Foo', 'rmbg'] })).toEqual({ ok: true, content: { shown: ['rmbg', 'ext:ComfyUI-Foo'], unknown: ['made-up'] } });
    expect(run.log).toEqual([{ kind: 'packs', ids: ['rmbg', 'ext:ComfyUI-Foo'] }]);
    expect(run.snapshot).toBeUndefined();
  });
});

describe('what the first tests leave', () => {
  it('words the question of a web look-up: one short line, the language, and nothing for other tools or bad arguments', () => {
    expect(webQuestion('lookup_reference', { query: '  kimono \n  obi  ', language: 'en' })).toEqual({ query: 'kimono obi', language: 'en' });
    expect(webQuestion('lookup_reference', { query: 'x'.repeat(150) }).query).toHaveLength(100);
    expect(webQuestion('lookup_reference', { query: 5, language: 'fr' })).toEqual({ query: '', language: 'ja' });
    expect(webQuestion('lookup_reference', 'text')).toEqual({});
    expect(webQuestion('lookup_reference', null)).toEqual({});
    expect(webQuestion('get_screen', { query: 'x' })).toEqual({});
  });

  it('gives the manga guide, whole or for a topic', async () => {
    const whole = await call('get_manga_guide', {});
    expect(whole.ok).toBe(true);
    const topic = await call('get_manga_guide', { topic: 'no-such-topic-at-all' });
    expect(topic).toHaveProperty('ok');
  });

  it('lists the LoRAs of the settings and of a picture, with their weights', async () => {
    useParams.getState().addLora('l1');
    useParams.getState().updateLora('l1', { weight: 0.7 });
    expect(await call('get_generation_settings', {})).toMatchObject({ content: { loras: [{ key: 'l1', weight: 0.7 }] } });
    const metadata = { positivePrompt: 'p', negativePrompt: '', modelKey: 'm', modelName: 'M', generationMode: 'txt2img', seed: 1, steps: 2, cfgScale: 3, scheduler: 'euler', width: 8, height: 8, loras: [{ key: 'l9', weight: 0.4 }] };
    useGallery.setState({ images: [{ name: 'a.png', url: '', thumbnailUrl: '', width: 8, height: 8, createdAt: 1, boardId: null, starred: false, isIntermediate: false, category: 'general', workflow: null, metadata } as never] });
    expect(await call('get_image_info', { name: 'a.png' })).toMatchObject({ content: { generation: { loras: [{ key: 'l9', weight: 0.4 }] } } });
  });

  it('gives the workflow with the recipes of the extensions that are installed', async () => {
    const recipes = vi.fn((_installed: string[]) => [{ id: 'r' } as never]);
    registerAgentWorkflow(() => ({ dropped: [] }), () => [], recipes);
    registerAgentEditor('workflows', editor('workflows'));
    useNodePacks.setState({ packs: { available: true, installed: [{ folder: 'ComfyUI_IPAdapter_plus', url: 'https://github.com/cubiq/ComfyUI_IPAdapter_plus', version: null }], comfyVersion: null, restartNeeded: false } });
    try {
      await call('get_workflow');
      expect(recipes).toHaveBeenCalledWith(['ipadapter']);
    } finally {
      registerAgentWorkflow(() => ({ dropped: [] }), () => []);
      useNodePacks.setState({ packs: null });
    }
  });
});

describe('drawing the comic', () => {
  const comic = () => {
    const e = editor('comic');
    registerAgentEditor('comic', e);
    return e;
  };

  it('fails without a comic editor, and asks for the panel number when the scope is a panel', async () => {
    registerAgentEditor('comic', undefined as never);
    expect(await call('generate', { target: 'comic' })).toEqual({ ok: false, content: 'The comic is not available.' });
    comic();
    expect(await call('generate', { target: 'comic', scope: 'panel' })).toEqual({ ok: false, content: 'scope panel needs panel.' });
  });

  it('says nothing was queued when the comic has nothing to draw', async () => {
    const e = editor('comic', false);
    registerAgentEditor('comic', e);
    const result = await call('generate', { target: 'comic', scope: 'page' });
    expect(result).toMatchObject({ ok: false, content: expect.stringContaining('Nothing was queued') });
    expect(run.log).toEqual([]);
    expect(e.applied).toEqual([[{ op: 'draw', scope: 'page' }]]);
  });

  it('queues the panels and reports the new queue items once they stop coming', async () => {
    useQueue.setState({ items: [{ id: 1, status: 'completed' } as never] });
    const e = comic();
    const apply = e.apply;
    e.apply = (ops) => {
      useQueue.setState({ items: [...useQueue.getState().items, { id: 5, status: 'waiting' } as never, { id: 6, status: 'waiting' } as never] });
      return apply(ops);
    };
    const result = await call('generate', { target: 'comic', scope: 'panel', panel: 2 });
    expect(result).toMatchObject({ ok: true, content: { queued: [5, 6] } });
    expect(e.applied[0]).toEqual([{ op: 'draw', scope: 'panel', panel: 2 }]);
    expect(run.log).toEqual([{ kind: 'queued', count: 2 }]);
    expect(useUi.getState().activeTab).toBe('comic');
    useQueue.setState({ items: [] });
  });
});
