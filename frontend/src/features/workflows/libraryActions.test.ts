// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, type SavedWorkflow } from '@/backend';
import { useToasts } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { useWorkflowImport } from '@/state/workflows/workflowImport';
import { EMPTY_META, useWorkflows } from '@/state/workflows/workflows';
import {
  canSaveInPlace,
  deleteLibraryWorkflow,
  graphForLibraryItem,
  loadWorkflowFile,
  loadWorkflowGraph,
  newWorkflow,
  openLibraryWorkflow,
  saveWorkflow,
  saveWorkflowAs,
} from './actions';
import { createNode } from './graph';
import { serializeWorkflow } from './serialize';
import { getTemplate } from './templates';

const initial = { workflows: useWorkflows.getState(), toasts: useToasts.getState(), ui: useUi.getState(), importing: useWorkflowImport.getState() };
const wfs = () => useWorkflows.getState();
const lastToast = () => useToasts.getState().toasts.at(-1);

const saved = (over: Partial<SavedWorkflow> = {}): SavedWorkflow => ({
  id: 'w1',
  name: 'Mine',
  description: 'd',
  author: 'me',
  tags: ['a', 'default'],
  category: 'user',
  updatedAt: 0,
  graph: null,
  ...over,
});

/** A valid serialized graph with one image-input node. */
function validGraph(name = 'G') {
  const template = getTemplate('image')!;
  const node = createNode(template, { x: 10, y: 20 });
  return serializeWorkflow({ nodes: [node], edges: [], form: [], meta: { ...EMPTY_META, name } });
}

beforeEach(() => {
  useWorkflows.setState(initial.workflows, true);
  useToasts.setState(initial.toasts, true);
  useUi.setState(initial.ui, true);
  useWorkflowImport.setState(initial.importing, true);
});
afterEach(() => vi.restoreAllMocks());

describe('library workflows', { tags: [] }, () => {
  it('builds the editor graph of a stored workflow with the library entry as its identity', { tags: ['equivalence'] }, () => {
    const g = graphForLibraryItem(saved({ graph: validGraph('Stored') }));
    expect(g?.nodes).toHaveLength(1);
    expect(g?.meta).toMatchObject({ name: 'Stored', id: 'w1', category: 'user' });
  });

  it(
    'falls back to the library name when the stored graph has no name, and gives up on a broken graph',
    { tags: ['error-guessing'] },
    () => {
      expect(graphForLibraryItem(saved({ graph: validGraph(''), name: 'Entry' }))?.meta.name).toBe('Entry');
      expect(graphForLibraryItem(saved({ graph: { nodes: 'x' } }))).toBeNull();
    },
  );

  it('opens a stored workflow in the editor and remembers it as recent', { tags: ['state-transition'] }, () => {
    expect(openLibraryWorkflow(saved({ graph: validGraph() }))).toBe(true);
    expect(wfs().nodes).toHaveLength(1);
    expect(wfs().recentIds[0]).toBe('w1');
    expect(useUi.getState().activeTab).toBe('workflows');
  });

  it('opens a user workflow saved without a graph as an empty one with its details', { tags: ['error-guessing', 'boundary'] }, () => {
    expect(openLibraryWorkflow(saved({ graph: { nodes: 'broken' }, tags: ['x', 'y'] }))).toBe(true);
    expect(wfs().nodes).toEqual([]);
    expect(wfs().meta).toMatchObject({ id: 'w1', category: 'user', name: 'Mine', author: 'me', tags: 'x, y' });
  });

  it('refuses a default workflow whose graph is broken, with an error toast', { tags: ['error-guessing'] }, () => {
    expect(openLibraryWorkflow(saved({ category: 'default', graph: { nodes: 'broken' } }))).toBe(false);
    expect(lastToast()?.status).toBe('error');
    expect(wfs().recentIds).toEqual([]);
  });

  it('saves in place only for a user workflow that has an id', { tags: ['condition'] }, () => {
    expect(canSaveInPlace()).toBe(false);
    wfs().markSaved('w1', 'default');
    expect(canSaveInPlace()).toBe(false);
    wfs().markSaved('w1', 'user');
    expect(canSaveInPlace()).toBe(true);
  });
});

