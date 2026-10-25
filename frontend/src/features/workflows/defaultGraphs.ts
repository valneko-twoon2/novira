// Graphs for the built-in (default) workflows, generated on demand because the library stores them without a graph.
import type { BaseModel, ModelConfig, ModelType, SavedWorkflow } from '@/backend';
import { t } from '@/i18n';
import { EMPTY_META, type EditorGraph, type FormField, type WorkflowEdge, type WorkflowNode } from '@/state/workflows/workflows';
import { createNode, makeEdge } from './graph';
import { getTemplate } from './templates';

export class GraphBuilder {
  nodes: WorkflowNode[] = [];
  edges: WorkflowEdge[] = [];
  form: FormField[] = [];
  private n = 0;

  node(type: string, x: number, y: number, inputs: Record<string, unknown> = {}, label = ''): string {
    const template = getTemplate(type);
    if (!template) throw new Error(`unknown node type ${type}`);
    this.n += 1;
    const id = `${type}-${this.n}`;
    this.nodes.push(createNode(template, { x, y }, { id, label, inputs }));
    return id;
  }

  edge(source: string, sourceHandle: string, target: string, targetHandle: string) {
    this.edges.push(makeEdge(source, sourceHandle, target, targetHandle));
  }

  expose(nodeId: string, fieldName: string) {
    this.form.push({ nodeId, fieldName });
  }
}

const DEFAULT_POSITIVE = 'Super cute tiger cub, national geographic award-winning photograph, detailed fur';
const DEFAULT_NEGATIVE = 'blurry, low quality, watermark';
const DEFAULT_VIDEO_PROMPT = 'Waves roll onto a beach at sunset, the camera slowly moves forward, cinematic';
const DEFAULT_VIDEO_I2V_PROMPT = 'The hair and clothes sway in a gentle breeze, clouds drift slowly, subtle camera movement';
const DEFAULT_VIDEO_NEGATIVE = 'blurry, low quality, worst quality, static, jpeg artifacts, deformed, watermark, text';

function pick(models: ModelConfig[], type: ModelType, base: BaseModel | null, hint?: string): string | null {
  const list = models.filter((m) => m.type === type && (!base || m.base === base || m.base === 'any'));
  return (hint ? list.find((m) => m.name.toLowerCase().includes(hint)) : undefined)?.key ?? list[0]?.key ?? null;
}

/** Model loader + prompts + noise + denoise + decode. Returns ids for further wiring. */
function textToImageCore(b: GraphBuilder, models: ModelConfig[], base: 'sd-1' | 'sdxl', size: number, ox = 0) {
  const sdxl = base === 'sdxl';
  const loader = b.node(sdxl ? 'sdxl_model_loader' : 'main_model_loader', ox, 120, { model: pick(models, 'main', base) });
  const promptType = sdxl ? 'sdxl_compel_prompt' : 'compel';
  const pos = b.node(promptType, ox + 380, -260, { prompt: DEFAULT_POSITIVE }, t('workflows.defaults.positivePrompt'));
  const neg = b.node(promptType, ox + 380, 120, { prompt: DEFAULT_NEGATIVE }, t('workflows.defaults.negativePrompt'));
  const seed = b.node('rand_int', ox, 420);
  const noise = b.node('noise', ox + 380, 520, { width: size, height: size });
  const denoise = b.node('denoise_latents', ox + 760, 0, { steps: 30, cfg_scale: sdxl ? 6 : 7.5, scheduler: sdxl ? 'dpmpp_2m_k' : 'euler' });
  const decode = b.node('l2i', ox + 1140, 120);
  for (const p of [pos, neg]) {
    b.edge(loader, 'clip', p, 'clip');
    if (sdxl) b.edge(loader, 'clip2', p, 'clip2');
  }
  b.edge(loader, 'unet', denoise, 'unet');
  b.edge(loader, 'vae', decode, 'vae');
  b.edge(pos, 'conditioning', denoise, 'positive_conditioning');
  b.edge(neg, 'conditioning', denoise, 'negative_conditioning');
  b.edge(seed, 'value', noise, 'seed');
  b.edge(noise, 'noise', denoise, 'noise');
  b.edge(denoise, 'latents', decode, 'latents');
  b.expose(loader, 'model');
  b.expose(pos, 'prompt');
  b.expose(neg, 'prompt');
  return { loader, pos, neg, seed, noise, denoise, decode };
}

type Builder = (models: ModelConfig[]) => GraphBuilder;

