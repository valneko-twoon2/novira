import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CORE_NODE_DEFS } from '@/backend/mock/comfyCoreDefs';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { EMPTY_META, type EditorGraph } from '@/state/workflows/workflows';
import { applyWorkflowOps, checkAssistantGraph, cleanedAssistantGraph, editedGraph, workflowContext } from './aiOps';
import { comfyTemplates } from './comfyNodes';
import { createNode, makeEdge } from './graph';
import { serializeWorkflow } from './serialize';
import { NODE_TEMPLATES, setExtensionTemplates } from './templates';

/** Two node types that can be connected: any output with an input of the same type on another template. */
function pair() {
  for (const a of NODE_TEMPLATES) {
    for (const out of a.outputs) {
      for (const b of NODE_TEMPLATES) {
        const input = b.inputs.find((i) => i.type === out.type);
        if (input && a.type !== b.type) return { a, out: out.name, b, input: input.name };
      }
    }
  }
  throw new Error('no connectable templates');
}

function graph(): EditorGraph {
  const { a, b } = pair();
  return { nodes: [createNode(a, { x: 0, y: 0 }, { id: 'a' }), createNode(b, { x: 300, y: 0 }, { id: 'b' })], edges: [], meta: { ...EMPTY_META, name: 'flow' }, form: [] };
}

