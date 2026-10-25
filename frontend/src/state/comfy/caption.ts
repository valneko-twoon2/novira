// The ComfyUI prompt that describes a picture in words, ready to use as a prompt: Florence-2 (ComfyUI-Florence2 pack,
// catalog id `florence2`) with the PromptGen model made for prompts, and ComfyUI's "Preview as Text" node, whose text
// the queue item brings back (`runTextJob`).
import type { ComfyGraph, ComfyNodeDefs } from '@/backend';

/** The node that writes the text; also how the app knows the pack is loaded. */
export const CAPTION_NODE = 'Florence2Run';
export const CAPTION_LOADER = 'DownloadAndLoadFlorence2Model';
/** The catalog id of the pack. */
export const CAPTION_PACK = 'florence2';

/** Tags (`1girl, blue hair, smile`) or a sentence that describes the picture. */
export type CaptionStyle = 'tags' | 'sentence';

/** The Florence-2 task of each style. PromptGen answers both; the sentence is its most detailed caption. */
export const CAPTION_TASKS: Record<CaptionStyle, string> = { tags: 'prompt_gen_tags', sentence: 'more_detailed_caption' };

/** Trained to write prompts (Danbooru-style tags and detailed captions); the base size is quick and small. */
export const PREFERRED_CAPTION_MODEL = 'MiaoshouAI/Florence-2-base-PromptGen-v2.0';

/** The model the loader offers that suits prompts best: the preferred one, another PromptGen model, or its first. */
export function captionModel(defs: ComfyNodeDefs | null): string | null {
  const spec = defs?.[CAPTION_LOADER]?.input.required?.model;
  const choices = Array.isArray(spec) && Array.isArray(spec[0]) ? spec[0].map(String) : [];
  return choices.find((m) => m === PREFERRED_CAPTION_MODEL) ?? choices.find((m) => /PromptGen/i.test(m)) ?? choices[0] ?? null;
}

/** Whether the pack's nodes are loaded in ComfyUI. */
export function captionReady(defs: ComfyNodeDefs | null): boolean {
  return !!defs?.[CAPTION_NODE] && !!captionModel(defs);
}

/** Picture in, its description out as text (no picture is saved). */
export function buildCaptionGraph(imageName: string, o: { style: CaptionStyle; model: string }): ComfyGraph {
  return {
    prompt: {
      source: { class_type: 'LoadImage', inputs: { image: { $image: imageName } } },
      model: { class_type: CAPTION_LOADER, inputs: { model: o.model, precision: 'fp16', convert_to_safetensors: false } },
      caption: {
        class_type: CAPTION_NODE,
        inputs: {
          image: ['source', 0],
          florence2_model: ['model', 0],
          text_input: '',
          task: CAPTION_TASKS[o.style],
          fill_mask: false,
          keep_model_loaded: false,
          max_new_tokens: 1024,
          num_beams: 3,
          // Without sampling the same picture gives the same words.
          do_sample: false,
          output_mask_select: '',
          seed: 1,
        },
      },
      // Florence2Run's outputs are image, mask, caption, data: the caption is slot 2.
      show: { class_type: 'PreviewAny', inputs: { source: ['caption', 2] } },
    },
    outputs: ['show'],
  };
}

/** The model's answer made tidy: one line, single spaces, tags without repeats or empty ones. */
export function tidyCaption(text: string, style: CaptionStyle): string {
  const line = text.replace(/\s+/g, ' ').trim();
  if (style === 'sentence') return line;
  const seen = new Set<string>();
  return line
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag && !seen.has(tag.toLowerCase()) && seen.add(tag.toLowerCase()))
    .join(', ');
}

/** `prompt` with `text` added after it (a comma between them). */
export function appendToPrompt(prompt: string, text: string): string {
  const head = prompt.trim().replace(/,$/, '');
  const tail = text.trim();
  if (!head) return tail;
  if (!tail) return head;
  return `${head}, ${tail}`;
}
