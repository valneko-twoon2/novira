// Reads / writes the two prompts.
import type { ModelConfig } from '@/backend';
import { useParams } from '@/state/params';
import type { PromptKind } from '@/state/prompts/promptBook';
import { recommendedPrompts } from '../model/recommendedPrompts';
import { withTagsFirst, withTagsLast } from '@/state/prompts/promptTags';

export const getPrompt = (kind: PromptKind): string => {
  const p = useParams.getState();
  return kind === 'positive' ? p.positivePrompt : p.negativePrompt;
};

export function setPrompt(kind: PromptKind, text: string) {
  useParams.getState().set(kind === 'positive' ? { positivePrompt: text } : { negativePrompt: text });
}

/**
 * Adds the model family's quality words to the positive prompt (in front for a tag model, after the description for a
 * model that reads sentences) and its usual negative words to the end of the negative one; words already there stay once.
 */
export function applyRecommendedPrompts(model: ModelConfig | undefined) {
  const r = recommendedPrompts(model);
  const positive = getPrompt('positive');
  setPrompt('positive', r.place === 'first' ? withTagsFirst(positive, r.positive) : withTagsLast(positive, r.positive));
  if (r.negative) setPrompt('negative', withTagsLast(getPrompt('negative'), r.negative));
}
