// What a "finish with AI" run asks the engine for: which model paints, how strongly, and the queue request.
import type { ControlLayerInput, EnqueueRequest, ModelConfig } from '@/backend';
import { modelProfile } from '@/state/modelProfile';
import { drawableModels } from '@/state/models';
import { pickLineModel } from '@/state/poseSkeleton';
import { recommendedPrompts } from '@/state/recommendedPrompts';
import { RICH_LOOKS, type RichLookId } from '@/state/text/richLooks';

export interface RichPlan {
  /** The model that paints, or null when none can draw. */
  model: ModelConfig | null;
  /** The ControlNet that reads the letters' outline, or null: then the run stays gentle so the letters hold. */
  control: ModelConfig | null;
}

/**
 * Which model paints. The user's choice when it is still installed; otherwise the Generate tab's model when a line
 * ControlNet exists for its family; otherwise another drawable model that has one (SDXL first, then by name); otherwise
 * the Generate tab's model, or the first drawable one, with no ControlNet.
 */
export function richPlan(models: ModelConfig[], chosenKey: string | null, generateKey: string | null): RichPlan {
  const drawable = drawableModels(models);
  const withLine = (m: ModelConfig): RichPlan => ({ model: m, control: pickLineModel(models, m.base) });
  const chosen = chosenKey ? drawable.find((m) => m.key === chosenKey) : undefined;
  if (chosen) return withLine(chosen);
  const generate = generateKey ? drawable.find((m) => m.key === generateKey) : undefined;
  if (generate) {
    const plan = withLine(generate);
    if (plan.control) return plan;
  }
  const others = drawable
    .filter((m) => pickLineModel(models, m.base))
    .sort((a, b) => Number(b.base === 'sdxl') - Number(a.base === 'sdxl') || a.name.localeCompare(b.name));
  if (others[0]) return withLine(others[0]);
  const fallback = generate ?? drawable[0];
  return { model: fallback ?? null, control: null };
}

/** The denoise a strength of 0..100 stands for: wide with a line ControlNet to hold the letters, narrow without one. */
export function richDenoise(strength: number, hasControl: boolean): number {
  const s = Math.min(100, Math.max(0, strength)) / 100;
  return hasControl ? 0.6 + s * 0.4 : 0.35 + s * 0.2;
}

/** Words that keep the model from writing letters of its own or framing the picture. */
const NEGATIVE_EXTRA = ['text', 'subtitle', 'caption', 'extra letters', 'reflection', 'mirror image', 'watermark', 'signature', 'photo frame'];

const parts = (text: string) =>
  text
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);

/** `base` followed by the words of `extra` that it does not have yet, comma separated. */
function joinWords(base: string, extra: string[]): string {
  const seen = new Set(parts(base).map((w) => w.toLowerCase()));
  const added = extra.filter((w) => !seen.has(w.toLowerCase()));
  return [...parts(base), ...added].join(', ');
}

export interface RichRequestInput {
  model: ModelConfig;
  control: ModelConfig | null;
  look: RichLookId | null;
  words: string;
  /** 0..100. */
  strength: number;
  seed: number;
  /** The stored base picture and, with a ControlNet, the line picture. */
  sourceUrl: string;
  lineUrl: string | null;
  width: number;
  height: number;
}

/** The prompts: the quality words of the model's family, the look's words and the user's words; the negative keeps letters of its own out. */
export function richPrompts(model: ModelConfig, look: RichLookId | null, words: string): { positive: string; negative: string } {
  const rec = recommendedPrompts(model);
  const described = [look ? RICH_LOOKS[look].words : '', ...parts(words)].filter(Boolean).join(', ');
  const positive = rec.place === 'first' ? [rec.positive, described] : [described, rec.positive];
  return {
    positive: positive.filter(Boolean).join(', '),
    // A family that reads no negative prompt is given none.
    negative: rec.negative === '' ? '' : joinWords(rec.negative, NEGATIVE_EXTRA),
  };
}

/** The queue request of one picture: an image-to-image run of the lit base (with the line ControlNet when there is one), kept as an intermediate. */
export function buildRichRequest(input: RichRequestInput): EnqueueRequest {
  const { model, control } = input;
  const profile = modelProfile(model);
  const { positive, negative } = richPrompts(model, input.look, input.words);
  const controlLayers: ControlLayerInput[] =
    control && input.lineUrl ? [{ imageUrl: input.lineUrl, modelKey: control.key, weight: 1, beginEnd: [0, 1], controlMode: 'balanced', controlType: 'lineart' }] : [];
  return {
    origin: 'generate',
    destination: 'intermediate',
    iterations: 1,
    randomizeSeed: false,
    prepend: false,
    boardId: null,
    initImageUrl: input.sourceUrl,
    params: {
      generationMode: 'img2img',
      strength: richDenoise(input.strength, controlLayers.length > 0),
      positivePrompt: positive,
      negativePrompt: negative,
      modelKey: model.key,
      modelName: model.name,
      vaeKey: null,
      seed: input.seed,
      steps: profile.steps,
      cfgScale: profile.cfgScale,
      cfgRescale: 0,
      scheduler: profile.scheduler,
      width: input.width,
      height: input.height,
      clipSkip: 0,
      seamlessX: false,
      seamlessY: false,
      loras: [],
      ...(controlLayers.length ? { controlLayerCount: 1 } : {}),
    },
    ...(controlLayers.length ? { controlLayers } : {}),
  };
}