const BUILDERS: Record<string, Builder> = {
  'default-t2i-sd15': (models) => {
    const b = new GraphBuilder();
    const c = textToImageCore(b, models, 'sd-1', 512);
    b.expose(c.noise, 'width');
    b.expose(c.noise, 'height');
    b.expose(c.denoise, 'steps');
    b.expose(c.denoise, 'cfg_scale');
    return b;
  },
  'default-t2i-sdxl': (models) => {
    const b = new GraphBuilder();
    const c = textToImageCore(b, models, 'sdxl', 1024);
    b.expose(c.noise, 'width');
    b.expose(c.noise, 'height');
    b.expose(c.denoise, 'steps');
    b.expose(c.denoise, 'cfg_scale');
    return b;
  },
  'default-i2i-sdxl': (models) => {
    const b = new GraphBuilder();
    const c = textToImageCore(b, models, 'sdxl', 1024, 380);
    const img = b.node('image', 0, 620);
    const enc = b.node('i2l', 380, 900);
    b.edge(img, 'image', enc, 'image');
    b.edge(c.loader, 'vae', enc, 'vae');
    b.edge(img, 'width', c.noise, 'width');
    b.edge(img, 'height', c.noise, 'height');
    b.edge(enc, 'latents', c.denoise, 'latents');
    b.nodes = b.nodes.map((n) => (n.id === c.denoise ? { ...n, data: { ...n.data, inputs: { ...n.data.inputs, denoising_start: 0.4 } } } : n));
    b.form.unshift({ nodeId: img, fieldName: 'image' });
    b.expose(c.denoise, 'denoising_start');
    return b;
  },
  'default-video-t2v': () => {
    const b = new GraphBuilder();
    const seed = b.node('rand_int', 0, 0);
    const video = b.node('video_generate', 380, 0, { prompt: DEFAULT_VIDEO_PROMPT, negative_prompt: DEFAULT_VIDEO_NEGATIVE });
    b.edge(seed, 'value', video, 'seed');
    b.expose(video, 'prompt');
    b.expose(video, 'negative_prompt');
    b.expose(video, 'frames');
    b.expose(video, 'fps');
    return b;
  },
  'default-video-i2v': () => {
    const b = new GraphBuilder();
    const img = b.node('image', 0, 0);
    const seed = b.node('rand_int', 0, 420);
    const video = b.node('video_generate', 380, 0, { prompt: DEFAULT_VIDEO_I2V_PROMPT, negative_prompt: DEFAULT_VIDEO_NEGATIVE });
    b.edge(img, 'image', video, 'image');
    b.edge(img, 'width', video, 'width');
    b.edge(img, 'height', video, 'height');
    b.edge(seed, 'value', video, 'seed');
    b.form.push({ nodeId: img, fieldName: 'image' });
    b.expose(video, 'prompt');
    b.expose(video, 'negative_prompt');
    b.expose(video, 'frames');
    b.expose(video, 'fps');
    return b;
  },
  'default-multidiffusion': (models) => {
    const b = new GraphBuilder();
    const c = textToImageCore(b, models, 'sdxl', 1024, 380);
    const img = b.node('image', -380, 620);
    const up = b.node('spandrel_image_to_image', 0, 620, { image_to_image_model: pick(models, 'spandrel_image_to_image', null) });
    const enc = b.node('i2l', 380, 960);
    const cn = b.node('controlnet', 760, 620, { control_model: pick(models, 'controlnet', 'sdxl', 'tile'), control_weight: 0.6 });
    const save = b.node('save_image', 1520, 120);
    b.edge(img, 'image', up, 'image');
    b.edge(up, 'image', enc, 'image');
    b.edge(up, 'image', cn, 'image');
    b.edge(up, 'width', c.noise, 'width');
    b.edge(up, 'height', c.noise, 'height');
    b.edge(c.loader, 'vae', enc, 'vae');
    b.edge(enc, 'latents', c.denoise, 'latents');
    b.edge(cn, 'control', c.denoise, 'control');
    b.edge(c.decode, 'image', save, 'image');
    b.nodes = b.nodes.map((n) => (n.id === c.denoise ? { ...n, data: { ...n.data, inputs: { ...n.data.inputs, denoising_start: 0.65 } } } : n));
    b.form.unshift({ nodeId: img, fieldName: 'image' });
    b.expose(up, 'image_to_image_model');
    b.expose(cn, 'control_weight');
    return b;
  },
  'default-face-detailer': (models) => {
    const b = new GraphBuilder();
    const c = textToImageCore(b, models, 'sd-1', 512, 380);
    const img = b.node('image', -380, 620);
    const resize = b.node('img_resize', 0, 620, { width: 512, height: 512 });
    const canny = b.node('canny_edge_detection', 380, 940);
    const cn = b.node('controlnet', 760, 760, { control_model: pick(models, 'controlnet', 'sd-1', 'canny'), control_weight: 0.5 });
    const ipa = b.node('ip_adapter', 760, 1180, { ip_adapter_model: pick(models, 'ip_adapter', 'sd-1'), weight: 0.6 });
    const enc = b.node('i2l', 380, 1240);
    const save = b.node('save_image', 1520, 120);
    b.edge(img, 'image', resize, 'image');
    b.edge(resize, 'image', canny, 'image');
    b.edge(canny, 'image', cn, 'image');
    b.edge(img, 'image', ipa, 'image');
    b.edge(resize, 'image', enc, 'image');
    b.edge(c.loader, 'vae', enc, 'vae');
    b.edge(enc, 'latents', c.denoise, 'latents');
    b.edge(cn, 'control', c.denoise, 'control');
    b.edge(ipa, 'ip_adapter', c.denoise, 'ip_adapter');
    b.edge(c.decode, 'image', save, 'image');
    b.nodes = b.nodes.map((n) => (n.id === c.denoise ? { ...n, data: { ...n.data, inputs: { ...n.data.inputs, denoising_start: 0.4 } } } : n));
    b.form.unshift({ nodeId: img, fieldName: 'image' });
    b.expose(c.denoise, 'denoising_start');
    return b;
  },
};

/** Editor graph for a library entry: its stored graph is parsed elsewhere; this covers built-ins. */
export function buildDefaultGraph(wf: Pick<SavedWorkflow, 'id' | 'name' | 'description' | 'author' | 'tags'>, models: ModelConfig[]): EditorGraph | null {
  const builder = BUILDERS[wf.id];
  if (!builder) return null;
  const b = builder(models);
  return {
    nodes: b.nodes,
    edges: b.edges,
    form: b.form,
    meta: { ...EMPTY_META, name: wf.name, description: wf.description, author: wf.author, tags: wf.tags.join(', ') },
  };
}
