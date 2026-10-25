// Property and fuzz tests for the editor-graph to ComfyUI-prompt compiler. Valid parameter combinations always give a
// well-formed prompt (unique ids, every link points at an existing node and a real output slot, no NaN / undefined,
// no cycles); broken graphs (dropped nodes and edges) either compile to a well-formed prompt or fail with a
// ComfyGraphError, never with anything else. In-process only: the mock node catalogue, no network.
import fc from 'fast-check';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { GenerationMetadata, ImageDTO, ModelConfig, SchedulerName } from '@/backend';
import { SCHEDULERS } from '@/backend';
import { CORE_NODE_DEFS } from '@/backend/mock/comfyCoreDefs';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { blockExternalNetwork, check, junkText } from '@/propertyTest.testkit';
import { useGallery } from '@/state/gallery';
import type { WorkflowEdge, WorkflowNode } from '@/state/workflows/workflows';
import { comfyTemplates } from './comfyNodes';
import { compileComfyPrompt, ComfyGraphError, type CompiledGraph } from './comfyPrompt';
import { MODEL_FIELDS } from './fieldTypes';
import { buildTemplate, GRAPH_TEMPLATES } from './graphTemplates';
import { graphFromImage } from './imageGraph';
import { allTemplates, getTemplate, setExtensionTemplates } from './templates';

blockExternalNetwork();

const PHOTO = { name: 'photo.png', url: '', thumbnailUrl: '', width: 768, height: 512, createdAt: 0, boardId: null, starred: false, mediaType: 'image' } as ImageDTO;

beforeAll(() => setExtensionTemplates(comfyTemplates({ ...MOCK_NODE_DEFS, ...CORE_NODE_DEFS, ...PACK_NODE_DEFS })));
afterAll(() => setExtensionTemplates([]));
beforeEach(() => useGallery.setState({ images: [PHOTO] }));

/** Output counts of the ComfyUI core classes the compiler writes. Pack classes come from the node catalogue. */
const CORE_OUTPUTS: Record<string, number> = {
  CheckpointLoaderSimple: 3,
  LoraLoader: 2,
  CLIPTextEncode: 1,
  KSampler: 1,
  VAEDecode: 1,
  VAEEncode: 1,
  VAELoader: 1,
  LoadImage: 2,
  EmptyLatentImage: 1,
  SaveImage: 0,
  PreviewImage: 0,
  ControlNetLoader: 1,
  ControlNetApplyAdvanced: 2,
  ImageScale: 1,
  ImageUpscaleWithModel: 1,
  UpscaleModelLoader: 1,
  Canny: 1,
};

function outputCount(classType: string): number | null {
  if (classType in CORE_OUTPUTS) return CORE_OUTPUTS[classType]!;
  const t = allTemplates().find((x) => x.comfyClass === classType);
  return t ? t.outputs.length : null;
}

/** Throws (via expect) when the compiled prompt is not something ComfyUI could take. */
function assertWellFormed({ graph }: CompiledGraph): void {
  const ids = Object.keys(graph.prompt);
  expect(ids.length).toBeGreaterThan(0);
  expect(new Set(ids).size).toBe(ids.length);
  expect(graph.outputs.length).toBeGreaterThan(0);
  for (const o of graph.outputs) expect(graph.prompt[o]).toBeDefined();
  expect(new Set(graph.outputs).size).toBe(graph.outputs.length);
  const edges = new Map<string, string[]>();
  const walk = (v: unknown, from: string, path: string): void => {
    expect(v, `undefined at ${from}.${path}`).not.toBeUndefined();
    if (typeof v === 'number') expect(Number.isFinite(v), `non-finite number at ${from}.${path}`).toBe(true);
    else if (Array.isArray(v)) {
      // a link: [node id, output slot]
      expect(v.length, `link shape at ${from}.${path}`).toBe(2);
      const [target, slot] = v as [unknown, unknown];
      expect(typeof target).toBe('string');
      expect(graph.prompt[target as string], `link from ${from}.${path} to missing node ${String(target)}`).toBeDefined();
      expect(Number.isInteger(slot) && (slot as number) >= 0, `slot at ${from}.${path}`).toBe(true);
      const count = outputCount(graph.prompt[target as string]!.class_type);
      if (count !== null) expect(slot as number, `slot ${String(slot)} of ${String(target)} (${count} outputs)`).toBeLessThan(count);
      edges.set(from, [...(edges.get(from) ?? []), target as string]);
    } else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, from, `${path}.${k}`);
  };
  for (const [id, node] of Object.entries(graph.prompt)) {
    expect(typeof node.class_type).toBe('string');
    expect(node.class_type).not.toBe('');
    for (const [k, v] of Object.entries(node.inputs)) walk(v, id, k);
  }
  // no cycles
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): void => {
    expect(state.get(id), `cycle through ${id}`).not.toBe(1);
    if (state.get(id) === 2) return;
    state.set(id, 1);
    for (const next of edges.get(id) ?? []) visit(next);
    state.set(id, 2);
  };
  for (const id of ids) visit(id);
}

const MODELS: ModelConfig[] = (['sdxl', 'sd-1'] as const).map((base) => ({ key: `${base}-key`, name: base, base, type: 'main', format: 'checkpoint', description: '', path: '', size: 1, source: '' }));

