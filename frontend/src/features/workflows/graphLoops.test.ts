// A graph that loops back into itself cannot run (the compiler would never end it), and the editor refuses the
// connection that closes one. A file and the assistant are held to the same rule.
import { describe, expect, it } from 'vitest';
import { EMPTY_META } from '@/state/workflows/workflows';
import { applyWorkflowOps, checkAssistantGraph } from './aiOps';
import { createNode, makeEdge } from './graph';
import { deserializeWorkflow, serializeWorkflow } from './serialize';
import { getTemplate } from './templates';

const resize = (id: string) => ({ id, position: { x: 0, y: 0 }, data: { type: 'img_resize', inputs: {} } });
const link = (source: string, target: string) => ({ source, sourceHandle: 'image', target, targetHandle: 'image' });
const pairs = (edges: { source: string; target: string }[]) => edges.map((e) => `${e.source}->${e.target}`);

/** Three resize nodes in a row: a -> b -> c. */
function chain() {
  const nodes = ['a', 'b', 'c'].map((id) => createNode(getTemplate('img_resize')!, { x: 0, y: 0 }, { id }));
  return serializeWorkflow({ nodes, edges: [makeEdge('a', 'image', 'b', 'image'), makeEdge('b', 'image', 'c', 'image')], meta: { ...EMPTY_META, name: 'loop' }, form: [] });
}

describe('a workflow file that loops back into itself', () => {
  it('opens without the connections that close a loop, keeping the ones before them in the file', () => {
    const g = deserializeWorkflow({ nodes: [resize('a'), resize('b'), resize('c')], edges: [link('a', 'b'), link('b', 'c'), link('c', 'a'), link('b', 'b')] });
    expect(g).not.toBeNull();
    expect(pairs(g!.edges)).toEqual(['a->b', 'b->c']);
  });

  it('keeps a graph that only branches and joins again', () => {
    const blend = { id: 'd', position: { x: 0, y: 0 }, data: { type: 'img_resize', inputs: {} } };
    const g = deserializeWorkflow({ nodes: [resize('a'), resize('b'), resize('c'), blend], edges: [link('a', 'b'), link('a', 'c'), link('b', 'd')] });
    expect(pairs(g!.edges)).toEqual(['a->b', 'a->c', 'b->d']);
  });
});

describe('a loop asked for by the assistant', () => {
  it('refuses a connection that would close a loop and says why, leaving the graph as it was', () => {
    const r = applyWorkflowOps(chain(), [{ op: 'connect', ...link('c', 'a') }]);
    expect(r.applied).toBe(0);
    expect(r.skipped).toEqual([expect.stringContaining('c.image -> a.image: this would make the graph loop back into itself')]);
    expect(pairs(r.graph.edges)).toEqual(['a->b', 'b->c']);
  });

  it('refuses a loop even when the new connection replaces another one into the same input', () => {
    // c -> b takes b's image input from a, but b still feeds c.
    const r = applyWorkflowOps(chain(), [{ op: 'connect', ...link('c', 'b') }]);
    expect(r.skipped).toEqual([expect.stringContaining('c.image -> b.image: this would make the graph loop back into itself')]);
    expect(pairs(r.graph.edges)).toEqual(['a->b', 'b->c']);
  });

  it('allows the same connection once the path back is cut', () => {
    const r = applyWorkflowOps(chain(), [{ op: 'disconnect', ...link('b', 'c') }, { op: 'connect', ...link('c', 'a') }]);
    expect(r.skipped).toEqual([]);
    expect(pairs(r.graph.edges)).toEqual(['a->b', 'c->a']);
  });

  it('lists the connection of a whole graph that closes a loop among what it leaves out', () => {
    const report = checkAssistantGraph({ nodes: [resize('a'), resize('b')], edges: [link('a', 'b'), link('b', 'a')] });
    expect(report.dropped).toEqual(['b.image -> a.image: this would make the graph loop back into itself']);
    expect(pairs(deserializeWorkflow(report.graph)!.edges)).toEqual(['a->b']);
  });
});
