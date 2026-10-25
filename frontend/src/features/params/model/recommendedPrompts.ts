// The recommended prompts of a main model's family: the quality words for the positive prompt and the words kept out
// for the negative one, each the convention its makers (or, where they say nothing, the wide community) use.
import type { ModelConfig } from '@/backend';

export interface RecommendedPrompts {
  /** Quality words for the positive prompt; never empty. */
  positive: string;
  /** Words for the negative prompt; empty for a family that does not read a negative prompt. */
  negative: string;
  /** Where the quality words go: in front for a tag model, after the description for a model that reads sentences. */
  place: 'first' | 'last';
}

/** The classic SD 1.x / NovelAI-era negative, still the common default of tag models. */
const CLASSIC_NEGATIVE =
  'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry';

/** A short negative for the families that sample with real CFG but publish no negative of their own. */
const SHORT_NEGATIVE = 'low quality, worst quality, blurry, jpeg artifacts, deformed, bad anatomy, extra fingers, watermark, signature';

/** Quality words for the families that read plain sentences and publish no quality phrase. */
const SENTENCE_QUALITY = 'high quality, highly detailed, sharp focus';

const tags = (positive: string, negative: string): RecommendedPrompts => ({ positive, negative, place: 'first' });
const sentences = (positive: string, negative: string): RecommendedPrompts => ({ positive, negative, place: 'last' });

// Sources, checked 2026-10-21. Rating tags (`safe`) and content tags (furry, nsfw) the cards add are left out: they
// decide what is drawn, not how well.
// - Anima: the circlestone-labs/Anima model card (prefix and negative).
// - NoobAI-XL: the Laxhar NoobAI-XL card (prefix "masterpiece, best quality, newest, absurdres, highres" and the
//   negative's quality terms).
// - Illustrious / WAI: the Illustrious-XL card's quality tags and negative, with WAI's published
//   "masterpiece, best quality, amazing quality" and "bad quality, worst quality, worst detail, sketch, censor".
// - Pony Diffusion V6: the card's full score chain; it says no negative is needed, "score_6, score_5, score_4" is the
//   community's usual one.
// - Qwen-Image: the QwenLM/Qwen-Image README ("positive_magic", and the 2512 example negative in English).
// - Chroma: the lodestones/Chroma1-HD card's example negative.
// - FLUX.1: guidance distilled; the app samples it at CFG 1 and zeroes the negative, so none.
// - FLUX.2, Z-Image, HiDream, SD3, AuraFlow, Hunyuan: the cards publish no quality phrase or negative (Z-Image notes
//   it follows negatives well), so the common short ones.
const ANIMA = tags(
  'masterpiece, best quality, score_7',
  'worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration',
);
const NOOB = tags(
  'masterpiece, best quality, newest, absurdres, highres',
  'worst quality, old, early, low quality, lowres, signature, username, logo, bad hands, mutated hands',
);
const ILLUSTRIOUS = tags(
  'masterpiece, best quality, amazing quality, very aesthetic, absurdres, newest',
  'worst quality, bad quality, low quality, worst detail, lowres, displeasing, very displeasing, bad anatomy, bad hands, extra digits, fewer digits, sketch, censor, jpeg artifacts, signature, watermark, username, blurry',
);
const PONY = tags('score_9, score_8_up, score_7_up, score_6_up, score_5_up, score_4_up', 'score_6, score_5, score_4, low quality, blurry, watermark, signature');
const SD_ANIME = tags('masterpiece, best quality, highres', CLASSIC_NEGATIVE);
const SD_GENERAL = tags('masterpiece, best quality, highly detailed, sharp focus', CLASSIC_NEGATIVE);
const SDXL_PHOTO = tags(
  'photorealistic, highly detailed, sharp focus, professional photography',
  'lowres, worst quality, low quality, blurry, jpeg artifacts, deformed, disfigured, bad anatomy, bad hands, extra fingers, watermark, signature, text, cartoon, illustration, painting, 3d render',
);

/** The words a model is told apart by: its name and its file name. */
function words(m: ModelConfig): string {
  const file = m.path.split(/[\\/]/).pop() ?? '';
  return `${m.name} ${file}`.toLowerCase();
}

export function recommendedPrompts(m: ModelConfig | undefined): RecommendedPrompts {
  if (!m) return SD_GENERAL;
  const w = words(m);
  switch (m.base) {
    case 'anima':
      return ANIMA;
    case 'flux':
      return sentences(SENTENCE_QUALITY, '');
    case 'qwen-image':
      return sentences(
        'Ultra HD, 4K, cinematic composition',
        'low resolution, low quality, deformed limbs, deformed fingers, oversaturated, waxy look, faces without detail, overly smooth, AI look, messy composition, blurry text, distorted text',
      );
    case 'chroma':
      return sentences(SENTENCE_QUALITY, 'low quality, ugly, unfinished, out of focus, deformed, disfigure, blurry, smudged, restricted palette, flat colors');
    case 'flux2':
    case 'z-image':
    case 'hidream':
    case 'sd-3':
    case 'auraflow':
    case 'hunyuan-image':
    case 'hunyuan-dit':
    case 'wan':
    case 'hunyuan-video':
    case 'hunyuan-video-15':
    case 'ltx-video':
    case 'ltx2':
      return sentences(SENTENCE_QUALITY, SHORT_NEGATIVE);
    case 'sd-1':
    case 'sd-2':
    case 'sdxl':
    case 'any':
      break;
  }
  if (/pony/.test(w)) return PONY;
  if (/noob/.test(w)) return NOOB;
  if (/illustrious|\bwai|^wai/.test(w)) return ILLUSTRIOUS;
  if (/anime|animagine|anything|counterfeit|manga/.test(w)) return m.base === 'sdxl' ? ILLUSTRIOUS : SD_ANIME;
  if (m.base === 'sdxl' && /juggernaut|realvis|realistic|photo/.test(w)) return SDXL_PHOTO;
  return SD_GENERAL;
}