describe('loading graphs', { tags: [] }, () => {
  it('loads a valid graph as a new unsaved workflow, named by the caller when the graph has no name', { tags: ['condition'] }, () => {
    loadWorkflowGraph(validGraph(''), 'From image');
    expect(wfs().meta).toMatchObject({ name: 'From image', id: null, category: null });
    expect(lastToast()?.status).toBe('success');
  });

  it('shows an error for an invalid graph and leaves the editor alone', { tags: ['error-guessing'] }, () => {
    loadWorkflowGraph({ nodes: 1 }, 'x');
    expect(lastToast()?.status).toBe('error');
    expect(wfs().nodes).toEqual([]);
  });

  it('starts a fresh empty workflow', { tags: ['state-transition'] }, () => {
    loadWorkflowGraph(validGraph(), 'x');
    newWorkflow();
    expect(wfs().nodes).toEqual([]);
    expect(wfs().meta).toEqual(EMPTY_META);
  });

  it('loads a workflow file, named after the file when it has no name of its own', { tags: ['condition'] }, async () => {
    await loadWorkflowFile(new File([JSON.stringify(validGraph(''))], 'cool.JSON'));
    expect(wfs().meta.name).toBe('cool');
    expect(wfs().isTouched).toBe(true);
  });

  it('rejects a file that is not a workflow, naming the file', { tags: ['error-guessing'] }, async () => {
    await loadWorkflowFile(new File(['not json'], 'bad.json'));
    expect(lastToast()?.status).toBe('error');
    expect(lastToast()?.description).toContain('bad.json');
  });
});

describe('saving and deleting', { tags: [] }, () => {
  const echo = (id = 'w9') => vi.spyOn(backend, 'saveWorkflow').mockImplementation(async (w) => saved({ id: w.id ?? id, name: w.name, tags: w.tags }));

  it('saves a new workflow under a fallback name when the name is blank, and marks it as saved', { tags: ['boundary'] }, async () => {
    loadWorkflowGraph(validGraph(''), '');
    const save = echo();
    await saveWorkflow();
    expect(save.mock.calls[0]![0].id).toBeUndefined();
    expect(save.mock.calls[0]![0].name).not.toBe('');
    expect(wfs().meta).toMatchObject({ id: 'w9', category: 'user' });
    expect(wfs().isTouched).toBe(false);
    expect(wfs().library.map((w) => w.id)).toEqual(['w9']);
    expect(lastToast()?.status).toBe('success');
  });

  it('overwrites a saved user workflow by id, but Save As always creates a new one', { tags: ['condition'] }, async () => {
    loadWorkflowGraph(validGraph('A'), 'A');
    wfs().markSaved('w1', 'user');
    const save = echo();
    await saveWorkflow();
    expect(save.mock.calls[0]![0].id).toBe('w1');
    await saveWorkflowAs('  Copy  ');
    expect(save.mock.calls[1]![0]).toMatchObject({ id: undefined, name: 'Copy' });
    expect(wfs().meta.name).toBe('Copy');
  });

  it('splits the tags on commas and drops empty ones', { tags: ['boundary'] }, async () => {
    loadWorkflowGraph(validGraph('A'), 'A');
    wfs().setMeta({ tags: ' a, ,b ,' });
    const save = echo();
    await saveWorkflow();
    expect(save.mock.calls[0]![0].tags).toEqual(['a', 'b']);
  });

  it('reports a failed save and keeps the workflow unsaved', { tags: ['error-guessing'] }, async () => {
    loadWorkflowGraph(validGraph('A'), 'A');
    vi.spyOn(backend, 'saveWorkflow').mockRejectedValue(new Error('disk full'));
    await saveWorkflow();
    expect(lastToast()).toMatchObject({ status: 'error', description: 'disk full' });
    expect(wfs().meta.id).toBeNull();
  });

  it('deletes a workflow and detaches the open editor from it', { tags: ['state-transition'] }, async () => {
    wfs().upsertLibrary(saved());
    loadWorkflowGraph(validGraph('A'), 'A');
    wfs().markSaved('w1', 'user');
    vi.spyOn(backend, 'deleteWorkflow').mockResolvedValue(undefined);
    await deleteLibraryWorkflow(saved());
    expect(wfs().library).toEqual([]);
    expect(wfs().meta).toMatchObject({ id: null, category: null });
    expect(wfs().nodes).toHaveLength(1);
    expect(lastToast()?.status).toBe('success');
  });

  it('reports a failed delete and keeps the library entry', { tags: ['error-guessing'] }, async () => {
    wfs().upsertLibrary(saved());
    vi.spyOn(backend, 'deleteWorkflow').mockRejectedValue('nope');
    await deleteLibraryWorkflow(saved());
    expect(lastToast()).toMatchObject({ status: 'error', description: 'nope' });
    expect(wfs().library).toHaveLength(1);
  });
});
