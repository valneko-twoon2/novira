// Compiles an editor graph into a ComfyUI API prompt. Built-in nodes become ComfyUI core nodes; the nodes of ComfyUI
// itself and of custom node packs go through as they are. What only the backend knows is left as placeholders
// it fills in: `{ $model: key }` (a model file), `{ $image: name }` (a gallery picture to upload), `{ $sampler_name }`
// and `{ $scheduler }` (from an editor scheduler name), `{ $seed: true }` (the seed of the queue item) and
// `{ $speech: {...} }` (text the voice engine reads aloud before the run, loaded as a sound).
import type { ComfyGraph, ComfyPromptNode } from '@/backend';
import { findImage } from '@/state/gallery';
import type { EditorGraph, WorkflowNode } from '@/state/workflows/workflows';
import { isComfyNodeType } from './comfyNodes';
import { incomingEdge } from './graph';
import { getTemplate, isActive } from './templates';

/** A part of the graph ComfyUI cannot run; `reason` picks the message shown to the user. */
export class ComfyGraphError extends Error {
  constructor(
    readonly reason: 'unsupported' | 'missingInput' | 'noOutput',
    readonly nodeId: string | null,
    readonly field: string | null = null,
  ) {
    super(`${reason}${nodeId ? ` at ${nodeId}` : ''}${field ? `.${field}` : ''}`);
  }
}

type Ref = [string, number];
interface ControlOut {
  loader: Ref;
  image: unknown;
  strength: unknown;
  start: unknown;
  end: unknown;
}
interface IpAdapterOut {
  /** The IP-Adapter model as the prompt names it (`{ $model }`). */
  model: unknown;
  clipVision: string;
  image: Ref;
  weight: unknown;
  weightType: string;
  start: unknown;
  end: unknown;
}
/** What an output of an editor node is in the prompt: a link to a ComfyUI output, a plain value, a ControlNet to apply or an IP-Adapter to apply. */
type Out = { link: Ref } | { value: unknown } | { control: ControlOut } | { ipAdapter: IpAdapterOut };
type Outputs = Record<string, () => Out>;

const link = (id: string, slot: number): Out => ({ link: [id, slot] });
const value = (v: unknown): Out => ({ value: v });

/**
 * Whether the graph runs as the ComfyUI prompt written here. Every graph does but one that makes a video with the
 * Generate Video node and has no node of a custom pack: that one runs on the backend's own video path.
 */
export function runsAsPrompt(g: Pick<EditorGraph, 'nodes'>): boolean {
  return !g.nodes.some((n) => n.data.type === 'video_generate') || g.nodes.some((n) => isComfyNodeType(n.data.type));
}

/** The `weight_type` of `IPAdapterAdvanced` for an editor method (the names `ipadapter_weight_type` in `comfy/graph.rs` uses). */
const IP_WEIGHT_TYPE: Record<string, string> = { full: 'linear', style: 'style transfer', composition: 'composition' };

const RESAMPLE: Record<string, string> = { nearest: 'nearest-exact', box: 'area', bilinear: 'bilinear', hamming: 'bilinear', bicubic: 'bicubic', lanczos: 'lanczos' };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** The result of an Integer Math or Float Math node, or null for an operation it does not have or a result that is no number. */
function calculate(integer: boolean, operation: string, a: number, b: number): number | null {
  let r: number;
  switch (operation) {
    case 'ADD': r = a + b; break;
    case 'SUB': r = a - b; break;
    case 'MUL': r = a * b; break;
    case 'DIV': r = integer ? Math.trunc(a / b) : a / b; break;
    case 'EXP': r = a ** b; break;
    case 'MOD': r = integer ? a - b * Math.trunc(a / b) : NaN; break;
    case 'ABS': r = Math.abs(a); break;
    case 'SQRT': r = integer ? NaN : Math.sqrt(a); break;
    case 'MIN': r = Math.min(a, b); break;
    case 'MAX': r = Math.max(a, b); break;
    default: return null;
  }
  return Number.isFinite(r) ? r : null;
}

