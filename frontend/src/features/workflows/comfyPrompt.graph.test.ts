// The shape of the graph as a whole: connections that point at nothing, node types no loaded catalogue has, and the
// picture previewed when the graph ends at pack nodes nothing reads from.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import type { WorkflowEdge, WorkflowNode } from '@/state/workflows/workflows';
import { comfyTemplates } from './comfyNodes';
import { ComfyGraphError, compileComfyPrompt } from './comfyPrompt';
import { createNode, makeEdge } from './graph';
import { getTemplate, setExtensionTemplates } from './templates';

beforeEach(() => setExtensionTemplates(comfyTemplates(MOCK_NODE_DEFS)));
afterEach(() => setExtensionTemplates([]));

const node = (type: string, id: string, inputs: Record<string, unknown> = {}) => createNode(getTemplate(type)!, { x: 0, y: 0 }, { id, inputs });

const fail = (g: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }): ComfyGraphError => {
  let result: unknown;
  try {
    result = compileComfyPrompt(g);
  } catch (e) {
    expect(e).toBeInstanceOf(ComfyGraphError);
    return e as ComfyGraphError;
  }
  throw new Error(`expected the compile to fail, got ${JSON.stringify(result)}`);
};

describe('connections that point at nothing', () => {
  it('names the node a connection comes from when that node is gone', () => {
    const g = { nodes: [node('save_image', 'save')], edges: [makeEdge('gone', 'image', 'save', 'image')] };
    expect(fail(g)).toMatchObject({ reason: 'unsupported', nodeId: 'gone', field: 'image' });
  });

  it('names the node of a connection that leaves from no output', () => {
    const edge: WorkflowEdge = { ...makeEdge('src', 'image', 'save', 'image'), sourceHandle: null };
    const g = { nodes: [node('image', 'src', { image: 'a.png' }), node('save_image', 'save')], edges: [edge] };
    expect(fail(g)).toMatchObject({ reason: 'unsupported', nodeId: 'src', field: null });
  });

  it('refuses a node of a pack whose nodes ComfyUI no longer lists', () => {
    // A workflow made where a pack was installed, opened where it is not.
    const gone = node('comfy:MockFilmGrain', 'grain');
    gone.data.type = 'comfy:MockRemoved';
    const g = { nodes: [node('image', 'src', { image: 'a.png' }), gone, node('save_image', 'save')], edges: [makeEdge('src', 'image', 'grain', 'image'), makeEdge('grain', 'IMAGE', 'save', 'image')] };
    expect(fail(g)).toMatchObject({ reason: 'unsupported', nodeId: 'grain', field: null });
  });
});

describe('a graph that ends at pack nodes', () => {
  it('previews only the picture nothing reads on, not the one a later node takes', () => {
    // The decoder's picture goes on to the first Film Grain, so it is not previewed; neither is the first one's.
    const nodes = [node('l2i', 'dec', { latents: 'z', vae: 'v' }), node('comfy:MockFilmGrain', 'first'), node('comfy:MockFilmGrain', 'second')];
    const edges = [makeEdge('dec', 'image', 'first', 'image'), makeEdge('first', 'IMAGE', 'second', 'image')];
    const { graph } = compileComfyPrompt({ nodes, edges });
    expect(graph.outputs).toEqual(['second:preview']);
    expect(graph.prompt['second:preview']).toEqual({ class_type: 'PreviewImage', inputs: { images: ['second', 0] } });
    expect(graph.prompt['first:preview']).toBeUndefined();
    expect(graph.prompt['dec:preview']).toBeUndefined();
    expect(graph.prompt.second!.inputs.image).toEqual(['first', 0]);
  });
});