const side = fc.integer({ min: 8, max: 512 }).map((n) => n * 8);
const metadata: fc.Arbitrary<GenerationMetadata> = fc
  .record({
    generationMode: fc.constantFrom('txt2img', 'img2img', 'inpaint', 'outpaint'),
    positivePrompt: junkText,
    negativePrompt: junkText,
    modelKey: fc.constantFrom('sdxl-key', 'sd-1-key'),
    vaeKey: fc.option(fc.constantFrom('vae-a', 'vae-b'), { nil: null }),
    seed: fc.integer({ min: 0, max: 2 ** 32 - 1 }),
    steps: fc.integer({ min: 1, max: 150 }),
    cfgScale: fc.double({ min: 0, max: 30, noNaN: true }),
    scheduler: fc.constantFrom<SchedulerName>(...SCHEDULERS),
    width: side,
    height: side,
    loras: fc.array(fc.record({ key: fc.constantFrom('lora-a', 'lora-b', 'lora-c'), weight: fc.double({ min: -2, max: 2, noNaN: true }), isEnabled: fc.boolean() }), { maxLength: 6 }),
    clipSkip: fc.integer({ min: 0, max: 2 }),
    cfgRescale: fc.constantFrom(0, 0.5),
    seamlessX: fc.boolean(),
    seamlessY: fc.boolean(),
  })
  .map((m) => ({ modelName: 'x', ...m }) as unknown as GenerationMetadata);

describe('compileComfyPrompt (properties)', () => {
  it('compiles every graph made from image settings (base x LoRAs x VAE x mode x size) to a well-formed prompt', () => {
    check(
      fc.property(metadata, (m) => {
        const built = graphFromImage({ ...PHOTO, metadata: m }, MODELS);
        expect(built).not.toBeNull();
        const compiled = compileComfyPrompt(buildPicked(built!.graph.nodes, built!.graph.edges));
        assertWellFormed(compiled);
        const enabled = m.loras.filter((l) => l.isEnabled).length;
        expect(Object.values(compiled.graph.prompt).filter((n) => n.class_type === 'LoraLoader').length).toBe(enabled);
      }),
    );
  });

  it('compiles every ready-made template, with arbitrary finite numbers in its number fields', () => {
    const numbers = fc.double({ min: -1e6, max: 1e6, noNaN: true });
    check(
      fc.property(fc.constantFrom(...GRAPH_TEMPLATES.filter((t) => !t.nodes.some(([, type]) => type === 'video_generate'))), fc.array(numbers, { minLength: 1, maxLength: 12 }), (template, values) => {
        const { nodes, edges } = buildPicked(...nodesAndEdges(template));
        let k = 0;
        for (const n of nodes)
          for (const input of getTemplate(n.data.type)!.inputs) {
            const isNumber = input.type === 'integer' || input.type === 'float';
            if (!isNumber || typeof n.data.inputs[input.name] !== 'number') continue;
            const v = values[k++ % values.length]!;
            n.data.inputs[input.name] = input.type === 'integer' ? Math.trunc(v) : v;
          }
        assertWellFormed(compileComfyPrompt({ nodes, edges }));
      }),
    );
  });

  it('a template with dropped or shuffled nodes and edges compiles or fails with a ComfyGraphError, nothing else', () => {
    check(
      fc.property(fc.constantFrom(...GRAPH_TEMPLATES), fc.array(fc.nat(40), { maxLength: 4 }), fc.array(fc.nat(60), { maxLength: 4 }), fc.boolean(), (template, dropNodes, dropEdges, reverse) => {
        const { nodes, edges } = buildPicked(...nodesAndEdges(template));
        const keepNodes = nodes.filter((_, i) => !dropNodes.includes(i % Math.max(1, nodes.length)) || nodes.length < 2);
        const keepEdges = edges.filter((_, i) => !dropEdges.includes(i % Math.max(1, edges.length)));
        const g = { nodes: reverse ? [...keepNodes].reverse() : keepNodes, edges: keepEdges };
        let compiled: CompiledGraph;
        try {
          compiled = compileComfyPrompt(g);
        } catch (e) {
          expect(e, `unexpected ${String(e)}`).toBeInstanceOf(ComfyGraphError);
          return;
        }
        assertWellFormed(compiled);
      }),
    );
  });
});

function nodesAndEdges(template: (typeof GRAPH_TEMPLATES)[number]): [WorkflowNode[], WorkflowEdge[]] {
  const built = buildTemplate(template);
  return [built.nodes, built.edges];
}

/** Picks a picture and a model for every field the user would fill (as the snapshot tests do). */
function buildPicked(nodes: WorkflowNode[], edges: WorkflowEdge[]): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const copy = nodes.map((n) => ({ ...n, data: { ...n.data, inputs: { ...n.data.inputs } } }));
  for (const n of copy) {
    if (n.data.type === 'image' && !n.data.inputs.image) n.data.inputs.image = PHOTO.name;
    if (n.data.type === 'comfy:LoadVideo' && !n.data.inputs.file) n.data.inputs.file = 'clip.mp4';
    for (const input of getTemplate(n.data.type)?.inputs ?? []) {
      const field = MODEL_FIELDS[input.type];
      if (field && !n.data.inputs[input.name]) n.data.inputs[input.name] = `${field.modelType}-key`;
    }
  }
  return { nodes: copy, edges };
}
