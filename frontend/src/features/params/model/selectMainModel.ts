// Selecting a main model: apply its default settings and drop settings incompatible with its base.
import type { ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { modelsOfType, useModels } from '@/state/models';
import { ASPECT_RATIOS, useParams, type AspectRatioId, type ParamsFields } from '@/state/params';
import { toast } from '@/state/toasts';
import { modelProfile } from './modelProfile';

function aspectOf(width: number, height: number): AspectRatioId {
  const ratio = width / height;
  return ASPECT_RATIOS.find((a) => a.value !== null && Math.abs(a.value - ratio) < 0.01)?.id ?? 'free';
}

export function selectMainModel(model: ModelConfig, opts: { quiet?: boolean } = {}) {
  const p = useParams.getState();
  const models = useModels.getState().models;
  const prevBase = models.find((m) => m.key === p.modelKey)?.base;
  const patch: Partial<ParamsFields> = { modelKey: model.key };

  const d = model.defaultSettings;
  if (d) {
    if (d.steps !== undefined) patch.steps = d.steps;
    if (d.cfgScale !== undefined) patch.cfgScale = d.cfgScale;
    if (d.scheduler !== undefined) patch.scheduler = d.scheduler;
    if (d.width !== undefined && d.height !== undefined) {
      patch.width = d.width;
      patch.height = d.height;
      patch.aspectRatio = aspectOf(d.width, d.height);
    }
  }

  if (prevBase !== model.base) {
    const compatible = (key: string | null) => {
      const m = models.find((x) => x.key === key);
      return !!m && (m.base === model.base || m.base === 'any');
    };
    if (p.vaeKey && !compatible(p.vaeKey)) patch.vaeKey = null;
    const keptLoras = p.loras.filter((l) => compatible(l.key));
    const cleared = p.loras.length - keptLoras.length;
    if (cleared) patch.loras = keptLoras;
    const ipFallback = modelsOfType(models, 'ip_adapter', model.base)[0]?.key ?? null;
    patch.refImages = p.refImages.map((r) => (r.modelKey && !compatible(r.modelKey) ? { ...r, modelKey: ipFallback } : r));
    if (p.upscale.tileControlnetModelKey && !compatible(p.upscale.tileControlnetModelKey)) {
      useParams.getState().setUpscale({ tileControlnetModelKey: null });
    }
    if (cleared && !opts.quiet) {
      toast({ status: 'info', title: t('params.model.lorasCleared', { count: cleared }) });
    }
  }
  p.set(patch);
}

/** "Apply recommended": selects the model and sets every recommended value, including the ones that come from the
 * base model's fallback when the model has no saved default (the popover compares against those too). */
export function applyRecommended(model: ModelConfig) {
  selectMainModel(model, { quiet: true });
  const p = modelProfile(model);
  useParams.getState().set({
    steps: p.steps,
    cfgScale: p.cfgScale,
    scheduler: p.scheduler,
    width: p.width,
    height: p.height,
    aspectRatio: aspectOf(p.width, p.height),
  });
}
