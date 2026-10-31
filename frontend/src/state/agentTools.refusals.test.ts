// @vitest-environment jsdom
// What the dispatcher refuses or leaves alone: arguments of the wrong type or out of range, screens whose editor is
// not there, a read that is not allowed, and calls that name one thing change only that thing. The backend's schema
// check normally stops bad arguments first; the frontend must still not act on them.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type AgentToolCall } from '@/backend';
import { registerAgentEditor, registerAgentWorkflow, type AgentEditor } from './agentRegistry';
import { createToolRun, DECLINED, runAgentTool, type ToolRun } from './agentTools';
import { useNodePacks } from './comfy/nodePacks';
import { useRegistry } from './comfy/registry';
import { useGallery } from './gallery';
import { useModels } from './models';
import { useParams } from './params';
import { useSettings } from './settings';
import { useUi } from './ui';

const enqueue = vi.hoisted(() => vi.fn());
vi.mock('./invoke', () => ({ enqueueActive: enqueue }));

const initial = { ui: useUi.getState(), models: useModels.getState(), params: useParams.getState() };

/** A fake editor that records what it is given. */
function editor(name: string): AgentEditor & { applied: unknown[][]; snapshots: number } {
  const e = {
    applied: [] as unknown[][],
    snapshots: 0,
    context: () => ({ editor: name }),
    apply: (ops: unknown[]) => {
      e.applied.push(ops);
      return true;
    },
    snapshot: () => {
      e.snapshots++;
      return { before: name };
    },
    restore: () => undefined,
  };
  return e;
}

/** The settings a tool may change, to compare before and after. */
const settings = () => {
  const p = useParams.getState();
  return { positivePrompt: p.positivePrompt, negativePrompt: p.negativePrompt, steps: p.steps, cfgScale: p.cfgScale, width: p.width, height: p.height, aspectRatio: p.aspectRatio, scheduler: p.scheduler, seed: p.seed, shouldRandomizeSeed: p.shouldRandomizeSeed, loras: p.loras };
};

let asked: string[] = [];
let run: ToolRun;
const call = (tool: string, args: unknown = {}) => runAgentTool({ callId: 'c-1', tool, args, readGated: false } satisfies AgentToolCall, run);

beforeEach(() => {
  asked = [];
  run = createToolRun(async (tool) => {
    asked.push(tool);
    return 'once';
  });
  useUi.setState(initial.ui, true);
  useModels.setState(initial.models, true);
  useParams.setState(initial.params, true);
  useSettings.getState().set({ assistantReadAccess: 'ask', assistantWebAccess: 'ask' });
});
afterEach(() => vi.restoreAllMocks());

describe('the Generate tab settings', () => {
  it('refuses a call with nothing it can use, whatever shape the arguments have, and changes nothing', async () => {
    const before = settings();
    for (const args of [{ steps: '20', cfgScale: null, width: '512', seed: '5', positivePrompt: 42, negativePrompt: ['x'] }, null, ['steps', 20], 'steps 20']) {
      expect(await call('set_generation_settings', args)).toEqual({ ok: false, content: 'Nothing to set.' });
    }
    expect(settings()).toEqual(before);
    expect(run.snapshot).toBeUndefined();
    expect(run.log).toEqual([]);
  });

  it('keeps a size within 64 to 4096 on the grid of 8, and rounds steps and the seed', async () => {
    expect(await call('set_generation_settings', { width: 10, height: 9000, steps: 12.6, seed: 7.4 })).toMatchObject({ ok: true });
    expect(useParams.getState()).toMatchObject({ width: 64, height: 4096, steps: 13, seed: 7, shouldRandomizeSeed: false, aspectRatio: 'free' });
    expect(run.log).toEqual([{ kind: 'params', summary: '64×4096 / 13 steps / seed 7' }]);
  });

  it('changes only the negative prompt and CFG when only those are given, after keeping the settings', async () => {
    useParams.getState().set({ positivePrompt: 'a cat', negativePrompt: 'blur', cfgScale: 7 });
    const before = settings();
    expect(await call('set_generation_settings', { negativePrompt: 'lowres', cfgScale: 4.5 })).toEqual({ ok: true, content: { set: ['negativePrompt', 'cfgScale'] } });
    expect(settings()).toEqual({ ...before, negativePrompt: 'lowres', cfgScale: 4.5 });
    expect(run.snapshot).toMatchObject({ positivePrompt: 'a cat', negativePrompt: 'blur', cfgScale: 7 });
    expect(run.log).toEqual([{ kind: 'prompt' }, { kind: 'params', summary: 'CFG 4.5' }]);
  });

  it('adds a LoRA at 0.8 when no usable weight is given, keeps a weight within -1 to 2, and refuses a key that is not a LoRA', async () => {
    useModels.setState({ models: ['l1', 'l2', 'l3', 'l4'].map((key) => ({ key, name: key, type: 'lora', base: 'sdxl' }) as never) });
    expect(await call('add_lora', { key: 7 })).toMatchObject({ ok: false, content: expect.stringContaining('No LoRA has the key 7') });
    expect(useParams.getState().loras).toEqual([]);
    expect(run.snapshot).toBeUndefined();
    await call('add_lora', { key: 'l1' });
    await call('add_lora', { key: 'l2', weight: '1' });
    await call('add_lora', { key: 'l3', weight: 5 });
    await call('add_lora', { key: 'l4', weight: -3 });
    expect(useParams.getState().loras.map((l) => [l.key, l.weight])).toEqual([['l1', 0.8], ['l2', 0.8], ['l3', 2], ['l4', -1]]);
    expect(run.log.map((l) => (l.kind === 'lora' ? l.weight : null))).toEqual([0.8, 0.8, 2, -1]);
  });

  it('never gives the prompts for an includePrompts that is not true, and gives none when reading is not allowed', async () => {
    useParams.getState().set({ positivePrompt: 'secret', negativePrompt: 'also secret' });
    const loose = await call('get_generation_settings', { includePrompts: 'yes' });
    expect(loose.ok).toBe(true);
    expect(loose.content).not.toHaveProperty('positivePrompt');
    expect(loose.content).not.toHaveProperty('negativePrompt');
    expect(asked).toEqual([]);
    useSettings.getState().set({ assistantReadAccess: 'never' });
    expect(await call('get_generation_settings', { includePrompts: true })).toEqual({ ok: false, content: DECLINED });
    expect(asked).toEqual([]);
  });

  it('tells the model when queuing failed, and logs nothing', async () => {
    enqueue.mockResolvedValueOnce({ error: 'The engine is not running.' });
    expect(await call('generate', { target: 'screen' })).toEqual({ ok: false, content: 'Queuing failed: The engine is not running.' });
    expect(run.log).toEqual([]);
  });
});