class Compiler {
  readonly prompt: Record<string, ComfyPromptNode> = {};
  /** The first fixed sampler seed; it becomes the queue item's seed so repeated runs step it like the other screens do. */
  seed: number | null = null;
  /** A sampler takes a random seed. */
  random = false;
  private readonly compiled = new Map<string, Outputs>();
  /** The nodes whose compile has begun and not ended. */
  private readonly compiling = new Set<string>();
  private readonly byId: Map<string, WorkflowNode>;

  constructor(private readonly g: Pick<EditorGraph, 'nodes' | 'edges'>) {
    this.byId = new Map(g.nodes.map((n) => [n.id, n]));
  }

  add(id: string, classType: string, inputs: Record<string, unknown>): string {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(inputs)) if (v !== undefined) clean[k] = v;
    this.prompt[id] = { class_type: classType, inputs: clean };
    return id;
  }

  outputsOf(node: WorkflowNode): Outputs {
    let outs = this.compiled.get(node.id);
    if (!outs) {
      // Meeting a node again while it is still being compiled means the graph loops back into itself, which ComfyUI
      // cannot run (the editor refuses such a connection, but a file or the assistant can bring one in).
      if (this.compiling.has(node.id)) throw new ComfyGraphError('unsupported', node.id);
      this.compiling.add(node.id);
      try {
        outs = this.compile(node);
      } finally {
        this.compiling.delete(node.id);
      }
      this.compiled.set(node.id, outs);
    }
    return outs;
  }

  /** The connected output feeding `field`, or the node's own value. */
  input(node: WorkflowNode, field: string): Out | undefined {
    const edge = incomingEdge(this.g.edges, node.id, field);
    if (!edge) return field in node.data.inputs ? value(node.data.inputs[field]) : undefined;
    const src = this.byId.get(edge.source);
    const out = src && this.outputsOf(src)[edge.sourceHandle ?? ''];
    if (!out) throw new ComfyGraphError('unsupported', edge.source, edge.sourceHandle ?? null);
    return out();
  }

  /** `field` as a ComfyUI input value (a link or a literal); required ones must be there. */
  arg(node: WorkflowNode, field: string, required = true): unknown {
    const out = this.input(node, field);
    if (!out || ('value' in out && (out.value === null || out.value === undefined))) {
      if (required) throw new ComfyGraphError('missingInput', node.id, field);
      return undefined;
    }
    if ('link' in out) return out.link;
    if ('value' in out) return out.value;
    throw new ComfyGraphError('unsupported', node.id, field);
  }

  /** Width and height of a picture, measured by ComfyUI when it is only known at run time. */
  sizeOf(id: string, image: unknown): Outputs {
    let size: string | null = null;
    const at = (slot: number) => () => {
      size ??= this.add(`${id}:size`, 'GetImageSize', { image });
      return link(size, slot);
    };
    return { width: at(0), height: at(1) };
  }

  /** A picture input as a link: the connected output, or the gallery picture the node holds, loaded by a `LoadImage`. */
  private imageArg(node: WorkflowNode, field: string): Ref {
    if (incomingEdge(this.g.edges, node.id, field)) return this.arg(node, field) as Ref;
    const name = node.data.inputs[field];
    if (typeof name !== 'string' || !name) throw new ComfyGraphError('missingInput', node.id, field);
    return [this.add(`${node.id}:${field}`, 'LoadImage', { image: { $image: name } }), 0];
  }

  private model(node: WorkflowNode, field: string): unknown {
    const key = node.data.inputs[field];
    if (typeof key !== 'string' || !key) throw new ComfyGraphError('missingInput', node.id, field);
    return { $model: key };
  }

  private compile(node: WorkflowNode): Outputs {
    const id = node.id;
    const arg = (field: string, required = true) => this.arg(node, field, required);
    const imageOut = (image: Ref): Outputs => ({ image: () => link(...image), ...this.sizeOf(id, image) });
    switch (node.data.type) {
      case 'main_model_loader':
      case 'sdxl_model_loader':
        this.add(id, 'CheckpointLoaderSimple', { ckpt_name: this.model(node, 'model') });
        return { unet: () => link(id, 0), clip: () => link(id, 1), clip2: () => link(id, 1), vae: () => link(id, 2) };
      case 'vae_loader':
        this.add(id, 'VAELoader', { vae_name: this.model(node, 'vae_model') });
        return { vae: () => link(id, 0) };
      case 'lora_loader': {
        const weight = arg('weight');
        const clip = arg('clip', false);
        if (clip === undefined) {
          this.add(id, 'LoraLoaderModelOnly', { model: arg('unet'), lora_name: this.model(node, 'lora'), strength_model: weight });
          return { unet: () => link(id, 0) };
        }
        this.add(id, 'LoraLoader', { model: arg('unet'), clip, lora_name: this.model(node, 'lora'), strength_model: weight, strength_clip: weight });
        return { unet: () => link(id, 0), clip: () => link(id, 1) };
      }
      case 'compel':
      case 'sdxl_compel_prompt':
        this.add(id, 'CLIPTextEncode', { text: this.arg(node, 'prompt', false) ?? '', clip: arg('clip') });
        return { conditioning: () => link(id, 0) };
      case 'noise':
        this.add(id, 'EmptyLatentImage', { width: arg('width'), height: arg('height'), batch_size: 1 });
        return { noise: () => link(id, 0), width: () => this.input(node, 'width')!, height: () => this.input(node, 'height')! };
      case 'denoise_latents':
        return this.denoise(node);
      case 'l2i':
        this.add(id, 'VAEDecode', { samples: arg('latents'), vae: arg('vae') });
        return imageOut([id, 0]);
      case 'i2l': {
        const image = this.imageArg(node, 'image');
        this.add(id, 'VAEEncode', { pixels: image, vae: arg('vae') });
        return { latents: () => link(id, 0), ...this.sizeOf(id, image) };
      }
      case 'image': {
        if (incomingEdge(this.g.edges, id, 'image')) {
          const passed = this.input(node, 'image')!;
          return { image: () => passed, ...this.sizeOf(id, this.arg(node, 'image')) };
        }
        const name = node.data.inputs.image;
        if (typeof name !== 'string' || !name) throw new ComfyGraphError('missingInput', id, 'image');
        this.add(id, 'LoadImage', { image: { $image: name } });
        const known = findImage(name);
        return {
          image: () => link(id, 0),
          ...(known ? { width: () => value(known.width), height: () => value(known.height) } : this.sizeOf(id, [id, 0])),
        };
      }
      case 'img_resize':
        this.add(id, 'ImageScale', {
          image: this.imageArg(node, 'image'),
          upscale_method: RESAMPLE[String(node.data.inputs.resample_mode)] ?? 'bicubic',
          width: arg('width'),
          height: arg('height'),
          crop: 'disabled',
        });
        return imageOut([id, 0]);
      case 'canny_edge_detection': {
        const threshold = (field: string, fallback: number) => clamp(num(node.data.inputs[field], fallback) / 255, 0.01, 0.99);
        this.add(id, 'Canny', { image: this.imageArg(node, 'image'), low_threshold: threshold('low_threshold', 100), high_threshold: threshold('high_threshold', 200) });
        return imageOut([id, 0]);
      }
      case 'controlnet': {
        this.add(id, 'ControlNetLoader', { control_net_name: this.model(node, 'control_model') });
        const control: ControlOut = {
          loader: [id, 0],
          image: this.imageArg(node, 'image'),
          strength: arg('control_weight'),
          start: arg('begin_step_percent'),
          end: arg('end_step_percent'),
        };
        return { control: () => ({ control }) };
      }
      case 'img_blur': {
        if (node.data.inputs.blur_type === 'box') throw new ComfyGraphError('unsupported', id, 'blur_type');
        const radius = num(node.data.inputs.radius, 8);
        this.add(id, 'ImageBlur', { image: this.imageArg(node, 'image'), blur_radius: clamp(Math.round(radius), 1, 31), sigma: clamp(radius / 3, 0.1, 10) });
        return imageOut([id, 0]);
      }
      case 'spandrel_image_to_image': {
        const loader = this.add(`${id}:model`, 'UpscaleModelLoader', { model_name: this.model(node, 'image_to_image_model') });
        this.add(id, 'ImageUpscaleWithModel', { upscale_model: [loader, 0], image: this.imageArg(node, 'image') });
        return imageOut([id, 0]);
      }
      case 'ip_adapter': {
        const ipAdapter: IpAdapterOut = {
          model: this.model(node, 'ip_adapter_model'),
          clipVision: String(node.data.inputs.clip_vision_model ?? 'ViT-H'),
          image: this.imageArg(node, 'image'),
          weight: arg('weight'),
          weightType: IP_WEIGHT_TYPE[String(node.data.inputs.method)] ?? 'linear',
          start: arg('begin_step_percent'),
          end: arg('end_step_percent'),
        };
        return { ip_adapter: () => ({ ipAdapter }) };
      }
      case 'integer_math':
      case 'float_math': {
        // ComfyUI has no core node for this, so the sum is worked out here from plain numbers.
        const result = calculate(node.data.type === 'integer_math', String(node.data.inputs.operation), this.number(node, 'a'), this.number(node, 'b'));
        if (result === null) throw new ComfyGraphError('unsupported', id, 'operation');
        return { value: () => value(result) };
      }
      case 'voice_speak': {
        // The sound does not exist yet: the backend has the voice engine read the text and uploads it where `LoadAudio` looks.
        const mode = this.text(node, 'mode', false) === 'design' ? 'design' : 'preset';
        const speech = {
          text: this.text(node, 'text', true),
          language: this.text(node, 'language', false) || 'Auto',
          mode,
          speaker: this.text(node, 'speaker', false) || 'Ono_Anna',
          instruct: this.text(node, 'instruct', mode === 'design'),
        };
        this.add(id, 'LoadAudio', { audio: { $speech: speech } });
        return { audio: () => link(id, 0) };
      }
      case 'save_image': {
        const image = arg('image') as Ref;
        this.add(id, 'SaveImage', { images: image, filename_prefix: 'novira' });
        return imageOut(image);
      }
      case 'current_image':
        this.add(id, 'PreviewImage', { images: arg('image') });
        return {};
      case 'integer':
      case 'float':
      case 'string':
      case 'boolean':
        return { value: () => value(node.data.inputs.value) };
      case 'rand_int':
        return {
          value: () => {
            this.random = true;
            return value({ $seed: true });
          },
        };
      default:
        if (isComfyNodeType(node.data.type)) return this.packNode(node);
        throw new ComfyGraphError('unsupported', id);
    }
  }

  /** `field` as a text known now (typed in the node or from a String node); a required one must not be empty. */
  private text(node: WorkflowNode, field: string, required: boolean): string {
    const out = this.input(node, field);
    if (!out || !('value' in out) || out.value === undefined || out.value === null) {
      if (out && !('value' in out)) throw new ComfyGraphError('unsupported', node.id, field);
      if (required) throw new ComfyGraphError('missingInput', node.id, field);
      return '';
    }
    const text = String(out.value).trim();
    if (required && !text) throw new ComfyGraphError('missingInput', node.id, field);
    return text;
  }

  /** `field` as a number known now: neither a link nor a value only the run knows (a random seed). */
  private number(node: WorkflowNode, field: string): number {
    const out = this.input(node, field);
    if (out && 'value' in out && typeof out.value === 'number') return out.value;
    throw new ComfyGraphError(out && 'value' in out && (out.value === undefined || out.value === null) ? 'missingInput' : 'unsupported', node.id, field);
  }

  /** The model the sampler runs: the UNet, patched by the IP-Adapter wired to the sampler. */
  private patchedModel(node: WorkflowNode): unknown {
    const id = node.id;
    let model = this.arg(node, 'unet');
    if (incomingEdge(this.g.edges, id, 'ip_adapter')) {
      const ip = this.input(node, 'ip_adapter');
      if (!ip || !('ipAdapter' in ip)) throw new ComfyGraphError('unsupported', id, 'ip_adapter');
      const c = ip.ipAdapter;
      const loader = this.add(`${id}:ipadapter`, 'IPAdapterModelLoader', { ipadapter_file: c.model });
      const vision = this.add(`${id}:clipvision`, 'CLIPVisionLoader', { clip_name: { $clip_vision: c.clipVision } });
      const apply = this.add(`${id}:ipapply`, 'IPAdapterAdvanced', {
        model,
        ipadapter: [loader, 0],
        image: c.image,
        weight: c.weight,
        weight_type: c.weightType,
        combine_embeds: 'concat',
        start_at: clamp(num(c.start, 0), 0, 1),
        end_at: clamp(num(c.end, 1), 0, 1),
        embeds_scaling: 'V only',
        clip_vision: [vision, 0],
      });
      model = [apply, 0];
    }
    return model;
  }

  private denoise(node: WorkflowNode): Outputs {
    const id = node.id;
    let positive = this.arg(node, 'positive_conditioning');
    let negative = this.arg(node, 'negative_conditioning');
    const control = incomingEdge(this.g.edges, id, 'control') ? this.input(node, 'control') : undefined;
    if (control) {
      if (!('control' in control)) throw new ComfyGraphError('unsupported', id, 'control');
      const c = control.control;
      const apply = this.add(`${id}:control`, 'ControlNetApplyAdvanced', {
        positive,
        negative,
        control_net: c.loader,
        image: c.image,
        strength: c.strength,
        start_percent: c.start,
        end_percent: c.end,
      });
      positive = [apply, 0];
      negative = [apply, 1];
    }
    // The seed is the noise node's; a source picture (image-to-image) replaces the empty latent.
    const noiseEdge = incomingEdge(this.g.edges, id, 'noise');
    const noiseNode = noiseEdge ? this.byId.get(noiseEdge.source) : undefined;
    let seed = noiseNode?.data.type === 'noise' ? this.arg(noiseNode, 'seed') : { $seed: true };
    if (typeof seed === 'number' && this.seed === null) {
      this.seed = seed;
      seed = { $seed: true };
    } else if (typeof seed === 'object' && seed !== null && '$seed' in seed) this.random = true;
    const fromPicture = !!incomingEdge(this.g.edges, id, 'latents');
    const latent = fromPicture ? this.arg(node, 'latents') : this.arg(node, 'noise');
    const scheduler = String(this.arg(node, 'scheduler'));
    const model = this.patchedModel(node);
    this.add(id, 'KSampler', {
      model,
      seed,
      steps: this.arg(node, 'steps'),
      cfg: this.arg(node, 'cfg_scale'),
      sampler_name: { $sampler_name: scheduler },
      scheduler: { $scheduler: scheduler },
      positive,
      negative,
      latent_image: latent,
      denoise: fromPicture ? clamp(1 - num(node.data.inputs.denoising_start, 0), 0, 1) : 1,
    });
    const size = (field: 'width' | 'height') => () => {
      if (!noiseNode) throw new ComfyGraphError('unsupported', id, field);
      return this.outputsOf(noiseNode)[field]!();
    };
    return { latents: () => link(id, 0), width: size('width'), height: size('height') };
  }

  /**
   * The node that gives the first frame of the video `node` saves, added next to it: ComfyUI's own nodes take the
   * frames out of the video (`GetVideoComponents`), keep the first, and show it. Null when the node saves no video.
   */
  thumbnailOf(node: WorkflowNode): string | null {
    const field = getTemplate(node.data.type)?.inputs.find((i) => i.type === 'comfy:VIDEO' && incomingEdge(this.g.edges, node.id, i.name));
    if (!field) return null;
    const parts = this.add(`${node.id}:parts`, 'GetVideoComponents', { video: this.arg(node, field.name) });
    const first = this.add(`${node.id}:first`, 'ImageFromBatch', { image: [parts, 0], batch_index: 0, length: 1 });
    return this.add(`${node.id}:frame`, 'PreviewImage', { images: [first, 0] });
  }

  private packNode(node: WorkflowNode): Outputs {
    const template = getTemplate(node.data.type);
    if (!template?.comfyClass) throw new ComfyGraphError('unsupported', node.id);
    const inputs: Record<string, unknown> = {};
    for (const input of template.inputs) {
      // An input of a choice that is not made (the quality of an MP3 while the format is FLAC) is not sent.
      if (!isActive(input, node.data.inputs)) continue;
      const connected = !!incomingEdge(this.g.edges, node.id, input.name);
      if (!connected && input.input === 'connection') {
        if (input.required) throw new ComfyGraphError('missingInput', node.id, input.name);
        continue;
      }
      if (!connected && input.type === 'ImageField') {
        const name = node.data.inputs[input.name];
        if (typeof name === 'string' && name) inputs[input.promptName ?? input.name] = { $image: name };
        else if (input.required) throw new ComfyGraphError('missingInput', node.id, input.name);
        continue;
      }
      // A value the node never held (it was saved before the input existed) takes the input's default.
      const given = this.arg(node, input.name, false) ?? (connected || input.input === 'connection' ? undefined : (input.default ?? undefined));
      // A choice that is a number in ComfyUI's list goes back as that number.
      const index = input.values && typeof given === 'string' ? (input.options ?? []).indexOf(given) : -1;
      inputs[input.promptName ?? input.name] = index >= 0 ? input.values![index] : given;
    }
    this.add(node.id, template.comfyClass, inputs);
    return Object.fromEntries(template.outputs.map((o, slot) => [o.name, () => link(node.id, slot)]));
  }
}

