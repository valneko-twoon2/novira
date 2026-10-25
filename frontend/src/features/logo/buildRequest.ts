// Turns the logo form into a queue request (shared by the logo screen and its tests).
import { randomSeed, type EnqueueRequest, type ImageDTO } from '@/backend';
import { autoAddBoardId } from '@/state/invoke';
import { LOGO_LIMITS, LOGO_SIZES, type LogoForm } from '@/state/media/logo';

/** The model is distilled for 8 steps without guidance. */
const LOGO_STEPS = 8;
const LOGO_MODEL_KEY = 'z-image-turbo';
const LOGO_MODEL_NAME = 'Z-Image-Turbo';

/** Reasons the form cannot be sent yet (empty = ready). `texts` supplies the wording so the caller owns it. */
export function logoProblems(form: LogoForm, texts: { text: string }): string[] {
  return form.text.trim() ? [] : [texts.text];
}

/**
 * The prompt for the model. It is written in English because the model follows English layout words best; the
 * lettering itself is quoted as typed (double quotes in it become single ones so the quote stays closed).
 */
export function buildLogoPrompt(form: Pick<LogoForm, 'text' | 'style'>): string {
  const text = form.text.trim().slice(0, LOGO_LIMITS.text).replace(/"/g, "'");
  const style = form.style.trim().replace(/\s+/g, ' ');
  return [
    `A professional logo design with the text "${text}" written clearly.`,
    style ? `Style: ${style}.` : '',
    'Clean vector graphic, centered composition, crisp legible lettering, plain white background, no other text.',
  ]
    .filter(Boolean)
    .join(' ');
}

export function buildLogoRequest(form: LogoForm): EnqueueRequest {
  const size = LOGO_SIZES.find((s) => s.value === form.size) ?? LOGO_SIZES[0];
  return {
    origin: 'generate',
    destination: 'gallery',
    params: {
      generationMode: 'logo',
      positivePrompt: buildLogoPrompt(form),
      negativePrompt: '',
      modelKey: LOGO_MODEL_KEY,
      modelName: LOGO_MODEL_NAME,
      vaeKey: null,
      seed: form.randomizeSeed ? randomSeed() : form.seed,
      steps: LOGO_STEPS,
      cfgScale: 1,
      cfgRescale: 0,
      scheduler: 'euler',
      width: size.width,
      height: size.height,
      clipSkip: 0,
      seamlessX: false,
      seamlessY: false,
      loras: [],
    },
    iterations: Math.min(LOGO_LIMITS.count.max, Math.max(LOGO_LIMITS.count.min, Math.round(form.count))),
    randomizeSeed: form.randomizeSeed,
    prepend: false,
    boardId: autoAddBoardId(),
    initImageUrl: null,
  };
}

/** The finished logos, newest first. */
export function logosOf(images: readonly ImageDTO[]): ImageDTO[] {
  return images
    .filter((i) => i.mediaType === 'image' && !i.isIntermediate && i.metadata?.generationMode === 'logo')
    .sort((a, b) => b.createdAt - a.createdAt);
}
