// The desktop backend's enqueue checks on masks, control layers and reference images (service/guidance.rs), so a
// request the real app would refuse is refused by the mock too.
import type { EnqueueRequest } from '../types';

export const MAX_CONTROL_LAYERS = 8;
export const MAX_REF_IMAGES = 8;
export const MAX_REGIONAL_LAYERS = 8;
export const MAX_REFERENCE_PICTURES = 4;
const MAX_REGION_PROMPT = 10_000;

const IMAGE_MODES = ['txt2img', 'img2img', 'inpaint', 'outpaint'];

function checkSpan(what: string, [begin, end]: [number, number]) {
  const ok = Number.isFinite(begin) && Number.isFinite(end) && begin >= 0 && end <= 1 && begin <= end;
  if (!ok) throw new Error(`${what}: begin and end must be fractions of the steps with begin not after end`);
}

function checkWeight(what: string, weight: number, min: number, max: number) {
  if (!(Number.isFinite(weight) && weight >= min && weight <= max)) throw new Error(`${what}: the weight must be between ${min} and ${max}`);
}

export function checkGuidance(r: EnqueueRequest): void {
  const controls = r.controlLayers ?? [];
  const refs = r.refImages ?? [];
  const regions = r.regionalLayers ?? [];
  const pictures = r.referencePictures ?? [];
  const mode = r.params.generationMode;
  if (controls.length > MAX_CONTROL_LAYERS) throw new Error(`At most ${MAX_CONTROL_LAYERS} control layers can be used at once`);
  if (refs.length > MAX_REF_IMAGES) throw new Error(`At most ${MAX_REF_IMAGES} reference images can be used at once`);
  if (regions.length > MAX_REGIONAL_LAYERS) throw new Error(`At most ${MAX_REGIONAL_LAYERS} regional guidance layers can be used at once`);
  if (pictures.length > MAX_REFERENCE_PICTURES) throw new Error(`At most ${MAX_REFERENCE_PICTURES} reference pictures can be given to the model at once`);
  pictures.forEach((url, i) => {
    if (!url) throw new Error(`Reference picture ${i + 1}: the picture is missing`);
  });
  if (!IMAGE_MODES.includes(mode) && (controls.length || refs.length || regions.length || pictures.length || r.maskImageUrl)) {
    throw new Error('Masks, control layers and reference images are only used for image generation');
  }
  const masked = mode === 'inpaint' || mode === 'outpaint';
  if (r.maskImageUrl && !masked) throw new Error('A mask is only used for inpaint and outpaint');
  if (r.maskImageUrl && !r.initImageUrl) throw new Error('A mask needs a source image');
  if (masked && !r.maskImageUrl) throw new Error('Inpaint and outpaint need a mask');
  if ((r.params.controlLayerCount ?? 0) !== controls.length) throw new Error('The control layer count does not match the control layers sent');
  if ((r.params.refImageCount ?? 0) !== refs.length) throw new Error('The reference image count does not match the reference images sent');
  if ((r.params.regionalGuidanceCount ?? 0) !== regions.length) throw new Error('The regional guidance count does not match the regional layers sent');
  regions.forEach((g, i) => {
    const what = `Regional guidance layer ${i + 1}`;
    if (!g.imageUrl) throw new Error(`${what}: the region is missing`);
    if (!g.positivePrompt?.trim() && !g.negativePrompt?.trim()) throw new Error(`${what}: it has no prompt`);
    if ([g.positivePrompt, g.negativePrompt].some((t) => (t ?? '').length > MAX_REGION_PROMPT)) throw new Error(`${what}: the prompt is too long`);
  });
  controls.forEach((c, i) => {
    const what = `Control layer ${i + 1}`;
    if (!c.imageUrl) throw new Error(`${what}: the picture is missing`);
    if (!c.modelKey.trim()) throw new Error(`${what}: no model is chosen`);
    checkWeight(what, c.weight, 0, 2);
    checkSpan(what, c.beginEnd);
  });
  refs.forEach((ref, i) => {
    const what = `Reference image ${i + 1}`;
    if (!ref.imageUrl) throw new Error(`${what}: the picture is missing`);
    if (!ref.modelKey.trim()) throw new Error(`${what}: no model is chosen`);
    checkWeight(what, ref.weight, -1, 2);
    checkSpan(what, ref.beginEnd);
    if (ref.regionImageUrl === '') throw new Error(`${what}: the region is missing`);
  });
}