describe('workflow operations from the assistant', () => {
  it('adds a node with default inputs overridden by the given ones', () => {
    const { a } = pair();
    const field = a.inputs.find((i) => i.input !== 'connection')?.name;
    const s = serializeWorkflow(graph());
    const r = applyWorkflowOps(s, [{ op: 'addNode', id: 'n3', nodeType: a.type, position: { x: 10.4, y: 20 }, inputs: field ? { [field]: 'changed' } : {} }]);
    expect(r.applied).toBe(1);
    const node = r.graph.nodes.find((n) => n.id === 'n3')!;
    expect(node.position).toEqual({ x: 10, y: 20 });
    if (field) expect(node.data.inputs[field]).toBe('changed');
  });

  it('refuses unknown node types, duplicate ids and a missing id', () => {
    const s = serializeWorkflow(graph());
    const { a } = pair();
    const r = applyWorkflowOps(s, [{ op: 'addNode', id: 'x', nodeType: 'no_such_node' }, { op: 'addNode', id: 'a', nodeType: a.type }, { op: 'addNode', nodeType: a.type }]);
    expect(r.applied).toBe(0);
    expect(r.graph.nodes).toHaveLength(2);
  });

  it('sets inputs without losing the others, and moves and removes nodes with their connections', () => {
    const { a, out, b, input } = pair();
    const g = graph();
    g.edges = [makeEdge('a', out, 'b', input)];
    const field = a.inputs.find((i) => i.input !== 'connection')?.name;
    const s = serializeWorkflow(g);
    const before = s.nodes.find((n) => n.id === 'a')!.data.inputs;
    const r = applyWorkflowOps(s, [
      ...(field ? [{ op: 'setInputs', id: 'a', inputs: { [field]: 'v' } }] : []),
      { op: 'move', id: 'b', position: { x: 500, y: 40 } },
    ]);
    const node = r.graph.nodes.find((n) => n.id === 'a')!;
    if (field) {
      expect(node.data.inputs[field]).toBe('v');
      expect(Object.keys(node.data.inputs)).toEqual(Object.keys(before));
    }
    expect(r.graph.nodes.find((n) => n.id === 'b')!.position).toEqual({ x: 500, y: 40 });
    const removed = applyWorkflowOps(s, [{ op: 'removeNode', id: 'a' }]);
    expect(removed.graph.nodes.map((n) => n.id)).toEqual(['b']);
    expect(removed.graph.edges).toHaveLength(0);
    expect(b.type).toBeTruthy();
  });

  it('connects, replacing an earlier connection into the same input, and disconnects', () => {
    const { out, input } = pair();
    const s = serializeWorkflow(graph());
    const edge = { source: 'a', sourceHandle: out, target: 'b', targetHandle: input };
    const once = applyWorkflowOps(s, [{ op: 'connect', ...edge }]);
    expect(once.graph.edges).toHaveLength(1);
    const twice = applyWorkflowOps(once.graph, [{ op: 'connect', ...edge }]);
    expect(twice.graph.edges).toHaveLength(1);
    expect(applyWorkflowOps(twice.graph, [{ op: 'disconnect', ...edge }]).graph.edges).toHaveLength(0);
    expect(applyWorkflowOps(s, [{ op: 'connect', ...edge, target: 'missing' }]).applied).toBe(0);
    expect(applyWorkflowOps(s, [{ op: 'connect', ...edge, target: 'a' }]).applied).toBe(0);
  });

  it('builds the edited editor graph through the normal parser and keeps the library details', () => {
    const { out, input } = pair();
    const g = { ...graph(), meta: { ...EMPTY_META, id: 'lib1', category: 'user' as const, name: 'mine' } };
    const edited = editedGraph(g, [{ op: 'connect', source: 'a', sourceHandle: out, target: 'b', targetHandle: input }]);
    expect(edited?.applied).toBe(1);
    expect(edited?.graph.edges).toHaveLength(1);
    expect(edited?.graph.meta).toEqual(g.meta);
  });

  it('drops a connection to an input or output that does not exist when the graph is parsed', () => {
    const g = graph();
    const edited = editedGraph(g, [{ op: 'connect', source: 'a', sourceHandle: 'no_such_output', target: 'b', targetHandle: 'no_such_input' }]);
    expect(edited?.graph.edges).toHaveLength(0);
  });

  it('says why an operation was left out: an unknown node type, a repeated id, a missing node, a connection that does not fit', () => {
    const { a, out, input } = pair();
    const s = serializeWorkflow(graph());
    const r = applyWorkflowOps(s, [
      { op: 'addNode', id: 'x', nodeType: 'no_such_node' },
      { op: 'addNode', id: 'a', nodeType: a.type },
      { op: 'addNode', nodeType: a.type },
      { op: 'setInputs', id: 'ghost', inputs: {} },
      { op: 'move', id: 'ghost' },
      { op: 'removeNode', id: 'ghost' },
      { op: 'connect', source: 'a', sourceHandle: 'no_such_output', target: 'b', targetHandle: input },
      { op: 'connect', source: 'a', sourceHandle: out, target: 'b', targetHandle: 'no_such_input' },
      { op: 'connect', source: 'a', sourceHandle: out, target: 'a', targetHandle: input },
      { op: 'disconnect', source: 'a', sourceHandle: out, target: 'b', targetHandle: input },
      { op: 'fly' },
      'nope',
    ]);
    expect(r.applied).toBe(0);
    expect(r.skipped).toEqual([
      expect.stringContaining('op 1 (addNode): there is no node type "no_such_node"; find one with search_comfy_nodes'),
      'op 2 (addNode): a node with the id "a" exists already',
      'op 3 (addNode): a node needs an id',
      'op 4 (setInputs): there is no node "ghost"',
      'op 5 (move): there is no node "ghost"',
      'op 6 (removeNode): there is no node "ghost"',
      expect.stringContaining('op 7 (connect): a.no_such_output -> b.' + input + ': ' + a.type + ' has no output named "no_such_output"'),
      expect.stringContaining('has no input named "no_such_input"'),
      'op 9 (connect): a.' + out + ' -> a.' + input + ': a node cannot feed itself',
      'op 10 (disconnect): there is no such connection',
      expect.stringContaining('op 11 (fly): unknown operation'),
      'op 12: not an object with an "op"',
    ]);
    expect(applyWorkflowOps(s, [{ op: 'connect', source: 'a', sourceHandle: out, target: 'b', targetHandle: input }]).skipped).toEqual([]);
  });

  it('refuses a connection between types that do not fit instead of leaving it to be dropped later', () => {
    const [x, y] = [NODE_TEMPLATES.find((t) => t.outputs.some((o) => o.type === 'ImageField'))!, NODE_TEMPLATES.find((t) => t.inputs.some((i) => i.type === 'LatentsField' && i.input === 'connection'))!];
    const g = { nodes: [createNode(x, { x: 0, y: 0 }, { id: 'x' }), createNode(y, { x: 0, y: 0 }, { id: 'y' })], edges: [], meta: { ...EMPTY_META }, form: [] };
    const r = applyWorkflowOps(serializeWorkflow(g), [{ op: 'connect', source: 'x', sourceHandle: x.outputs.find((o) => o.type === 'ImageField')!.name, target: 'y', targetHandle: y.inputs.find((i) => i.type === 'LatentsField')!.name }]);
    expect(r.applied).toBe(0);
    expect(r.skipped[0]).toMatch(/a ImageField output cannot feed a LatentsField input/);
  });

  it('says which values a node took no typed value for, in an added node and a changed one', () => {
    const { a } = pair();
    const s = serializeWorkflow(graph());
    const added = applyWorkflowOps(s, [{ op: 'addNode', id: 'n', nodeType: a.type, inputs: { nonsense: 1 } }]);
    expect(added.applied).toBe(1);
    expect(added.skipped).toEqual([`op 1 (addNode): the node was added, but ${a.type} takes no typed value for: nonsense`]);
    const set = applyWorkflowOps(added.graph, [{ op: 'setInputs', id: 'n', inputs: { nonsense: 2 } }]);
    expect(set.skipped).toEqual([`op 1 (setInputs): ${a.type} takes no typed value for: nonsense`]);
  });

  it('describes the graph to the assistant', () => {
    const ctx = workflowContext(graph()) as { name: string; nodes: { id: string; type: string }[] };
    expect(ctx.name).toBe('flow');
    expect(ctx.nodes.map((n) => n.id)).toEqual(['a', 'b']);
  });
});

