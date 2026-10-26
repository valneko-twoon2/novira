// Readiness checks for the parameter-driven tabs. Exported for reuse by the canvas builder.
import type { BaseModel } from '@/backend';
import { t } from '@/i18n';
import { refImagesEncoderReason, refImagesPackReason } from '@/state/comfy/packNeeds';
import { modelPartsReason } from '@/state/modelParts';
import { BASE_LABELS, isDrawable, useModels } from '@/state/models';
import { hiresSize, useParams } from '@/state/params';
import { useWildcards, wildcardMap } from '@/state/prompts/wildcards';
import { MAX_WILDCARD_DEPTH, wildcardProblems } from '@/state/prompts/dynamicPrompts';

/** Reasons shared by Generate and Canvas: model, LoRAs, reference images. */
export function paramsReadiness(opts: { refImages: boolean }): string[] {
  const p = useParams.getState();
  const models = useModels.getState().models;
  const reasons: string[] = [];
  const main = models.find((m) => m.key === p.modelKey && isDrawable(m));
  if (!main) {
    reasons.push(t('params.readiness.noModel'));
    return reasons;
  }
  // First, so that the panel shows it (and the button that installs the files) before the smaller reasons.
  const partsReason = modelPartsReason(main.key);
  if (partsReason) reasons.push(partsReason);
  for (const l of p.loras) {
    if (!l.isEnabled) continue;
    const m = models.find((x) => x.key === l.key);
    if (!m) reasons.push(t('params.readiness.loraMissing'));
    else if (m.base !== main.base && m.base !== 'any') reasons.push(t('params.readiness.loraIncompatible', { name: m.name }));
  }
  if (opts.refImages) {
    p.refImages.forEach((r, i) => {
      if (!r.isEnabled) return;
      const n = i + 1;
      if (!r.imageName) reasons.push(t('params.readiness.refNoImage', { index: n }));
      const m = models.find((x) => x.key === r.modelKey);
      if (!m) reasons.push(t('params.readiness.refNoModel', { index: n }));
      else if (m.base !== main.base && m.base !== 'any') reasons.push(t('params.readiness.refIncompatible', { index: n }));
    });
    const packReason = refImagesPackReason(p.refImages);
    if (packReason) reasons.push(packReason);
    const encoderReason = refImagesEncoderReason(p.refImages, models);
    if (encoderReason) reasons.push(encoderReason);
  }
  return reasons;
}

/** Reasons the positive or the negative prompt cannot be expanded: wildcards without a usable list, lists that use themselves. */
export function promptReadiness(): string[] {
  const { positivePrompt, negativePrompt } = useParams.getState();
  const lists = wildcardMap(useWildcards.getState().lists);
  const reasons = [positivePrompt, negativePrompt].flatMap((prompt) => {
    const p = wildcardProblems(prompt, lists);
    return [
      ...p.unknown.map((name) => t('params.readiness.wildcardUnknown', { name: `__${name}__` })),
      ...p.empty.map((name) => t('params.readiness.wildcardEmpty', { name: `__${name}__` })),
      ...p.cycles.map((name) => t('params.readiness.wildcardCycle', { name: `__${name}__` })),
      ...(p.tooDeep ? [t('params.readiness.wildcardDeep', { max: MAX_WILDCARD_DEPTH })] : []),
    ];
  });
  return [...new Set(reasons)];
}

/** The Generate tab: the shared reasons, the prompt, and the high-resolution fix's upscale model. */
export function generateReadiness(): string[] {
  const reasons = [...paramsReadiness({ refImages: true }), ...promptReadiness()];
  const h = useParams.getState().hires;
  if (h.enabled && h.upscaleModelKey && !useModels.getState().models.some((m) => m.key === h.upscaleModelKey)) {
    reasons.push(t('params.readiness.hiresNoModel'));
  }
  return reasons;
}

/** The long side a model family draws well up to; a larger second pass tends to repeat or break the picture. */
export const HIRES_COMFORT_SIDE: Partial<Record<BaseModel, number>> = { 'sd-1': 1536, 'sd-2': 1536, sdxl: 2048 };

/** Hints that do not block Invoke: a second pass larger than the model draws well. */
export function generateWarnings(): string[] {
  const p = useParams.getState();
  if (!p.hires.enabled) return [];
  const base = useModels.getState().models.find((m) => m.key === p.modelKey && isDrawable(m))?.base;
  const max = base ? HIRES_COMFORT_SIDE[base] : undefined;
  const { width, height } = hiresSize(p.width, p.height, p.hires.scale);
  if (!base || !max || Math.max(width, height) <= max) return [];
  return [t('params.readiness.hiresLarge', { width, height, base: BASE_LABELS[base], max })];
}

export function upscaleReadiness(): string[] {
  const reasons = [...paramsReadiness({ refImages: false }), ...promptReadiness()];
  const u = useParams.getState().upscale;
  const models = useModels.getState().models;
  if (!u.initialImage) reasons.push(t('params.readiness.upscaleNoImage'));
  if (!models.some((m) => m.key === u.upscaleModelKey)) reasons.push(t('params.readiness.upscaleNoModel'));
  return reasons;
}
