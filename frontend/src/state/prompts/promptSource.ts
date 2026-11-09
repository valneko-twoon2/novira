// Where a set of prompt boxes reads and writes its two prompts: the image form, or another screen's own form.
import type { ModelConfig } from '@/backend';
import type { PromptKind } from './promptBook';

export interface PromptSource {
  /** Hook: the current text of a box. */
  useText: (kind: PromptKind) => string;
  get: (kind: PromptKind) => string;
  set: (kind: PromptKind, text: string) => void;
  /** Hook: the model the recommended words are for. */
  useModel: () => ModelConfig | undefined;
  /** False where the prompt book, the caption from a picture and dynamic prompts have nothing to act on: they work on the image form. */
  generateTools: boolean;
}
