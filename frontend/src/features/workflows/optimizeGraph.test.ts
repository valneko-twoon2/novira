import { describe, expect, it } from 'vitest';
import type { FormField, GraphSnapshot, WorkflowEdge, WorkflowNode } from '@/state/workflows/workflows';
import { createNode, makeEdge } from './graph';
import { LAYER_SPACING } from './layeredLayout';
import { optimizeGraph } from './optimizeGraph';
import { getTemplate } from './templates';

const node = (type: string, id: string, inputs: Record<string, unknown> = {}, extra: Partial<WorkflowNode['data']> = {}, position = { x: 0, y: 0 }): WorkflowNode => {
  const template = getTemplate(type);
  if (!template) throw new Error(`unknown template ${type}`);
  return createNode(template, position, { id, inputs, ...extra });
};
const edge = makeEdge;
const graph = (nodes: WorkflowNode[], edges: WorkflowEdge[], form: FormField[] = []): GraphSnapshot => ({ nodes, edges, form });

const ids = (g: GraphSnapshot) => g.nodes.map((n) => n.id).sort();
const links = (g: GraphSnapshot) => g.edges.map((e) => `${e.source}.${e.sourceHandle}>${e.target}.${e.targetHandle}`).sort();
const pos = (g: GraphSnapshot, id: string) => g.nodes.find((n) => n.id === id)!.position;

/** Text to image: model -> prompts -> denoise -> decode -> save. */
function textToImage(): WorkflowNode[] {
  return [
    node('main_model_loader', 'model', { model: 'm1' }),
    node('compel', 'pos', { prompt: 'a cat' }),
    node('compel', 'neg', { prompt: 'blurry' }),
    node('noise', 'noise', { seed: 42 }),
    node('denoise_latents', 'denoise'),
    node('l2i', 'decode'),
    node('save_image', 'save'),
  ];
}
function textToImageEdges(model = 'model'): WorkflowEdge[] {
  return [
    edge(model, 'clip', 'pos', 'clip'),
    edge(model, 'clip', 'neg', 'clip'),
    edge(model, 'unet', 'denoise', 'unet'),
    edge('pos', 'conditioning', 'denoise', 'positive_conditioning'),
    edge('neg', 'conditioning', 'denoise', 'negative_conditioning'),
    edge('noise', 'noise', 'denoise', 'noise'),
    edge('denoise', 'latents', 'decode', 'latents'),
    edge(model, 'vae', 'decode', 'vae'),
    edge('decode', 'image', 'save', 'image'),
  ];
}