describe('a whole graph from the assistant', () => {
  const pairs = pair();
  const node = (id: string, type: string, inputs: Record<string, unknown> = {}) => ({ id, position: { x: 0, y: 0 }, data: { type, inputs } });

  it('names the node types that do not exist, which keep it from opening', () => {
    const report = checkAssistantGraph({ nodes: [node('a', pairs.a.type), node('z', 'comfy:Nope'), node('y', 'comfy:Nope')], edges: [] });
    expect(report.unknownTypes).toEqual(['comfy:Nope']);
  });

  it('lists the connections and the values it leaves out, with the reason', () => {
    const report = checkAssistantGraph({
      nodes: [node('a', pairs.a.type, { nonsense: 1 }), node('b', pairs.b.type)],
      edges: [
        { source: 'a', sourceHandle: pairs.out, target: 'b', targetHandle: pairs.input },
        { source: 'a', sourceHandle: 'nowhere', target: 'b', targetHandle: pairs.input },
        { source: 'a', sourceHandle: pairs.out, target: 'ghost', targetHandle: pairs.input },
      ],
    });
    expect(report.unknownTypes).toEqual([]);
    expect(report.dropped).toEqual([
      expect.stringContaining('a.nonsense'),
      expect.stringContaining('a has no output named "nowhere"'.replace('a has', `${pairs.a.type} has`)),
      expect.stringContaining('the node ghost does not exist'),
    ]);
  });

  it('passes what is not a graph through untouched', () => {
    expect(checkAssistantGraph(null)).toEqual({ graph: null, unknownTypes: [], dropped: [] });
    expect(checkAssistantGraph({ nodes: 'x' }).graph).toEqual({ nodes: 'x' });
  });
});

describe('inputs written by the assistant', () => {
  beforeAll(() => setExtensionTemplates(comfyTemplates({ ...MOCK_NODE_DEFS, ...CORE_NODE_DEFS, ...PACK_NODE_DEFS })));
  afterAll(() => setExtensionTemplates([]));

  const rig = { nodes: [{ id: 'r', position: { x: 0, y: 0 }, data: { type: 'comfy:NKDFaceRig', inputs: { smile: 0.4, rig: 'a gentle smile', crop_factor: 2 } } }], edges: [] };

  it('drops fields the node does not have and the ones its editor screen owns, from a whole graph', () => {
    const clean = cleanedAssistantGraph(rig) as typeof rig;
    expect(clean.nodes[0]!.data.inputs).toEqual({ crop_factor: 2 });
  });

  it('applies the same rule to nodes added or changed by operations', () => {
    const s = { ...serializeWorkflow(graph()), nodes: [], edges: [] };
    const added = applyWorkflowOps(s, [{ op: 'addNode', id: 'r', nodeType: 'comfy:NKDFaceRig', inputs: { rig: 'x', smile: 1, crop_factor: 3 } }]);
    expect(added.graph.nodes[0]!.data.inputs.rig).toBe('');
    expect(added.graph.nodes[0]!.data.inputs.crop_factor).toBe(3);
    expect(added.graph.nodes[0]!.data.inputs).not.toHaveProperty('smile');
    const changed = applyWorkflowOps(added.graph, [{ op: 'setInputs', id: 'r', inputs: { rig: 'y', crop_factor: 4 } }]);
    expect(changed.graph.nodes[0]!.data.inputs.rig).toBe('');
    expect(changed.graph.nodes[0]!.data.inputs.crop_factor).toBe(4);
  });
});
