import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedWorkflow } from '@/backend';
import { DEFAULT_SETTINGS, EMPTY_META, mergeSaved, useWorkflows, type WorkflowEdge, type WorkflowNode } from './workflows';

const initial = useWorkflows.getState();
beforeEach(() => useWorkflows.setState(initial, true));

const w = () => useWorkflows.getState();

const node = (id: string, selected = false): WorkflowNode => ({
  id,
  type: 'invocation',
  position: { x: 0, y: 0 },
  selected,
  data: { type: 'noop', label: '', notes: '', isOpen: true, useCache: true, inputs: {} },
});

const edge = (id: string, source: string, target: string, targetHandle = 'in'): WorkflowEdge => ({ id, source, target, sourceHandle: 'out', targetHandle });

const load = (nodes: WorkflowNode[], edges: WorkflowEdge[] = []) => w().setGraph({ nodes, edges, meta: { ...EMPTY_META }, form: [] });

describe('workflow editor store', () => {
  it('loading a graph clears the touched flag and bumps the refit nonce', () => {
    w().setMeta({ name: 'x' });
    const nonce = w().graphNonce;
    load([node('a')]);
    expect(w().isTouched).toBe(false);
    expect(w().graphNonce).toBe(nonce + 1);
    w().setGraph({ nodes: [], edges: [], meta: { ...EMPTY_META }, form: [] }, { touched: true });
    expect(w().isTouched).toBe(true);
  });

  it('replaces the edge already plugged into the same input', () => {
    load([node('a'), node('b'), node('c')], [edge('e1', 'a', 'c')]);
    w().connect(edge('e2', 'b', 'c'));
    w().connect(edge('e3', 'a', 'c', 'other'));
    expect(w().edges.map((e) => e.id)).toEqual(['e2', 'e3']);
    expect(w().isTouched).toBe(true);
  });

  it('removing a node drops its edges and form fields', () => {
    load([node('a'), node('b'), node('c')], [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')]);
    w().addFormField({ nodeId: 'a', fieldName: 'x' });
    w().addFormField({ nodeId: 'c', fieldName: 'y' });
    w().onNodesChange([{ type: 'remove', id: 'a' }]);
    expect(w().nodes.map((n) => n.id)).toEqual(['b', 'c']);
    expect(w().edges.map((e) => e.id)).toEqual(['e2']);
    expect(w().form).toEqual([{ nodeId: 'c', fieldName: 'y' }]);
  });

  it('selection and dimension changes do not mark the graph as touched', () => {
    load([node('a')]);
    w().onNodesChange([{ type: 'select', id: 'a', selected: true }]);
    w().onNodesChange([{ type: 'dimensions', id: 'a', dimensions: { width: 10, height: 10 } }]);
    w().onNodesChange([{ type: 'position', id: 'a', dragging: false }]);
    expect(w().isTouched).toBe(false);
    w().onNodesChange([{ type: 'position', id: 'a', position: { x: 5, y: 5 } }]);
    expect(w().isTouched).toBe(true);
  });

  it('pasted nodes take over the selection', () => {
    load([node('a', true)]);
    w().addNodes([node('b', true)]);
    expect(w().nodes.map((n) => [n.id, n.selected])).toEqual([
      ['a', false],
      ['b', true],
    ]);
  });

  it('sets a field value without touching the other inputs', () => {
    load([node('a')]);
    w().setFieldValue('a', 'steps', 20);
    w().setFieldValue('a', 'cfg', 7);
    expect(w().nodes[0]!.data.inputs).toEqual({ steps: 20, cfg: 7 });
  });

  it('adds a form field once and reorders within bounds', () => {
    const f = (fieldName: string) => ({ nodeId: 'a', fieldName });
    w().addFormField(f('x'));
    w().addFormField(f('x'));
    w().addFormField(f('y'));
    w().addFormField(f('z'));
    expect(w().form.map((x) => x.fieldName)).toEqual(['x', 'y', 'z']);
    w().moveFormField(0, 1);
    expect(w().form.map((x) => x.fieldName)).toEqual(['y', 'x', 'z']);
    w().moveFormField(2, 1);
    w().moveFormField(0, -1);
    expect(w().form.map((x) => x.fieldName)).toEqual(['y', 'x', 'z']);
    w().removeFormField(f('x'));
    expect(w().form.map((x) => x.fieldName)).toEqual(['y', 'z']);
  });

  it('saving records the library id and clears the touched flag', () => {
    w().setMeta({ name: 'Mine' });
    w().markSaved('wf-1', 'user');
    expect(w().meta).toMatchObject({ id: 'wf-1', category: 'user', name: 'Mine' });
    expect(w().isTouched).toBe(false);
  });

  it('keeps the 20 most recent workflows without duplicates', () => {
    for (let i = 0; i < 25; i++) w().pushRecent(`w${i}`);
    w().pushRecent('w10');
    expect(w().recentIds).toHaveLength(20);
    expect(w().recentIds[0]).toBe('w10');
    expect(w().recentIds.filter((id) => id === 'w10')).toHaveLength(1);
  });

  it('removing a library workflow also drops it from the recent list', () => {
    const wf = (id: string) => ({ id, name: id }) as SavedWorkflow;
    w().upsertLibrary(wf('a'));
    w().upsertLibrary(wf('b'));
    w().upsertLibrary({ ...wf('a'), name: 'renamed' });
    expect(w().library.map((x) => x.name)).toEqual(['renamed', 'b']);
    w().pushRecent('a');
    w().removeFromLibrary('a');
    expect(w().library.map((x) => x.id)).toEqual(['b']);
    expect(w().recentIds).toEqual([]);
  });
});

describe('workflow editor undo history', () => {
  afterEach(() => vi.useRealTimers());

  it('undoes and redoes structural edits one step at a time', () => {
    load([node('a'), node('b')]);
    w().connect(edge('e1', 'a', 'b'));
    w().addNodes([node('c')], [edge('e2', 'b', 'c')]);
    expect(w().past).toHaveLength(2);
    w().undo();
    expect(w().nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(w().edges.map((e) => e.id)).toEqual(['e1']);
    w().undo();
    expect(w().edges).toEqual([]);
    w().undo();
    expect(w().edges).toEqual([]);
    w().redo();
    w().redo();
    expect(w().nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(w().edges.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(w().isTouched).toBe(true);
  });

  it('a new edit after an undo clears the redo stack', () => {
    load([node('a'), node('b')]);
    w().connect(edge('e1', 'a', 'b'));
    w().undo();
    w().connect(edge('e2', 'a', 'b', 'other'));
    expect(w().future).toEqual([]);
    w().redo();
    expect(w().edges.map((e) => e.id)).toEqual(['e2']);
  });

  it('commitGraph replaces nodes, edges and form as one undo step', () => {
    load([node('a'), node('b')], [edge('e1', 'a', 'b')]);
    w().commitGraph({ nodes: [node('a')], edges: [], form: [] });
    expect(w().nodes.map((n) => n.id)).toEqual(['a']);
    expect(w().isTouched).toBe(true);
    w().undo();
    expect(w().nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(w().edges.map((e) => e.id)).toEqual(['e1']);
  });

  it('typing into one field becomes one undo step', () => {
    vi.useFakeTimers();
    load([node('a')]);
    w().setFieldValue('a', 'prompt', 'c');
    vi.advanceTimersByTime(200);
    w().setFieldValue('a', 'prompt', 'ca');
    vi.advanceTimersByTime(200);
    w().setFieldValue('a', 'prompt', 'cat');
    expect(w().past).toHaveLength(1);
    vi.advanceTimersByTime(1500);
    w().setFieldValue('a', 'prompt', 'cats');
    expect(w().past).toHaveLength(2);
    w().undo();
    expect(w().nodes[0]!.data.inputs.prompt).toBe('cat');
  });

  it('removing a node and its edges together is one undo step', () => {
    load([node('a'), node('b')], [edge('e1', 'a', 'b')]);
    w().onEdgesChange([{ type: 'remove', id: 'e1' }]);
    w().onNodesChange([{ type: 'remove', id: 'a' }]);
    expect(w().past).toHaveLength(1);
    w().undo();
    expect(w().nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(w().edges.map((e) => e.id)).toEqual(['e1']);
  });

  it('a drag is saved once, when it starts', () => {
    load([node('a')]);
    w().onNodesChange([{ type: 'position', id: 'a', position: { x: 5, y: 5 }, dragging: true }]);
    w().onNodesChange([{ type: 'position', id: 'a', position: { x: 50, y: 50 }, dragging: true }]);
    w().onNodesChange([{ type: 'position', id: 'a', dragging: false }]);
    expect(w().past).toHaveLength(1);
    w().undo();
    expect(w().nodes[0]!.position).toEqual({ x: 0, y: 0 });
  });

  it('loading another graph clears the history', () => {
    load([node('a'), node('b')]);
    w().connect(edge('e1', 'a', 'b'));
    load([node('x')]);
    expect(w().past).toEqual([]);
    w().undo();
    expect(w().nodes.map((n) => n.id)).toEqual(['x']);
  });

  it('counts structural edits, but not moves, field edits, undo or loads', () => {
    load([node('a'), node('b')]);
    const n0 = w().structureNonce;
    w().connect(edge('e1', 'a', 'b'));
    w().addNodes([node('c')]);
    w().onNodesChange([{ type: 'remove', id: 'c' }]);
    w().onEdgesChange([{ type: 'remove', id: 'e1' }]);
    expect(w().structureNonce).toBe(n0 + 4);
    w().onNodesChange([{ type: 'position', id: 'a', position: { x: 9, y: 9 }, dragging: true }]);
    w().setFieldValue('a', 'v', 1);
    w().undo();
    load([node('a')]);
    expect(w().structureNonce).toBe(n0 + 4);
  });

  it('an edge added with new nodes replaces the edge already in that input', () => {
    load([node('a'), node('b')], [edge('e1', 'a', 'b')]);
    w().addNodes([node('c')], [edge('e2', 'c', 'b')]);
    expect(w().edges.map((e) => e.id)).toEqual(['e2']);
    w().undo();
    expect(w().edges.map((e) => e.id)).toEqual(['e1']);
  });
});

describe('workflow editor settings', () => {
  it('does not tidy automatically, and animates the lines, by default', () => {
    expect(DEFAULT_SETTINGS.autoTidy).toBe(false);
    expect(w().settings.autoTidy).toBe(false);
    expect(DEFAULT_SETTINGS.animatedEdges).toBe(true);
  });

  it('settings saved before a setting existed keep its default', () => {
    const merged = mergeSaved({ settings: { showMinimap: false }, recentIds: ['r'] }, w());
    expect(merged.settings).toEqual({ ...DEFAULT_SETTINGS, showMinimap: false });
    expect(merged.recentIds).toEqual(['r']);
  });
});