export interface CompiledGraph {
  graph: ComfyGraph;
  /** The seed to queue with (null: none is fixed). */
  seed: number | null;
  /** Some seed is random, so each run takes a fresh one. */
  random: boolean;
}

/** An output node of ComfyUI that takes a video or a sound (Save Video, Save Audio, Preview Audio). */
const savesMedia = (type: string) => !!getTemplate(type)?.isOutput && !!getTemplate(type)?.inputs.some((i) => i.type === 'comfy:VIDEO' || i.type === 'comfy:AUDIO');

/** The prompt for the graph and the nodes whose results to keep, most wanted first. */
export function compileComfyPrompt(g: Pick<EditorGraph, 'nodes' | 'edges'>): CompiledGraph {
  const c = new Compiler(g);
  const outputs: string[] = [];
  // A graph that saves a video or a sound is about that: it comes before a picture it also shows on the way.
  const rank = (n: WorkflowNode) => (savesMedia(n.data.type) ? -1 : n.data.type === 'save_image' ? 0 : isComfyNodeType(n.data.type) ? 1 : n.data.type === 'current_image' ? 2 : 3);
  const ends = g.nodes.filter((n) => getTemplate(n.data.type)?.isOutput).sort((a, b) => rank(a) - rank(b));
  if (!ends.length) throw new ComfyGraphError('noOutput', null);
  for (const n of ends) {
    if (n.data.type === 'video_generate') throw new ComfyGraphError('unsupported', n.id);
    const outs = c.outputsOf(n);
    if (n.data.type === 'l2i') {
      // A decoded picture nothing saves is still shown: preview it.
      const used = g.edges.some((e) => e.source === n.id && e.sourceHandle === 'image');
      if (used) continue;
      const image = outs.image!();
      outputs.push(c.add(`${n.id}:preview`, 'PreviewImage', { images: 'link' in image ? image.link : undefined }));
      continue;
    }
    outputs.push(n.id);
  }
  if (!outputs.length) {
    // The picture ends at a pack node nothing reads from: preview its image output.
    for (const n of g.nodes) {
      const template = getTemplate(n.data.type);
      if (!isComfyNodeType(n.data.type) || !template) continue;
      const free = template.outputs.find((o) => o.type === 'ImageField' && !g.edges.some((e) => e.source === n.id && e.sourceHandle === o.name));
      if (!free) continue;
      const image = c.outputsOf(n)[free.name]!();
      if ('link' in image) outputs.push(c.add(`${n.id}:preview`, 'PreviewImage', { images: image.link }));
    }
  }
  if (!outputs.length) throw new ComfyGraphError('noOutput', null);
  // The first output is the result; when it is a video, the gallery also needs a first frame for it.
  const lead = g.nodes.find((n) => n.id === outputs[0]);
  const thumbnail = lead ? c.thumbnailOf(lead) : null;
  return { graph: { prompt: c.prompt, outputs, ...(thumbnail ? { thumbnail } : {}) }, seed: c.seed, random: c.random };
}
