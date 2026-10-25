// Snapshots of the ComfyUI prompts compiled from editor graphs, so a change to what reaches ComfyUI is seen in review.
// Update them on purpose with `npx vitest run -u src/features/workflows/comfyPrompt.snapshot.test.ts`.
import { readdirSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { GenerationMetadata, ImageDTO, ModelConfig } from '@/backend';
import { CORE_NODE_DEFS } from '@/backend/mock/comfyCoreDefs';
import { MOCK_NODE_DEFS } from '@/backend/mock/comfyNodeDefs';
import { PACK_NODE_DEFS } from '@/backend/mock/comfyPackDefs';
import { useGallery } from '@/state/gallery';
import type { WorkflowEdge, WorkflowNode } from '@/state/workflows/workflows';
import { comfyTemplates } from './comfyNodes';
import { compileComfyPrompt } from './comfyPrompt';
import { buildDefaultGraph } from './defaultGraphs';
import { MODEL_FIELDS } from './fieldTypes';
import { buildTemplate, GRAPH_TEMPLATES, type GraphTemplate } from './graphTemplates';
import { graphFromImage } from './imageGraph';
import { getTemplate, setExtensionTemplates } from './templates';

/** Pretty JSON with LF line ends, matching how the repository keeps text files. */
const asJson = (x: unknown) => `${JSON.stringify(x, null, 2)}\n`;

const PHOTO: ImageDTO = { name: 'photo.png', url: '', thumbnailUrl: '', width: 768, height: 512, createdAt: 0, boardId: null, starred: false, mediaType: 'image' } as ImageDTO;

beforeAll(() => setExtensionTemplates(comfyTemplates({ ...MOCK_NODE_DEFS, ...CORE_NODE_DEFS, ...PACK_NODE_DEFS })));
afterAll(() => setExtensionTemplates([]));
// A known picture, so its size comes from the gallery rather than a GetImageSize node.
beforeEach(() => useGallery.setState({ images: [PHOTO] }));

/** Picks a picture and a model for every field the user would fill. */
function fillPicks(nodes: WorkflowNode[]) {
  for (const n of nodes) {
    if (n.data.type === 'image' && !n.data.inputs.image) n.data.inputs.image = PHOTO.name;
    if (n.data.type === 'comfy:LoadVideo' && !n.data.inputs.file) n.data.inputs.file = 'clip.mp4';
    for (const input of getTemplate(n.data.type)!.inputs) {
      const field = MODEL_FIELDS[input.type];
      if (field && !n.data.inputs[input.name]) n.data.inputs[input.name] = `${field.modelType}-key`;
    }
  }
}

/** A template with its node keys as ids (buildTemplate gives random ones), so the prompt keys are stable. */
function stableTemplate(template: GraphTemplate): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const built = buildTemplate(template);
  const ids = new Map(built.nodes.map((n, i) => [n.id, template.nodes[i]![0]]));
  const rename = (id: string) => ids.get(id) ?? id;
  const nodes = built.nodes.map((n) => ({ ...n, id: rename(n.id), data: { ...n.data, inputs: { ...n.data.inputs } } }));
  const edges = built.edges.map((e) => ({ ...e, id: `${rename(e.source)}.${e.sourceHandle}->${rename(e.target)}.${e.targetHandle}`, source: rename(e.source), target: rename(e.target) }));
  fillPicks(nodes);
  return { nodes, edges };
}

// Video templates run on the backend's own video path, not as a ComfyUI prompt built here.
const COMPILABLE = GRAPH_TEMPLATES.filter((t) => !t.nodes.some(([, type]) => type === 'video_generate'));
// The video built-ins have a Generate Video node, so they run on the backend's own video path.
const DEFAULT_IDS = ['default-t2i-sd15', 'default-t2i-sdxl', 'default-i2i-sdxl', 'default-multidiffusion', 'default-face-detailer'];
const FROM_IMAGE_CASES = ['from-image-txt2img', 'from-image-loras-vae'];