describe('optimizeGraph: merging duplicates', () => {
  it('merges a duplicate node and rewires its outgoing edges to the kept one', () => {
    const nodes = [...textToImage(), node('main_model_loader', 'model2', { model: 'm1' })];
    // The negative prompt and the decoder take their inputs from the second, identical loader.
    const fromSecond = (e: WorkflowEdge) => e.source === 'model' && (e.target === 'neg' || e.target === 'decode');
    const edges = textToImageEdges().map((e) => (fromSecond(e) ? { ...e, ...edge('model2', e.sourceHandle!, e.target, e.targetHandle!) } : e));
    const { graph: out, summary } = optimizeGraph(graph(nodes, edges));
    expect(summary).toMatchObject({ merged: 1, removed: 0, edgesRemoved: 0 });
    expect(ids(out)).not.toContain('model2');
    expect(links(out)).toEqual(links(graph(textToImage(), textToImageEdges())));
  });

  it('merges chains: identical nodes fed by merged duplicates merge too', () => {
    const nodes = [
      node('main_model_loader', 'm-a', { model: 'm1' }),
      node('main_model_loader', 'm-b', { model: 'm1' }),
      node('compel', 'c-a', { prompt: 'same' }),
      node('compel', 'c-b', { prompt: 'same' }),
      node('denoise_latents', 'denoise'),
      node('l2i', 'decode'),
    ];
    const edges = [
      edge('m-a', 'clip', 'c-a', 'clip'),
      edge('m-b', 'clip', 'c-b', 'clip'),
      edge('c-a', 'conditioning', 'denoise', 'positive_conditioning'),
      edge('c-b', 'conditioning', 'denoise', 'negative_conditioning'),
      edge('m-b', 'unet', 'denoise', 'unet'),
      edge('denoise', 'latents', 'decode', 'latents'),
      edge('m-a', 'vae', 'decode', 'vae'),
    ];
    const { graph: out, summary } = optimizeGraph(graph(nodes, edges));
    expect(summary.merged).toBe(2);
    expect(ids(out)).toEqual(['c-a', 'decode', 'denoise', 'm-a']);
    expect(links(out)).toEqual(
      [
        'm-a.clip>c-a.clip',
        'c-a.conditioning>denoise.positive_conditioning',
        'c-a.conditioning>denoise.negative_conditioning',
        'm-a.unet>denoise.unet',
        'denoise.latents>decode.latents',
        'm-a.vae>decode.vae',
      ].sort(),
    );
    // The edge into the dropped prompt node is gone.
    expect(summary.edgesRemoved).toBe(1);
  });

  it('keeps the node that comes first in the graph', () => {
    const nodes = [node('integer', 'first', { value: 3 }), node('integer', 'second', { value: 3 }), node('integer_math', 'sum')];
    const edges = [edge('second', 'value', 'sum', 'a'), edge('first', 'value', 'sum', 'b')];
    const { graph: out } = optimizeGraph(graph(nodes, edges));
    expect(ids(out)).toEqual(['first', 'sum']);
    expect(links(out)).toEqual(['first.value>sum.a', 'first.value>sum.b']);
  });

  it('never merges output nodes', () => {
    const nodes = [...textToImage(), node('save_image', 'save2'), node('l2i', 'decode2')];
    const edges = [...textToImageEdges(), edge('decode', 'image', 'save2', 'image'), edge('denoise', 'latents', 'decode2', 'latents'), edge('model', 'vae', 'decode2', 'vae')];
    const { graph: out, summary } = optimizeGraph(graph(nodes, edges));
    expect(summary.merged).toBe(0);
    expect(ids(out)).toContain('save2');
    expect(ids(out)).toContain('decode2');
  });

  it('does not merge nodes whose values, labels or connections differ', () => {
    const nodes = [
      node('integer', 'a', { value: 1 }),
      node('integer', 'b', { value: 2 }),
      node('integer', 'c', { value: 1 }, { label: 'Width' }),
      node('integer_math', 'x'),
      node('integer_math', 'y'),
    ];
    const edges = [edge('a', 'value', 'x', 'a'), edge('b', 'value', 'x', 'b'), edge('c', 'value', 'y', 'a'), edge('a', 'value', 'y', 'b')];
    expect(optimizeGraph(graph(nodes, edges)).summary.merged).toBe(0);
  });

  it('ignores the stored value of an input that is connected', () => {
    const nodes = [node('integer', 'v', { value: 5 }), node('integer_math', 'x', { a: 1 }), node('integer_math', 'y', { a: 99 }), node('integer_math', 'z')];
    const edges = [edge('v', 'value', 'x', 'a'), edge('v', 'value', 'y', 'a'), edge('x', 'value', 'z', 'a'), edge('y', 'value', 'z', 'b')];
    const { graph: out, summary } = optimizeGraph(graph(nodes, edges));
    expect(summary.merged).toBe(1);
    expect(ids(out)).toEqual(['v', 'x', 'z']);
  });

  it('never merges random nodes, and merges seeded nodes only with equal fixed seeds', () => {
    const nodes = [
      node('rand_int', 'r1'),
      node('rand_int', 'r2'),
      node('noise', 'n1', { seed: 7 }),
      node('noise', 'n2', { seed: 7 }),
      node('noise', 'n3', { seed: null }),
      node('noise', 'n4', { seed: null }),
      node('integer_math', 'sum'),
    ];
    const edges = [edge('r1', 'value', 'sum', 'a'), edge('r2', 'value', 'sum', 'b')];
    const { graph: out, summary } = optimizeGraph(graph(nodes, edges));
    expect(summary.merged).toBe(1);
    expect(ids(out)).toEqual(['n1', 'n3', 'n4', 'r1', 'r2', 'sum']);
  });

  it('does not merge nodes with cache turned off or with fields in the linear form', () => {
    const nodes = [
      node('integer', 'a', { value: 1 }, { useCache: false }),
      node('integer', 'b', { value: 1 }),
      node('integer', 'c', { value: 1 }),
      node('integer_math', 'x'),
    ];
    const edges = [edge('a', 'value', 'x', 'a'), edge('b', 'value', 'x', 'b')];
    const form = [{ nodeId: 'c', fieldName: 'value' }];
    const { graph: out, summary } = optimizeGraph(graph(nodes, edges, form));
    expect(summary.merged).toBe(0);
    expect(out.form).toEqual(form);
  });

  it('with onlyWired, leaves a duplicate alone until its output is connected', () => {
    const nodes = [node('integer', 'a', { value: 1 }), node('integer', 'b', { value: 1 }), node('integer_math', 'x')];
    const edges = [edge('a', 'value', 'x', 'a')];
    expect(optimizeGraph(graph(nodes, edges), { onlyWired: true }).summary.merged).toBe(0);
    expect(optimizeGraph(graph(nodes, [...edges, edge('b', 'value', 'x', 'b')]), { onlyWired: true }).summary.merged).toBe(1);
    expect(optimizeGraph(graph(nodes, edges)).summary.merged).toBe(1);
  });
});