describe('the forms and editors', () => {
  const screens = { video: editor('video'), music: editor('music'), canvas: editor('canvas') };
  beforeEach(() => {
    for (const [screen, e] of Object.entries(screens)) {
      e.applied.length = 0;
      e.snapshots = 0;
      registerAgentEditor(screen as never, e);
    }
    useUi.setState({ activeTab: 'models', media: 'image' });
  });

  it('refuses a form of an unknown kind or fields that are not an object, and reaches no editor', async () => {
    for (const args of [{ kind: 'image', fields: { seconds: 3 } }, { kind: 'video', fields: ['seconds', 3] }, { kind: 'video', fields: null }, { kind: 'video' }, { fields: { seconds: 3 } }]) {
      expect(await call('set_form', args)).toEqual({ ok: false, content: 'set_form needs kind and fields.' });
    }
    for (const args of [{ kind: 'image' }, {}]) expect(await call('get_form', args)).toEqual({ ok: false, content: 'This form is not available.' });
    expect(Object.values(screens).map((e) => [e.applied, e.snapshots])).toEqual([[[], 0], [[], 0], [[], 0]]);
    expect(run.editSnapshots).toEqual({});
    expect(run.log).toEqual([]);
    expect(useUi.getState()).toMatchObject({ activeTab: 'models', media: 'image' });
  });

  it('never passes people that are not a list on to the canvas, nor an add that is not true', async () => {
    await call('set_pose', { people: 'two people', add: 'yes' });
    expect(screens.canvas.applied).toEqual([[{ people: [], add: false }]]);
    expect(run.log).toEqual([{ kind: 'pose', count: 0 }]);
  });

  it('says a screen is not there when its editor is not registered, and changes or opens nothing', async () => {
    for (const screen of ['text', 'canvas', 'video'] as const) registerAgentEditor(screen, undefined as never);
    expect(await call('edit_text', { ops: [{ op: 'remove' }] })).toEqual({ ok: false, content: 'This editor is not available.' });
    expect(await call('set_pose', { people: [{ x: 0.5 }] })).toEqual({ ok: false, content: 'This editor is not available.' });
    expect(await call('set_form', { kind: 'video', fields: { seconds: 3 } })).toEqual({ ok: false, content: 'This editor is not available.' });
    expect(await call('get_text_scene')).toEqual({ ok: false, content: 'The text editor is not available.' });
    expect(await call('get_pose')).toEqual({ ok: false, content: 'The canvas is not available.' });
    expect(await call('get_form', { kind: 'video' })).toEqual({ ok: false, content: 'This form is not available.' });
    expect(screens.canvas.applied).toEqual([]);
    expect(screens.video.applied).toEqual([]);
    expect(run.editSnapshots).toEqual({});
    expect(run.log).toEqual([]);
    expect(useUi.getState()).toMatchObject({ activeTab: 'models', media: 'image' });
  });

  it('answers graph null when no workflow editor is there, before and after opening a graph', async () => {
    registerAgentEditor('workflows', undefined as never);
    registerAgentWorkflow(() => ({ dropped: [] }), () => []);
    expect(await call('get_workflow')).toMatchObject({ ok: true, content: { graph: null } });
    expect(await call('create_workflow', { name: 'Flow', graph: { nodes: [], edges: [] } })).toEqual({ ok: true, content: { opened: 'Flow', now: null } });
  });
});

