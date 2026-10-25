// What a graph of ComfyUI's own nodes tells the gallery about itself: the settings of its first sampler, the text it
// was given, the model it loads and the size of what it draws. Only what can be read off the compiled prompt is
// reported; the rest stays unknown, so the picture's information shows nothing instead of a guess.
import type { ComfyPromptNode } from '@/backend';

export interface PromptSummary {
  positive: string;
  negative: string;
  /** The file of the first model loader. */
  model: string;
  seed?: number;
  steps?: number;
  cfg?: number;
  width?: number;
  height?: number;
  /** Frames of a video, or seconds of a sound. */
  length?: number;
  fps?: number;
}

type Prompt = Record<string, ComfyPromptNode>;

const SAMPLERS = new Set(['KSampler', 'KSamplerAdvanced']);
/** Inputs that carry a text, then those that pass the conditioning on; a hop follows the first it finds. */
const TEXT_INPUTS = ['text', 'tags', 'prompt'];
const PASS_INPUTS = ['conditioning', 'positive', 'negative', 'conditioning_1'];
const LOADERS: [string, string][] = [
  ['UNETLoader', 'unet_name'],
  ['CheckpointLoaderSimple', 'ckpt_name'],
  ['DiffusersLoader', 'model_path'],
  ['unCLIPCheckpointLoader', 'ckpt_name'],
];
const MAX_HOPS = 12;

const isLink = (v: unknown): v is [string, number] => Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && typeof v[1] === 'number';
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

const VOICE_MODEL_NAME = 'Qwen3-TTS';

/** The text of a `{ $speech }` placeholder, when `value` is one. */
function speechOf(value: unknown): string | undefined {
  const speech = typeof value === 'object' && value !== null ? (value as { $speech?: unknown }).$speech : undefined;
  return typeof speech === 'object' && speech !== null ? str((speech as { text?: unknown }).text) : undefined;
}

/** The text behind a conditioning link: the text a prompt node holds, found through the nodes that only pass it on. */
function textOf(prompt: Prompt, link: unknown): string {
  let at = link;
  for (let hop = 0; hop < MAX_HOPS && isLink(at); hop++) {
    const node = prompt[at[0]];
    if (!node) return '';
    for (const name of TEXT_INPUTS) {
      const text = str(node.inputs[name]);
      if (text !== undefined) return text;
    }
    at = PASS_INPUTS.map((name) => node.inputs[name]).find(isLink);
  }
  return '';
}

/** The first node, following latent links upstream, that says how big the latent is. */
function latentOf(prompt: Prompt, link: unknown): Pick<PromptSummary, 'width' | 'height' | 'length'> {
  let at = link;
  for (let hop = 0; hop < MAX_HOPS && isLink(at); hop++) {
    const inputs = prompt[at[0]]?.inputs;
    if (!inputs) return {};
    const width = num(inputs.width);
    const height = num(inputs.height);
    const length = num(inputs.length) ?? num(inputs.seconds);
    if (width !== undefined || height !== undefined || length !== undefined) return { width, height, length };
    at = ['latent_image', 'samples', 'latent', 'latent_1'].map((name) => inputs[name]).find(isLink);
  }
  return {};
}

/** The summary of a compiled prompt; every field the prompt does not give is left out (`positive`, `negative` and `model` are empty). */
export function summarizePrompt(prompt: Prompt): PromptSummary {
  const nodes = Object.values(prompt);
  const sampler = nodes.find((n) => SAMPLERS.has(n.class_type));
  const loader = LOADERS.map(([cls, field]) => str(nodes.find((n) => n.class_type === cls)?.inputs[field])).find((f) => f !== undefined);
  const video = nodes.find((n) => n.class_type === 'CreateVideo');
  const inputs = sampler?.inputs ?? {};
  // A graph that has text read aloud (the Read Aloud node) shows that text and the voice engine.
  const spoken = nodes.map((n) => speechOf(n.inputs.audio)).find((s) => s !== undefined);
  return {
    positive: textOf(prompt, inputs.positive) || (spoken ?? ''),
    negative: textOf(prompt, inputs.negative),
    model: loader ?? (spoken !== undefined ? VOICE_MODEL_NAME : ''),
    seed: num(inputs.seed) ?? num(inputs.noise_seed),
    steps: num(inputs.steps),
    cfg: num(inputs.cfg),
    ...latentOf(prompt, inputs.latent_image),
    fps: num(video?.inputs.fps),
  };
}
