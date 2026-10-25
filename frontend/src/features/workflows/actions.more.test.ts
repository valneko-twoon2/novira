// @vitest-environment jsdom
// Workflow actions that need more than the library: opening a generation as a graph, copying a default workflow,
// downloading the graph, and a file that waits for custom node packs.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type GenerationMetadata, type ImageDTO, type ModelConfig, type SavedWorkflow } from '@/backend';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { useToasts } from '@/state/toasts';
import { useWorkflowImport } from '@/state/workflows/workflowImport';
import { EMPTY_META, useWorkflows } from '@/state/workflows/workflows';
import { canLoadImageGraph, copyToMyWorkflows, downloadWorkflow, loadImageGraph, loadWorkflowFile, loadWorkflowGraph } from './actions';
import { createNode } from './graph';
import { serializeWorkflow } from './serialize';
import { getTemplate } from './templates';

const initial = { workflows: useWorkflows.getState(), toasts: useToasts.getState(), models: useModels.getState(), importing: useWorkflowImport.getState() };
const lastToast = () => useToasts.getState().toasts.at(-1);

const model = { key: 'm1', name: 'M', base: 'sdxl', type: 'main', format: 'diffusers', description: '', path: '', size: 0, source: '' } as ModelConfig;
const image = (over: Partial<GenerationMetadata> = {}, extra: Partial<ImageDTO> = {}): ImageDTO =>
  ({
    name: 'a.png',
    mediaType: 'image',
    metadata: {
      generationMode: 'txt2img',
      positivePrompt: 'a cat',
      negativePrompt: '',
      modelKey: 'm1',
      modelName: 'M',
      vaeKey: null,
      seed: 1,
      steps: 20,
      cfgScale: 6,
      cfgRescale: 0,
      scheduler: 'euler',
      width: 512,
      height: 512,
      clipSkip: 0,
      seamlessX: false,
      seamlessY: false,
      loras: [],
      ...over,
    },
    ...extra,
  }) as ImageDTO;

beforeEach(() => {
  useWorkflows.setState(initial.workflows, true);
  useToasts.setState(initial.toasts, true);
  useModels.setState({ ...initial.models, models: [model] }, true);
  useWorkflowImport.setState(initial.importing, true);
});
afterEach(() => vi.restoreAllMocks());

describe('a generation as a graph', () => {
  it('can be opened for a plain generation of a known model, and not for a video or without settings', () => {
    expect(canLoadImageGraph(image())).toBe(true);
    expect(canLoadImageGraph(image({}, { mediaType: 'video' }))).toBe(false);
    expect(canLoadImageGraph(image({ modelKey: 'gone' }))).toBe(false);
    expect(canLoadImageGraph({ name: 'x.png', metadata: null } as ImageDTO)).toBe(false);
  });

  it('opens the graph in the editor and says it is loaded', () => {
    loadImageGraph(image());
    expect(useWorkflows.getState().nodes.length).toBeGreaterThan(0);
    expect(lastToast()).toMatchObject({ status: 'success', title: t('workflows.fromImage.loaded') });
  });

  it('warns about the settings the graph could not carry', () => {
    loadImageGraph(image({ clipSkip: 2, cfgRescale: 0.5 }));
    expect(lastToast()?.status).toBe('warning');
    expect(lastToast()?.description).toContain(t('workflows.fromImage.lost.clipSkip'));
  });

  it('warns when the picture cannot be turned into a graph and leaves the editor alone', () => {
    loadImageGraph(image({ modelKey: 'gone' }));
    expect(lastToast()).toMatchObject({ status: 'warning', title: t('workflows.fromImage.unsupported') });
    expect(useWorkflows.getState().nodes).toHaveLength(0);
  });
});