describe('the gallery details', () => {
  const image = (name: string, metadata: unknown) =>
    ({ name, url: '', thumbnailUrl: '', width: 8, height: 8, createdAt: 1, boardId: null, starred: false, isIntermediate: false, category: 'general', workflow: null, metadata }) as never;
  beforeEach(() => useSettings.getState().set({ assistantReadAccess: 'always' }));

  it('shortens a prompt to 300 characters in the list and 4000 in the details, and names a model without a name by its key', async () => {
    const prompt = 'p'.repeat(5000);
    useGallery.setState({ images: [image('a.png', { positivePrompt: prompt, negativePrompt: '', modelKey: 'm-key', generationMode: 'txt2img', seed: 1, steps: 2, cfgScale: 3, scheduler: 'euler', width: 8, height: 8 })] });
    const listed = (await call('list_gallery_images')).content as { images: { prompt: string; model: string }[] };
    expect(listed.images[0]!.prompt).toHaveLength(300);
    expect(listed.images[0]!.model).toBe('m-key');
    const info = (await call('get_image_info', { name: 'a.png' })).content as { prompt: string; model: string; generation: { model: string } };
    expect(info.prompt).toHaveLength(4000);
    expect(info.model).toBe('m-key');
    expect(info.generation.model).toBe('m-key');
  });

  it('lists and describes a picture without generation info, and a search never matches it', async () => {
    useGallery.setState({ images: [image('plain.png', undefined)] });
    const listed = await call('list_gallery_images');
    expect(listed).toMatchObject({ ok: true, content: { total: 1, images: [{ name: 'plain.png', kind: 'image' }] } });
    expect((listed.content as { images: object[] }).images[0]).not.toHaveProperty('prompt');
    expect(await call('list_gallery_images', { search: 'cat' })).toEqual({ ok: true, content: { total: 0, images: [] } });
    const info = await call('get_image_info', { name: 'plain.png' });
    expect(info).toMatchObject({ ok: true, content: { name: 'plain.png' } });
    expect(info.content).not.toHaveProperty('generation');
  });
});

describe('extensions', () => {
  const reg = { id: 'foo', name: 'ComfyUI-Foo', description: 'Draws foo', publisher: 'someone', repository: 'https://github.com/someone/ComfyUI-Foo', icon: null, downloads: 1, stars: 1, version: '1.0.0', updated: null, license: null };
  beforeEach(() => useNodePacks.setState({ packs: { available: true, installed: [], comfyVersion: null, restartNeeded: false } }));
  afterEach(() => {
    useRegistry.setState({ nodes: null });
    useNodePacks.setState({ packs: null });
  });

  it('shows no card for ids that are not a list of strings', async () => {
    for (const args of [{ ids: 'rmbg' }, { ids: [1, null] }, {}]) expect(await call('recommend_packs', args)).toMatchObject({ ok: false, content: expect.stringContaining('None of these ids') });
    expect(run.log).toEqual([]);
  });

  it('knows the suggested packs before the registry is read, never reads it, and lists no unknown when every id is known', async () => {
    const read = vi.spyOn(backend, 'registryNodes');
    expect(await call('recommend_packs', { ids: ['rmbg', 'ext:ComfyUI-Foo'] })).toEqual({ ok: true, content: { shown: ['rmbg'], unknown: ['ext:ComfyUI-Foo'] } });
    expect(await call('recommend_packs', { ids: ['rmbg'] })).toEqual({ ok: true, content: { shown: ['rmbg'] } });
    expect(read).not.toHaveBeenCalled();
    expect(run.log).toEqual([{ kind: 'packs', ids: ['rmbg'] }, { kind: 'packs', ids: ['rmbg'] }]);
  });

  it('takes a bare folder name as an extension id', async () => {
    useRegistry.setState({ nodes: [reg] });
    expect(await call('search_extensions', { ids: ['ComfyUI-Foo'] })).toMatchObject({ ok: true, content: { extensions: [{ id: 'ext:ComfyUI-Foo', about: 'Draws foo' }] } });
  });
});

describe('the dispatcher', () => {
  it('answers a tool that throws something other than an Error with a tool error', async () => {
    registerAgentEditor('text', {
      ...editor('text'),
      context: () => {
        throw 'boom';
      },
    });
    expect(await call('get_text_scene')).toEqual({ ok: false, content: 'The tool failed: boom' });
  });

  it('passes an empty answer on as it is', async () => {
    registerAgentEditor('text', { ...editor('text'), context: () => undefined });
    expect(await call('get_text_scene')).toEqual({ ok: true, content: undefined });
  });
});
