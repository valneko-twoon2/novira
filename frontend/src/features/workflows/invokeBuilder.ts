// Readiness checks and queue request building for the workflow graph.
import { randomSeed, type ClipVisionModel, type EnqueueRequest, type GenerationMetadata, type LoRAParam, type SchedulerName } from '@/backend';
import { t } from '@/i18n';
import { findImage } from '@/state/gallery';
import { autoAddBoardId } from '@/state/invoke';
import { catalogPackName, encoderMissing, IPADAPTER_PACK, packMissing } from '@/state/comfy/packNeeds';
import { findModel, useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { usePacks } from '@/state/media/packs';
import type { EditorGraph, WorkflowEdge, WorkflowNode } from '@/state/workflows/workflows';
import { ComfyGraphError, compileComfyPrompt, runsAsPrompt } from './comfyPrompt';
import { summarizePrompt } from './promptSummary';
import { MODEL_FIELDS } from './fieldTypes';
import { incomingEdge, invalidEdges } from './graph';
import { fieldLabel, getTemplate, isActive, nodeTitle as typeTitle } from './templates';

export function nodeTitle(n: WorkflowNode): string {
  return n.data.label || typeTitle(n.data.type);
}

/** Nodes that only hold a value and hand it to what they feed. */
const VALUE_NODES = new Set(['integer', 'float', 'string', 'boolean']);

export function readinessReasons(g: Pick<EditorGraph, 'nodes' | 'edges'>): string[] {
  const reasons: string[] = [];
  if (!g.nodes.some((n) => getTemplate(n.data.type)?.isOutput)) reasons.push(t('workflows.readiness.noOutput'));
  for (const n of g.nodes) {
    const template = getTemplate(n.data.type);
    if (!template) continue;
    for (const input of template.inputs) {
      if (!isActive(input, n.data.inputs)) continue;
      const edge = incomingEdge(g.edges, n.id, input.name);
      const from = edge ? g.nodes.find((x) => x.id === edge.source) : undefined;
      let missing: boolean;
      if (from && VALUE_NODES.has(from.data.type)) {
        // A value node hands over its own value, and one that holds none leaves the input out of the request, where the
        // engine refuses it only at the run. That holds for any input, also a ComfyUI widget, which the template does
        // not mark as required; an empty text is still a value unless the input is required.
        const value = from.data.inputs.value;
        missing = value === null || value === undefined || (!!input.required && value === '');
      } else {
        if (!input.required || edge) continue;
        const value = n.data.inputs[input.name];
        missing = input.input === 'connection' || value === null || value === undefined || value === '';
      }
      if (!missing) continue;
      const args = { node: nodeTitle(n), field: fieldLabel(n.data.type, input.name) };
      reasons.push(MODEL_FIELDS[input.type] ? t('workflows.readiness.missingModel', args) : t('workflows.readiness.missingInput', args));
    }
  }
  reasons.push(...choiceReasons(g.nodes));
  if (g.nodes.some((n) => n.data.type === 'video_generate') && usePacks.getState().packs.video.state !== 'ready') reasons.push(t('workflows.readiness.videoPack'));
  if (g.nodes.some((n) => n.data.type === 'voice_speak') && usePacks.getState().packs.voice.state !== 'ready') reasons.push(t('workflows.readiness.voicePack'));
  for (const n of g.nodes.filter((x) => x.data.type === 'ip_adapter' && g.edges.some((e) => e.source === x.id))) {
    const args = { node: nodeTitle(n) };
    if (packMissing(IPADAPTER_PACK)) reasons.push(t('workflows.readiness.ipAdapterPack', { ...args, pack: catalogPackName(IPADAPTER_PACK) }));
    const size = (n.data.inputs.clip_vision_model ?? 'ViT-H') as ClipVisionModel;
    if (encoderMissing(size, useModels.getState().models)) reasons.push(t('workflows.readiness.ipAdapterEncoder', { ...args, size }));
  }
  // A ComfyUI node whose pack is gone is named for that; its connections are not counted again as invalid ones. Left
  // unconnected, it does not stop the run.
  const gone = new Set(g.nodes.filter((n) => n.data.type.startsWith('comfy:') && !getTemplate(n.data.type) && g.edges.some((e) => e.source === n.id || e.target === n.id)).map((n) => n.id));
  for (const n of g.nodes.filter((x) => gone.has(x.id))) reasons.push(t('workflows.readiness.packGone', { node: n.data.label || n.data.type.slice('comfy:'.length) }));
  const bad = invalidEdges(g.nodes, g.edges).filter((e) => !gone.has(e.source) && !gone.has(e.target)).length;
  if (bad) reasons.push(t('workflows.readiness.invalidEdges', { count: bad }));
  if (!reasons.length && runsAsPrompt(g)) {
    const why = comfyPromptProblem(g);
    if (why) reasons.push(why);
  }
  return reasons;
}

/**
 * The choices of a ComfyUI node are what ComfyUI lists now (its model files, its samplers): a loader with nothing to
 * choose, or a value the list lacks (a workflow made where another model was installed), would only fail at the run.
 */
function choiceReasons(nodes: WorkflowNode[]): string[] {
  const reasons: string[] = [];
  for (const n of nodes) {
    const template = getTemplate(n.data.type);
    if (!template?.comfyClass) continue;
    for (const input of template.inputs) {
      if (input.type !== 'enum' || !input.options || !isActive(input, n.data.inputs)) continue;
      const args = { node: nodeTitle(n), field: fieldLabel(n.data.type, input.name) };
      const value = n.data.inputs[input.name];
      if (input.options.length === 0) reasons.push(t('workflows.readiness.noChoices', args));
      else if (value === null || value === undefined || value === '') reasons.push(t('workflows.readiness.missingInput', args));
      else if (typeof value !== 'string' || !input.options.includes(value)) reasons.push(t('workflows.readiness.notInList', { ...args, value: String(value) }));
    }
  }
  return reasons;
}

/** Why a graph cannot be sent to ComfyUI, or null when it can. */
function comfyPromptProblem(g: Pick<EditorGraph, 'nodes' | 'edges'>): string | null {
  try {
    compileComfyPrompt(g);
    return null;
  } catch (e) {
    if (!(e instanceof ComfyGraphError)) throw e;
    const n = g.nodes.find((x) => x.id === e.nodeId);
    if (e.reason === 'noOutput' || !n) return t('workflows.readiness.noOutput');
    const args = { node: nodeTitle(n), field: e.field ? fieldLabel(n.data.type, e.field) : '' };
    return e.reason === 'missingInput' ? t('workflows.readiness.missingInput', args) : t('workflows.readiness.comfyUnsupported', args);
  }
}

interface Resolved {
  value: unknown;
  /** The value comes from a Random Integer node. */
  random: boolean;
}

/** Value of an input: from a connected primitive/random node, otherwise the node's own value. */
function resolve(g: Pick<EditorGraph, 'nodes' | 'edges'>, node: WorkflowNode | undefined, field: string): Resolved {
  if (!node) return { value: undefined, random: false };
  const edge = incomingEdge(g.edges, node.id, field);
  if (edge) {
    const src = g.nodes.find((n) => n.id === edge.source);
    if (src?.data.type === 'rand_int') return { value: randomSeed(), random: true };
    if (src && VALUE_NODES.has(src.data.type)) return { value: src.data.inputs.value, random: false };
    if (src?.data.type === 'image' && (edge.sourceHandle === 'width' || edge.sourceHandle === 'height')) {
      const img = findImage(imageName(src.data.inputs.image));
      return { value: img ? img[edge.sourceHandle] : undefined, random: false };
    }
    return { value: undefined, random: false };
  }
  return { value: node.data.inputs[field], random: false };
}

export function imageName(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null;
}

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const text = (v: unknown) => (typeof v === 'string' ? v : '');

function sourceOf(g: Pick<EditorGraph, 'nodes' | 'edges'>, node: WorkflowNode | undefined, field: string): WorkflowNode | undefined {
  if (!node) return undefined;
  const e: WorkflowEdge | undefined = incomingEdge(g.edges, node.id, field);
  return e ? g.nodes.find((n) => n.id === e.source) : undefined;
}

/** Walks the UNet chain upstream (through LoRA loaders) to the main model loader. */
function modelLoaderOf(g: Pick<EditorGraph, 'nodes' | 'edges'>, denoise: WorkflowNode | undefined): WorkflowNode | undefined {
  let cur = sourceOf(g, denoise, 'unet');
  for (let i = 0; cur && i < 20; i++) {
    if (cur.data.type === 'main_model_loader' || cur.data.type === 'sdxl_model_loader') return cur;
    cur = sourceOf(g, cur, 'unet');
  }
  return g.nodes.find((n) => n.data.type === 'main_model_loader' || n.data.type === 'sdxl_model_loader');
}

function promptOf(g: Pick<EditorGraph, 'nodes' | 'edges'>, denoise: WorkflowNode | undefined, field: string): string {
  const p = sourceOf(g, denoise, field);
  return p ? text(resolve(g, p, 'prompt').value) : '';
}

/** A graph with a Generate Video node makes a video: the node's fields (or what feeds them) become the request. */
function buildVideoRequest(g: EditorGraph, video: WorkflowNode, workflow: unknown, opts: { prepend: boolean }): EnqueueRequest {
  const seedR = resolve(g, video, 'seed');
  const imageEdge = incomingEdge(g.edges, video.id, 'image');
  let imageSource: WorkflowNode | undefined = imageEdge ? g.nodes.find((n) => n.id === imageEdge.source) : undefined;
  for (let i = 0; imageSource && i < 10 && imageSource.data.type !== 'image'; i++) imageSource = sourceOf(g, imageSource, 'image');
  const picked = imageEdge ? imageName(imageSource?.data.inputs.image) : imageName(video.data.inputs.image);
  const source = findImage(picked);
  const params: GenerationMetadata = {
    generationMode: 'video',
    positivePrompt: text(resolve(g, video, 'prompt').value),
    negativePrompt: text(resolve(g, video, 'negative_prompt').value),
    modelKey: '',
    modelName: 'Wan 2.2 TI2V 5B',
    vaeKey: null,
    seed: seedR.random ? randomSeed() : num(seedR.value, 0),
    steps: num(resolve(g, video, 'steps').value, 20),
    cfgScale: num(resolve(g, video, 'cfg_scale').value, 5),
    cfgRescale: 0,
    scheduler: 'unipc',
    width: num(resolve(g, video, 'width').value, 832),
    height: num(resolve(g, video, 'height').value, 480),
    clipSkip: 0,
    seamlessX: false,
    seamlessY: false,
    loras: [],
    videoFrames: num(resolve(g, video, 'frames').value, 49),
    videoFps: num(resolve(g, video, 'fps').value, 24),
    workflowName: g.meta.name || t('workflows.untitled'),
  };
  return {
    origin: 'workflows',
    destination: 'gallery',
    params,
    iterations: 1,
    randomizeSeed: false,
    prepend: opts.prepend,
    boardId: autoAddBoardId(),
    initImageUrl: source?.url ?? null,
    workflow,
  };
}

/** A graph runs as a ComfyUI prompt; the params only describe it for the gallery (what the model, prompt and sampler nodes hold). */
function buildComfyRequest(g: EditorGraph, workflow: unknown, opts: { prepend: boolean }): EnqueueRequest {
  const { graph, seed, random } = compileComfyPrompt(g);
  const denoise = g.nodes.find((n) => n.data.type === 'denoise_latents');
  const noise = sourceOf(g, denoise, 'noise') ?? g.nodes.find((n) => n.data.type === 'noise');
  const loader = modelLoaderOf(g, denoise);
  const modelKey = text(loader?.data.inputs.model);
  const vaeNode = g.nodes.find((n) => n.data.type === 'vae_loader');
  const loras: LoRAParam[] = g.nodes
    .filter((n) => n.data.type === 'lora_loader' && typeof n.data.inputs.lora === 'string')
    .map((n) => ({ key: n.data.inputs.lora as string, weight: num(resolve(g, n, 'weight').value, 0.75), isEnabled: true }));
  const fromPicture = sourceOf(g, denoise, 'latents')?.data.type === 'i2l';
  // A graph of ComfyUI's own nodes has no editor sampler to read: its description comes from the compiled prompt.
  const own = denoise ? null : summarizePrompt(graph.prompt);
  // The size the compiler settled on (a Math node may feed it), else what the noise node holds.
  const empty = Object.values(graph.prompt).find((n) => n.class_type === 'EmptyLatentImage')?.inputs;
  const size = (field: 'width' | 'height') => num(empty?.[field], num(resolve(g, noise, field).value, own?.[field] ?? 0));
  const params: GenerationMetadata = {
    generationMode: 'graph',
    positivePrompt: own ? own.positive : promptOf(g, denoise, 'positive_conditioning'),
    negativePrompt: own ? own.negative : promptOf(g, denoise, 'negative_conditioning'),
    modelKey,
    modelName: own?.model || (findModel(modelKey)?.name ?? modelKey),
    vaeKey: vaeNode ? text(vaeNode.data.inputs.vae_model) || null : null,
    seed: seed ?? own?.seed ?? randomSeed(),
    steps: own ? (own.steps ?? 1) : num(resolve(g, denoise, 'steps').value, 1),
    cfgScale: own ? (own.cfg ?? 0) : num(resolve(g, denoise, 'cfg_scale').value, 0),
    cfgRescale: 0,
    scheduler: (text(resolve(g, denoise, 'scheduler').value) || 'euler') as SchedulerName,
    width: size('width'),
    height: size('height'),
    clipSkip: 0,
    seamlessX: false,
    seamlessY: false,
    loras,
    workflowName: g.meta.name || t('workflows.untitled'),
    ...(fromPicture ? { strength: Math.round((1 - num(resolve(g, denoise, 'denoising_start').value, 0)) * 100) / 100 } : {}),
    // A video: its frames and speed.
    ...(own?.fps !== undefined ? { videoFps: own.fps, ...(own.length !== undefined ? { videoFrames: own.length } : {}) } : {}),
  };
  return {
    origin: 'workflows',
    destination: 'gallery',
    params,
    iterations: useParams.getState().iterations,
    randomizeSeed: random,
    prepend: opts.prepend,
    boardId: saveBoardId(g),
    workflow,
    comfyGraph: graph,
  };
}

function saveBoardId(g: EditorGraph): string | null {
  const save = g.nodes.find((n) => n.data.type === 'save_image');
  const board = save?.data.inputs.board;
  return !save || board === 'auto' || board === undefined ? autoAddBoardId() : board === 'none' || board === null ? null : String(board);
}

/** The queue request for the graph: the ComfyUI prompt it compiles to, or the video request of a graph with a Generate Video node. */
export function buildRequest(g: EditorGraph, workflow: unknown, opts: { prepend: boolean }): EnqueueRequest {
  if (runsAsPrompt(g)) return buildComfyRequest(g, workflow, opts);
  return buildVideoRequest(g, g.nodes.find((n) => n.data.type === 'video_generate')!, workflow, opts);
}