describe('optimizeGraph: dead nodes', () => {
  it('removes nodes whose results never reach an output, with their edges and form fields', () => {
    const nodes = [...textToImage(), node('compel', 'unused', { prompt: 'x' }), node('integer', 'lonely', { value: 3 }), node('img_blur', 'blur')];
    const edges = [...textToImageEdges(), edge('model', 'clip', 'unused', 'clip'), edge('decode', 'image', 'blur', 'image')];
    const form = [
      { nodeId: 'pos', fieldName: 'prompt' },
      { nodeId: 'unused', fieldName: 'prompt' },
    ];
    const { graph: out, summary } = optimizeGraph(graph(nodes, edges, form));
    expect(summary).toMatchObject({ merged: 0, removed: 3, edgesRemoved: 2 });
    expect(ids(out)).toEqual(ids(graph(textToImage(), [])));
    expect(out.form).toEqual([{ nodeId: 'pos', fieldName: 'prompt' }]);
  });

  it('removes nothing when the graph has no output node', () => {
    const nodes = [node('main_model_loader', 'model', { model: 'm1' }), node('compel', 'pos', { prompt: 'a' }), node('integer', 'lonely')];
    const { graph: out, summary } = optimizeGraph(graph(nodes, [edge('model', 'clip', 'pos', 'clip')]));
    expect(summary.removed).toBe(0);
    expect(ids(out)).toEqual(['lonely', 'model', 'pos']);
  });

  it('keeps nodes of types that are not loaded, and what feeds them', () => {
    const unknown: WorkflowNode = { ...node('integer', 'pack'), data: { ...node('integer', 'pack').data, type: 'comfy:NotInstalled' } };
    const nodes = [...textToImage(), node('integer', 'feeds-pack'), unknown];
    const edges = [...textToImageEdges(), edge('feeds-pack', 'value', 'pack', 'whatever')];
    const { graph: out, summary } = optimizeGraph(graph(nodes, edges));
    expect(summary.removed).toBe(0);
    expect(ids(out)).toContain('pack');
    expect(ids(out)).toContain('feeds-pack');
  });

  it('removeDead: false keeps unconnected nodes', () => {
    const nodes = [...textToImage(), node('integer', 'lonely')];
    expect(optimizeGraph(graph(nodes, textToImageEdges()), { removeDead: false }).summary.removed).toBe(0);
  });
});

describe('optimizeGraph: edges', () => {
  it('drops duplicate edges and edges whose node or handle no longer exists', () => {
    const edges = [
      ...textToImageEdges(),
      edge('decode', 'image', 'save', 'image'),
      edge('ghost', 'value', 'denoise', 'steps'),
      edge('model', 'no_such_output', 'pos', 'clip'),
      edge('model', 'clip', 'pos', 'no_such_input'),
    ];
    const { graph: out, summary } = optimizeGraph(graph(textToImage(), edges));
    expect(summary).toMatchObject({ merged: 0, removed: 0, edgesRemoved: 4 });
    expect(links(out)).toEqual(links(graph([], textToImageEdges())));
  });
});

describe('optimizeGraph: layout and stability', () => {
  it('lays the graph out left to right in columns from the top-left corner', () => {
    const nodes = textToImage().map((n, i) => ({ ...n, position: { x: 1000 - i * 90, y: 500 + ((i * 137) % 300) } }));
    const { graph: out } = optimizeGraph(graph(nodes, textToImageEdges()));
    for (const e of out.edges) expect(pos(out, e.source).x).toBeLessThan(pos(out, e.target).x);
    const minX = Math.min(...nodes.map((n) => n.position.x));
    expect(pos(out, 'model').x).toBe(minX);
    expect(pos(out, 'pos').x).toBe(minX + LAYER_SPACING);
    expect(pos(out, 'denoise').x).toBe(minX + 2 * LAYER_SPACING);
    expect(pos(out, 'save').x).toBe(minX + 4 * LAYER_SPACING);
    expect(Math.min(...out.nodes.map((n) => n.position.y))).toBe(Math.min(...nodes.map((n) => n.position.y)));
  });

  it('is deterministic and does not depend on where the nodes were', () => {
    const a = textToImage().map((n, i) => ({ ...n, position: { x: i * 10, y: 0 } }));
    const b = textToImage().map((n, i) => ({ ...n, position: { x: (6 - i) * 10, y: i === 3 ? 0 : 400 + i } }));
    const outA = optimizeGraph(graph(a, textToImageEdges())).graph;
    const outB = optimizeGraph(graph(b, textToImageEdges())).graph;
    expect(outA.nodes.map((n) => n.position)).toEqual(outB.nodes.map((n) => n.position));
    expect(optimizeGraph(graph(a, textToImageEdges())).graph).toEqual(outA);
  });

  it('is idempotent: optimizing twice equals optimizing once', () => {
    const nodes = [...textToImage(), node('main_model_loader', 'model2', { model: 'm1' }), node('integer', 'lonely')];
    const edges = [...textToImageEdges(), edge('model2', 'vae', 'decode', 'vae'), edge('decode', 'image', 'save', 'image')];
    const once = optimizeGraph(graph(nodes, edges));
    expect(once.changed).toBe(true);
    const twice = optimizeGraph(once.graph);
    expect(twice.changed).toBe(false);
    expect(twice.summary).toEqual({ merged: 0, removed: 0, edgesRemoved: 0, moved: 0 });
    expect(twice.graph).toBe(once.graph);
  });

  it('reports no change for an empty graph', () => {
    const empty = graph([], []);
    expect(optimizeGraph(empty)).toEqual({ graph: empty, summary: { merged: 0, removed: 0, edgesRemoved: 0, moved: 0 }, changed: false });
  });
});
