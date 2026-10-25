import { describe, expect, it } from 'vitest';
import type { WorkflowNode } from '@/state/workflows/workflows';
import { createNode, makeEdge } from './graph';
import { LAYER_SPACING, NODE_GAP, layeredLayout, nodeHeight, topologicalOrder } from './layeredLayout';
import { getTemplate } from './templates';

const node = (type: string, id: string, extra: Partial<WorkflowNode> = {}): WorkflowNode => ({ ...createNode(getTemplate(type)!, { x: 0, y: 0 }, { id }), ...extra });

describe('layeredLayout', () => {
  it('orders nodes within a column to remove edge crossings', () => {
    // Array order would put t1 above t2, crossing a->t2 and b->t1.
    const nodes = [node('integer', 'a'), node('integer', 'b'), node('integer_math', 't1'), node('integer_math', 't2')];
    const edges = [makeEdge('a', 'value', 't2', 'a'), makeEdge('b', 'value', 't1', 'a')];
    const p = layeredLayout(nodes, edges, { x: 0, y: 0 });
    expect(p.get('a')!.y).toBeLessThan(p.get('b')!.y);
    expect(p.get('t2')!.y).toBeLessThan(p.get('t1')!.y);
    expect(p.get('t1')!.x).toBe(LAYER_SPACING);
  });

  it('stacks nodes of a column by their measured heights without overlap', () => {
    const nodes = [node('integer', 'a', { measured: { width: 300, height: 200 } }), node('integer', 'b', { measured: { width: 300, height: 120 } })];
    const p = layeredLayout(nodes, [], { x: 10, y: 20 });
    expect(p.get('a')).toEqual({ x: 10, y: 20 });
    expect(p.get('b')).toEqual({ x: 10, y: 20 + 200 + NODE_GAP });
  });

  it('places a column after the widest node of the previous one', () => {
    const nodes = [node('integer', 'a', { measured: { width: 600, height: 100 } }), node('integer_math', 'b')];
    const p = layeredLayout(nodes, [makeEdge('a', 'value', 'b', 'a')], { x: 0, y: 0 });
    expect(p.get('b')!.x).toBeGreaterThan(600);
  });

  it('puts a node in the column after its longest path from a source', () => {
    const nodes = [node('integer', 'a'), node('integer_math', 'm1'), node('integer_math', 'm2')];
    const edges = [makeEdge('a', 'value', 'm1', 'a'), makeEdge('m1', 'value', 'm2', 'a'), makeEdge('a', 'value', 'm2', 'b')];
    const p = layeredLayout(nodes, edges, { x: 0, y: 0 });
    expect([p.get('a')!.x, p.get('m1')!.x, p.get('m2')!.x]).toEqual([0, LAYER_SPACING, 2 * LAYER_SPACING]);
  });

  it('still places every node of a cycle', () => {
    const nodes = [node('integer_math', 'x'), node('integer_math', 'y')];
    const edges = [makeEdge('x', 'value', 'y', 'a'), makeEdge('y', 'value', 'x', 'a')];
    expect(topologicalOrder(nodes, edges)).toEqual(['x', 'y']);
    expect([...layeredLayout(nodes, edges, { x: 0, y: 0 }).keys()].sort()).toEqual(['x', 'y']);
  });

  it('returns nothing for no nodes', () => {
    expect(layeredLayout([], []).size).toBe(0);
  });

  it('estimates the height of a node that has not been drawn yet', () => {
    expect(nodeHeight(node('denoise_latents', 'd'))).toBeGreaterThan(nodeHeight(node('integer', 'i')));
    expect(nodeHeight({ ...node('denoise_latents', 'd'), data: { ...node('denoise_latents', 'd').data, isOpen: false } })).toBeLessThan(nodeHeight(node('integer', 'i')));
  });
});
