// Reads / writes the two prompts.
import type { ModelConfig } from '@/backend';
import { useParams } from '@/state/params';
import type { PromptKind } from '@/state/prompts/promptBook';
import type { PromptSource } from '@/state/prompts/promptSource';
import { recommendedPrompts } from '@/state/recommendedPrompts';
import { withTagsFirst, withTagsLast } from '@/state/prompts/promptTags';
import { useMainModel } from '../model/useMainModel';

export const getPrompt = (kind: PromptKind): string => {
  const p = useParams.getState();
  return kind === 'positive' ? p.positivePrompt : p.negativePrompt;
};

export function setPrompt(kind: PromptKind, text: string) {
  useParams.getState().set(kind === 'positive' ? { positivePrompt: text } : { negativePrompt: text });
}

/** The image form's two prompts. */
export const imagePromptSource: PromptSource = {
  useText: (kind) => useParams((s) => (kind === 'positive' ? s.positivePrompt : s.negativePrompt)),
  get: getPrompt,
  set: setPrompt,
  useModel: useMainModel,
  generateTools: true,
};

/**
 * Adds the model family's quality words to the positive prompt (in front for a tag model, after the description for a
 * model that reads sentences) and its usual negative words to the end of the negative one; words already there stay once.
 * `kind` limits it to one of the two prompts (each prompt has its own button); none does both.
 */
export function applyRecommendedPrompts(model: ModelConfig | undefined, source: PromptSource = imagePromptSource, kind?: PromptKind) {
  const r = recommendedPrompts(model);
  if (kind !== 'negative') {
    const positive = source.get('positive');
    source.set('positive', r.place === 'first' ? withTagsFirst(positive, r.positive) : withTagsLast(positive, r.positive));
  }
  if (kind !== 'positive' && r.negative) source.set('negative', withTagsLast(source.get('negative'), r.negative));
}