describe('ComfyUI prompt snapshots: files', () => {
  // Names are built from the template list, so tests/test-hygiene.test.ts cannot read them; check orphans here.
  it('has a case for every snapshot file', () => {
    const files = readdirSync(new URL('./__snapshots__/comfyPrompt/', import.meta.url)).map((f) => f.replace(/\.json$/, ''));
    const cases = [...COMPILABLE.map((t) => `template-${t.id}`), ...DEFAULT_IDS, ...FROM_IMAGE_CASES];
    expect(files.sort()).toEqual(cases.sort());
  });
});

describe('ComfyUI prompt snapshots: graph templates', () => {
  it.each(COMPILABLE.map((t) => [t.id, t] as const))('%s', async (id, template) => {
    await expect(asJson(compileComfyPrompt(stableTemplate(template)))).toMatchFileSnapshot(`./__snapshots__/comfyPrompt/template-${id}.json`);
  });
});

const model = (key: string, type: ModelConfig['type'], base: ModelConfig['base'], name = key): ModelConfig => ({
  key,
  name,
  base,
  type,
  format: 'checkpoint',
  description: '',
  path: '',
  size: 0,
  source: '',
});

const MODELS = [
  model('sd15-key', 'main', 'sd-1'),
  model('sdxl-key', 'main', 'sdxl'),
  model('upscaler-key', 'spandrel_image_to_image', 'any'),
  model('tile-key', 'controlnet', 'sdxl', 'xinsir tile'),
  model('detail-lora', 'lora', 'sdxl'),
  model('soft-lora', 'lora', 'sdxl'),
  model('vae-key', 'vae', 'sdxl'),
];

describe('ComfyUI prompt snapshots: built-in workflows', () => {
  it.each(DEFAULT_IDS)('%s', async (id) => {
    const g = buildDefaultGraph({ id, name: id, description: '', author: '', tags: [] }, MODELS)!;
    fillPicks(g.nodes);
    await expect(asJson(compileComfyPrompt(g))).toMatchFileSnapshot(`./__snapshots__/comfyPrompt/${id}.json`);
  });
});

describe('ComfyUI prompt snapshots: graph from a gallery image', () => {
  const meta = (over: Partial<GenerationMetadata>): GenerationMetadata => ({
    generationMode: 'txt2img',
    positivePrompt: '1girl, smile, cherry blossoms',
    negativePrompt: 'blurry, lowres',
    modelKey: 'sdxl-key',
    modelName: 'sdxl-key',
    vaeKey: null,
    seed: 12345,
    steps: 28,
    cfgScale: 6,
    cfgRescale: 0,
    scheduler: 'euler_a',
    width: 832,
    height: 1216,
    clipSkip: 0,
    seamlessX: false,
    seamlessY: false,
    loras: [],
    ...over,
  });
  const compileFrom = (m: GenerationMetadata) => {
    const made = graphFromImage({ ...PHOTO, name: 'made.png', width: m.width, height: m.height, metadata: m } as ImageDTO, MODELS)!;
    return compileComfyPrompt(made.graph);
  };

  it('plain sdxl txt2img', async () => {
    await expect(asJson(compileFrom(meta({})))).toMatchFileSnapshot(`./__snapshots__/comfyPrompt/${FROM_IMAGE_CASES[0]}.json`);
  });

  it('sd15 with two LoRAs (one disabled) and a separate VAE', async () => {
    const m = meta({
      modelKey: 'sd15-key',
      modelName: 'sd15-key',
      width: 512,
      height: 768,
      vaeKey: 'vae-key',
      loras: [
        { key: 'detail-lora', weight: 0.7, isEnabled: true },
        { key: 'soft-lora', weight: 0.4, isEnabled: true },
        { key: 'off-lora', weight: 1, isEnabled: false },
      ],
    });
    await expect(asJson(compileFrom(m))).toMatchFileSnapshot(`./__snapshots__/comfyPrompt/${FROM_IMAGE_CASES[1]}.json`);
  });
});
