// The quality words every panel is drawn with, and the words it keeps out: the comic's style. They are put in front of the
// panel's own prompt and behind its negative prompt when it is drawn, so the agent writes only what a panel shows and the
// pictures keep one standard. A comic (or one of its pages) may set its own; what is not set follows the main model's family.
import type { BaseModel } from '@/backend';
import type { ComicPage, ComicProject } from './document';

export interface ComicStyle {
  /** Quality words put in front of every panel prompt. */
  positive?: string;
  /** Words put in front of every panel's negative prompt. */
  negative?: string;
}

export const STYLE_MAX = 600;

/**
 * The words kept out of every panel of a comic drawn with a tag model. The panels are drawn in colour and a page is made
 * black and white by its effect: "color" and "smooth shading" here only washed the colours out (a real-engine comparison of
 * 2026-10-15, judged by the user).
 */
const TAG_NEGATIVE =
  'worst quality, low quality, normal quality, lowres, jpeg artifacts, blurry, bad anatomy, bad hands, poorly drawn face, poorly drawn hands, deformed, disfigured, mutated, missing fingers, extra fingers, extra digits, fused fingers, malformed limbs, text, watermark, signature, artist name, censor, 3d, render, photorealistic, realistic, chromatic aberration';

export type PromptStyle = 'tags' | 'sentences';

/**
 * How a panel prompt is worded for the main model's family: the SD family reads short tags (Danbooru tags on anime
 * models), the newer families read plain sentences. Long sentences drew poorly on a tag model (2026-10-15, a real-engine
 * comparison); without a model, tags.
 */
export function promptStyleOf(base: BaseModel | null): PromptStyle {
  return base === null || base === 'sdxl' || base === 'sd-1' || base === 'sd-2' ? 'tags' : 'sentences';
}

/**
 * The most words of one term (between commas) that a tag model reads as a tag. On a run with Claude Haiku on 2026-10-17 a
 * man written in phrases ("holding a warm cup of coffee", "simple silver watch on left wrist") was drawn as a woman in every
 * panel; with the same seed, the same looks and action written as tags drew a man (a real-engine comparison).
 */
export const TAG_WORDS_MAX = 4;

/** The terms of a tag prompt that are longer than a tag, without their weights. */
export function phrasesOf(text: string): string[] {
  return text
    .split(',')
    .map((t) => t.replace(/^[\s(]+|[\s)]+$/g, '').replace(/:\s*[\d.]+$/, '').trim())
    .filter((t) => t.split(/\s+/).length > TAG_WORDS_MAX);
}

/** The style a comic starts with, by the family of the main model: tag models take quality tags, the others plain words. */
export function defaultStyle(base: BaseModel | null): Required<ComicStyle> {
  if (base === 'sdxl') return { positive: 'masterpiece, best quality, amazing quality, very aesthetic, absurdres, detailed', negative: TAG_NEGATIVE };
  if (base === 'sd-1' || base === 'sd-2') return { positive: 'masterpiece, best quality, highres, detailed illustration', negative: TAG_NEGATIVE };
  return { positive: 'high quality manga illustration, detailed', negative: '' };
}

/** The style a panel of this page is drawn with: the page's own words, else the comic's, else the family's, each side apart. */
export function styleOf(project: Pick<ComicProject, 'style'>, page: Pick<ComicPage, 'style'> | undefined, base: BaseModel | null): Required<ComicStyle> {
  const fallback = defaultStyle(base);
  // A lone comma is how the user says "none": the words are cut of the commas around them.
  const bare = (s: string) => s.replace(/^[\s,]+|[\s,]+$/g, '');
  return {
    positive: bare(page?.style?.positive ?? project.style?.positive ?? fallback.positive),
    negative: bare(page?.style?.negative ?? project.style?.negative ?? fallback.negative),
  };
}

/** A saved style read back: only words (cut to their limit); undefined when none is set. */
export function parseStyle(v: unknown): ComicStyle | undefined {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const out: ComicStyle = {};
  if (typeof o.positive === 'string') out.positive = o.positive.slice(0, STYLE_MAX);
  if (typeof o.negative === 'string') out.negative = o.negative.slice(0, STYLE_MAX);
  return Object.keys(out).length ? out : undefined;
}
