// Turns the parameter store into a queue batch (GenerationMetadata + EnqueueRequest).
import { backend, batchSeed, randomSeed, type EnqueueRequest, type GenerationMetadata, type QueueOrigin } from '@/backend';
import { autoAddBoardId } from '@/state/invoke';
import { findModel, modelsOfType, useModels } from '@/state/models';
import { generationMetadata, txt2imgParts } from '@/state/generationParts';
import { useParams } from '@/state/params';
import { useWildcards, wildcardMap } from '@/state/prompts/wildcards';
import { expandPrompt, hasDynamicSyntax, MAX_DYNAMIC_PROMPTS, randomPrompt } from '@/state/prompts/dynamicPrompts';

const NEGATIVE_SEED_MIX = 0x5bd1e995;

function baseRequest(origin: QueueOrigin, params: GenerationMetadata, prepend: boolean): EnqueueRequest {
  const p = useParams.getState();
  return {
    origin,
    destination: 'gallery',
    params,
    iterations: p.iterations,
    randomizeSeed: p.shouldRandomizeSeed,
    prepend,
    boardId: autoAddBoardId(),
  };
}

/**
 * The batches a request with dynamic prompts ({a|b} groups, __wildcards__) becomes. Every combination: one batch per
 * expanded prompt, each with the request's count. Random: one picture per count, each with its own seed (the
 * request's seed + i, or a random one) and the prompt that seed picks, so a picture drawn again with its seed gets
 * the same prompt.
 */
export function dynamicBatches(req: EnqueueRequest): EnqueueRequest[] {
  const template = req.params.positivePrompt;
  const negativeTemplate = req.params.negativePrompt ?? '';
  const lists = wildcardMap(useWildcards.getState().lists);
  if (useParams.getState().dynamicPromptMode === 'random' && (hasDynamicSyntax(template) || hasDynamicSyntax(negativeTemplate))) {
    return Array.from({ length: Math.max(1, req.iterations) }, (_, i) => {
      const seed = req.randomizeSeed ? randomSeed() : batchSeed(req.params.seed, i);
      // The negative picks from the seed too, mixed so it does not pick the same place as the positive.
      const negativePrompt = hasDynamicSyntax(negativeTemplate) ? randomPrompt(negativeTemplate, lists, (seed ^ NEGATIVE_SEED_MIX) >>> 0) : negativeTemplate;
      return { ...req, iterations: 1, randomizeSeed: false, params: { ...req.params, seed, positivePrompt: randomPrompt(template, lists, seed), negativePrompt } };
    });
  }
  const positives = expandPrompt(template, undefined, lists);
  // A plain negative prompt is sent as it is, not tidied.
  const negatives = hasDynamicSyntax(negativeTemplate) ? expandPrompt(negativeTemplate, undefined, lists) : [negativeTemplate];
  // Every positive with every negative, up to the same cap as one prompt alone.
  const pairs = (positives.length ? positives : ['']).flatMap((positivePrompt) => (negatives.length ? negatives : [negativeTemplate]).map((negativePrompt) => ({ positivePrompt, negativePrompt })));
  return pairs.slice(0, MAX_DYNAMIC_PROMPTS).map((texts) => ({ ...req, params: { ...req.params, ...texts } }));
}

/**
 * Dynamic prompts produce several batches. The extra batches are enqueued here;
 * the first one is returned to the caller (invoke()) which enqueues it.
 */
async function withDynamicPrompts(req: EnqueueRequest): Promise<EnqueueRequest> {
  const [first, ...rest] = dynamicBatches(req);
  const ordered = req.prepend ? [...rest].reverse() : rest;
  for (const batch of ordered) await backend.enqueue(batch);
  return first!;
}

export async function buildGenerateRequest(prepend: boolean): Promise<EnqueueRequest> {
  const { params, refImages } = txt2imgParts();
  return withDynamicPrompts({ ...baseRequest('generate', params, prepend), ...(refImages.length ? { refImages } : {}) });
}

export async function buildUpscaleRequest(prepend: boolean): Promise<EnqueueRequest> {
  const u = useParams.getState().upscale;
  const img = u.initialImage;
  // The tile ControlNet is optional (Anima, Qwen-Image and others have none): one that does not fit the main model is left out.
  const main = findModel(useParams.getState().modelKey);
  const tile = modelsOfType(useModels.getState().models, 'controlnet', main?.base).find((m) => m.key === u.tileControlnetModelKey);
  const params: GenerationMetadata = {
    ...generationMetadata('upscale'),
    width: img?.width ?? 0,
    height: img?.height ?? 0,
    upscaleScale: u.scale,
    upscaleModelKey: u.upscaleModelKey ?? undefined,
    tileControlnetModelKey: tile?.key,
    postProcessingModelKey: u.postProcessingModelKey ?? undefined,
    creativity: u.creativity,
    structure: u.structure,
  };
  const req = { ...baseRequest('upscaling', params, prepend), initImageUrl: img?.url ?? null };
  return withDynamicPrompts(req);
}