describe('copying a default workflow', () => {
  const stored = (over: Partial<SavedWorkflow> = {}): SavedWorkflow => ({ id: 'd1', name: 'Starter', description: 'desc', author: 'app', tags: ['default', 'photo'], category: 'default', updatedAt: 0, graph: null, ...over });

  it('saves a copy under a new name without the default tag, and adds it to the library', async () => {
    const save = vi.spyOn(backend, 'saveWorkflow').mockImplementation(async (w) => ({ ...(w as object), id: 'u9', category: 'user', updatedAt: 1 }) as SavedWorkflow);
    await copyToMyWorkflows(stored({ graph: serializeWorkflow({ nodes: [createNode(getTemplate('image')!, { x: 0, y: 0 })], edges: [], form: [], meta: { ...EMPTY_META, name: 'Starter' } }) }));
    const sent = save.mock.calls[0]![0];
    expect(sent.name).toBe(t('workflows.library.copyName', { name: 'Starter' }));
    expect(sent.tags).toEqual(['photo']);
    expect(sent.graph).not.toBeNull();
    expect(useWorkflows.getState().library.some((w) => w.id === 'u9')).toBe(true);
    expect(lastToast()?.status).toBe('success');
  });

  it('copies the details when the workflow has no graph to carry, and reports a failed save', async () => {
    const save = vi.spyOn(backend, 'saveWorkflow').mockResolvedValue({ id: 'u1', name: 'n', category: 'user' } as never);
    vi.spyOn(await import('./defaultGraphs'), 'buildDefaultGraph').mockReturnValue(null);
    await copyToMyWorkflows(stored());
    // The backend refuses a graph that is not an object, so a copy with nothing to carry is an empty workflow.
    expect(save.mock.calls[0]![0].graph).toMatchObject({ nodes: [], edges: [] });
    save.mockRejectedValue(new Error('disk full'));
    await copyToMyWorkflows(stored());
    expect(lastToast()).toMatchObject({ status: 'error', description: 'disk full' });
  });
});

describe('downloading the graph', () => {
  it('offers the serialized workflow as a JSON file named after it, with unsafe characters replaced', () => {
    vi.useFakeTimers();
    useWorkflows.getState().setGraph({ nodes: [], edges: [], form: [], meta: { ...EMPTY_META, name: 'My: flow/1' } });
    URL.createObjectURL = vi.fn(() => 'blob:wf');
    URL.revokeObjectURL = vi.fn();
    let download = '';
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      download = this.download;
    });
    downloadWorkflow();
    expect(click).toHaveBeenCalled();
    expect(download).toBe('My_ flow_1.json');
    vi.advanceTimersByTime(1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:wf');
    useWorkflows.getState().setGraph({ nodes: [], edges: [], form: [], meta: { ...EMPTY_META, name: '' } });
    downloadWorkflow();
    expect(download).toBe(`${t('workflows.untitled')}.json`);
    vi.useRealTimers();
  });
});

describe('graphs that need custom node packs', () => {
  const needing = { nodes: [{ id: 'n', data: { type: 'comfy:SomeNode' } }], edges: [], packs: [{ folder: 'ComfyUI-Some', url: 'https://github.com/a/ComfyUI-Some' }], meta: { name: 'Needs packs' } };

  it('waits for the packs instead of failing when a graph is loaded', () => {
    loadWorkflowGraph(needing, 'fallback');
    expect(useWorkflowImport.getState().pending).toMatchObject({ name: 'Needs packs', types: ['comfy:SomeNode'] });
    expect(lastToast()).toBeUndefined();
  });

  it('names the wait after the caller when the graph has no name of its own', () => {
    loadWorkflowGraph({ ...needing, meta: {} }, 'fallback');
    expect(useWorkflowImport.getState().pending?.name).toBe('fallback');
  });

  it('does the same for a file, named after the file', async () => {
    await loadWorkflowFile(new File([JSON.stringify({ ...needing, meta: {} })], 'flow.json'));
    expect(useWorkflowImport.getState().pending?.name).toBe('flow');
    expect(lastToast()).toBeUndefined();
  });
});
