// The Generate tab's settings as the parts of one txt2img request: the metadata of the picture, and the reference images
// and hires fix it carries. The Generate tab and the comic screen both build from here, so every setting the Generate
// tab has (LoRAs, VAE, reference images, hires fix) reaches both. The prompts and the size are the caller's to set.
import type { GenerationMetadata, GenerationMode, RefImageInput } from '@/backend';
import { findModel } from '@/state/models';
import { hiresFixInput, refImageInputs, useParams, type ParamsFields } from '@/state/params';

/**
 * The metadata of a picture made from the Generate settings, with its prompts and size as the store has them. `p` is the
 * form by default, or other settings (a preset applied to a copy of the form).
 */
export function generationMetadata(mode: GenerationMode, p: ParamsFields = useParams.getState()): GenerationMetadata {
  return {
    generationMode: mode,
    positivePrompt: p.positivePrompt,
    negativePrompt: p.negativePrompt,
    modelKey: p.modelKey ?? '',
    modelName: findModel(p.modelKey)?.name ?? '',
    vaeKey: p.vaeKey,
    seed: p.seed,
    steps: p.steps,
    cfgScale: p.cfgScale,
    cfgRescale: p.cfgRescale,
    scheduler: p.scheduler,
    width: p.width,
    height: p.height,
    clipSkip: p.clipSkip,
    seamlessX: p.seamlessX,
    seamlessY: p.seamlessY,
    loras: p.loras.filter((l) => l.isEnabled).map((l) => ({ ...l })),
  };
}

/**
 * The text-to-image parts of a request from the Generate settings: the metadata, the reference images, and the hires fix.
 * `more` are reference images of the caller's own, sent after the Generate tab's (a comic panel adds its own this way).
 */
export function txt2imgParts(more: RefImageInput[] = [], p: ParamsFields = useParams.getState()): { params: GenerationMetadata; refImages: RefImageInput[] } {
  const params = generationMetadata('txt2img', p);
  const refImages = [...refImageInputs(p.refImages), ...more];
  if (refImages.length) params.refImageCount = refImages.length;
  const hiresFix = hiresFixInput(p.hires);
  if (hiresFix) params.hiresFix = hiresFix;
  return { params, refImages };
}
