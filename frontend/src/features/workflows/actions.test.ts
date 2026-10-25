// Adding a gallery picture to the graph as an image input node.
import { beforeEach, describe, expect, it } from 'vitest';
import type { ImageDTO } from '@/backend';
import { EMPTY_META, useWorkflows } from '@/state/workflows/workflows';
import { addImageInputNode, inputNodePosition } from './actions';

const image = { name: 'pic.png' } as ImageDTO;

describe('image input from the gallery', () => {
  beforeEach(() => useWorkflows.getState().setGraph({ nodes: [], edges: [], form: [], meta: { ...EMPTY_META } }));

  it('places the node left of the graph, at its top, or at the origin when empty', () => {
    expect(inputNodePosition([])).toEqual({ x: 0, y: 0 });
    expect(inputNodePosition([{ position: { x: 100, y: 50 } }, { position: { x: 400, y: -20 } }])).toEqual({ x: -280, y: -20 });
  });

  it('adds an image node holding the picture and keeps existing nodes', () => {
    addImageInputNode(image);
    addImageInputNode(image);
    const nodes = useWorkflows.getState().nodes;
    expect(nodes).toHaveLength(2);
    for (const n of nodes) {
      expect(n.data.type).toBe('image');
      expect(n.data.inputs.image).toBe('pic.png');
    }
    expect(nodes[1]!.position.x).toBeLessThan(nodes[0]!.position.x);
  });
});
