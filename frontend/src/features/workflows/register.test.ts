// What the workflows feature hands to the rest of the app: the editor actions, the assistant hooks and the Invoke builder.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import type { AgentEditor } from '@/state/agent';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { useWorkflowImport } from '@/state/workflows/workflowImport';
import { useWorkflows } from '@/state/workflows/workflows';
import { loadWorkflowFile, loadWorkflowGraph } from './actions';
import { useDialogs } from './dialogs';
import { buildTemplate, GRAPH_TEMPLATES } from './graphTemplates';
import { registerWorkflowsFeature } from './register';
import { getTemplate } from './templates';

const captured = vi.hoisted(() => ({
  editor: null as unknown,
  builder: null as unknown,
  opener: null as unknown,
}));

vi.mock('@/state/agent', () => ({
  registerAgentEditor: (_screen: string, editor: unknown) => void (captured.editor = editor),
  registerAgentWorkflow: (open: unknown) => void (captured.opener = open),
  registerAgentExtensionNodes: () => {},
}));
vi.mock('@/state/invoke', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/state/invoke')>()),
  registerInvokeBuilder: (_tab: string, builder: unknown) => void (captured.builder = builder),
}));
vi.mock('./actions', async (importOriginal) => ({ ...(await importOriginal<typeof import('./actions')>()), loadWorkflowGraph: vi.fn(), loadWorkflowFile: vi.fn() }));

const editor = () => captured.editor as AgentEditor;
const builder = () => captured.builder as { readiness: () => string[]; build: (o: { prepend: boolean }) => Promise<unknown>; subscribe: (cb: () => void) => () => void };

beforeEach(() => {
  vi.clearAllMocks();
  useComfyNodes.setState({ defs: null });
  useWorkflowImport.setState({ pending: null });
  registerWorkflowsFeature();
});

describe('pack nodes', () => {
  it('join the catalog when ComfyUI reports its definitions', () => {
    expect(getTemplate('comfy:MockFilmGrain')).toBeUndefined();
    useComfyNodes.setState({ defs: MOCK_NODE_DEFS });
    expect(getTemplate('comfy:MockFilmGrain')).toBeDefined();
  });

  it('open a workflow file that was waiting for them, once they are known', () => {
    const raw = { format: 'novira-workflow', version: 1, meta: { name: 'w' }, nodes: [], edges: [], form: [] };
    useWorkflowImport.getState().set({ raw, name: 'w', packs: [], types: [] });
    useComfyNodes.setState({ defs: MOCK_NODE_DEFS });
    expect(useWorkflowImport.getState().pending).toBeNull();
    expect(loadWorkflowGraph).toHaveBeenCalledTimes(1);
  });
});

describe('store actions', () => {
  it('are filled in for the editor', () => {
    const s = useWorkflows.getState();
    expect([typeof s.loadWorkflow, typeof s.canLoadImage, typeof s.loadImage, typeof s.addImageInput]).toEqual(['function', 'function', 'function', 'function']);
  });

  it('open a picked file at once, or after asking when unsaved changes would be lost', () => {
    const file = new File(['{}'], 'flow.json');
    useWorkflows.setState({ isTouched: false });
    useWorkflows.getState().loadFile(file);
    expect(loadWorkflowFile).toHaveBeenCalledWith(file);
    vi.mocked(loadWorkflowFile).mockClear();
    useWorkflows.setState({ isTouched: true, nodes: [{ id: 'n', type: 'x', position: { x: 0, y: 0 }, data: {} } as never] });
    useWorkflows.getState().loadFile(file);
    expect(loadWorkflowFile).not.toHaveBeenCalled();
    expect(useDialogs.getState().pending).toBeTruthy();
    useDialogs.setState({ pending: null });
    useWorkflows.setState({ isTouched: false, nodes: [] });
  });
});

describe('the assistant hooks', () => {
  it('offers the workflow as context, a snapshot and a restore', () => {
    const snap = editor().snapshot() as { nodes: unknown[] };
    expect(Array.isArray(snap.nodes)).toBe(true);
    expect(editor().context()).toBeTruthy();
    useWorkflows.setState({ nodes: [] });
    editor().restore(snap);
    expect(useWorkflows.getState().nodes).toHaveLength(snap.nodes.length);
  });

  it('applies nothing for operations that change nothing', () => {
    expect(editor().apply([])).toBe(false);
    expect(editor().apply([{ op: 'unknown' }])).toBe(false);
  });

  it('applies operations that take effect', () => {
    expect(editor().apply([{ op: 'addNode', id: 'added', nodeType: 'integer' }])).toBe(true);
    expect(useWorkflows.getState().nodes.some((n) => n.id === 'added')).toBe(true);
  });

  it('opens a workflow the assistant wrote, tolerating a graph that is not an object', () => {
    const opener = captured.opener as (name: string, graph: unknown) => void;
    opener('From chat', 'garbage');
    opener('From chat', { nodes: [], edges: [] });
    expect(loadWorkflowGraph).toHaveBeenCalledTimes(2);
  });
});

describe('the Invoke builder', () => {
  it('reports what is missing, builds a request and tells when the graph changes', async () => {
    expect(Array.isArray(builder().readiness())).toBe(true);
    useWorkflows.setState({ nodes: [], edges: [] });
    expect(builder().readiness().length).toBeGreaterThan(0);
    const onChange = vi.fn();
    const stop = builder().subscribe(onChange);
    useWorkflows.setState({ edges: [] });
    useWorkflows.setState({ nodes: [] });
    expect(onChange).toHaveBeenCalledTimes(2);
    useWorkflows.setState({ isTouched: true });
    expect(onChange).toHaveBeenCalledTimes(2);
    stop();
  });

  it('builds a request for a graph that is ready, and refuses one with nothing to run', async () => {
    await expect(builder().build({ prepend: false })).rejects.toMatchObject({ reason: 'noOutput' });
    const { nodes, edges } = buildTemplate(GRAPH_TEMPLATES.find((t) => t.id === 'text2image')!);
    nodes.find((n) => n.data.type === 'sdxl_model_loader')!.data.inputs.model = 'sdxl-key';
    useWorkflows.setState({ nodes, edges });
    expect(builder().readiness()).toEqual([]);
    await expect(builder().build({ prepend: false })).resolves.toMatchObject({ origin: 'workflows', params: { generationMode: 'graph', modelKey: 'sdxl-key' } });
  });
});
