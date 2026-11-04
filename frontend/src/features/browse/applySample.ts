// Puts the settings of a Civitai example picture into the Generate form. The prompt and the plain settings always go in; the
// model and the LoRAs go in only when they are installed here (found by the Civitai version their page names, else by name),
// and the ones that are not are named, so the person knows what to fetch.
import type { CivitaiSample, CivitaiSampleResource, LoRAParam, ModelConfig, SchedulerName } from '@/backend';
import { isDrawable } from '@/state/models';
import { normalizeModelName } from '@/state/recallModel';
import type { ParamsFields } from '@/state/params';

/** A1111's sampler names (what Civitai records) and the scheduler setting of this app that runs the same thing. */
const SAMPLERS: Record<string, SchedulerName> = {
  euler: 'euler',
  'euler a': 'euler_a',
  'euler ancestral': 'euler_a',
  'dpm++ 2m': 'dpmpp_2m',
  'dpm++ 2m karras': 'dpmpp_2m_k',
  'dpm++ 2m sde karras': 'dpmpp_2m_sde_k',
  'dpm++ sde karras': 'dpmpp_sde_k',
  heun: 'heun',
  lms: 'lms',
  ddim: 'ddim',
  unipc: 'unipc',
  'uni pc': 'unipc',
  lcm: 'lcm',
  tcd: 'tcd',
};

/** The scheduler that runs a Civitai sampler name, or null for one this app has no setting for. */
export function schedulerOf(sampler: string | null): SchedulerName | null {
  if (!sampler) return null;
  return SAMPLERS[sampler.trim().toLowerCase().replace(/[_\s]+/g, ' ')] ?? null;
}

/** The Civitai version a model's page names (`...?modelVersionId=123`), or null. */
export function versionOf(model: ModelConfig): string | null {
  return /[?&]modelVersionId=(\d{1,12})(?:[&#]|$)/.exec(model.pageUrl ?? '')?.[1] ?? null;
}

/** The installed model of a resource: by version, else by name (a LoRA's name or a main model's). Null when none or several match. */
export function installedFor(resource: CivitaiSampleResource, models: ModelConfig[]): ModelConfig | null {
  const wantsMain = resource.kind === 'checkpoint' || resource.kind === 'model';
  const pool = models.filter((m) => (wantsMain ? isDrawable(m) : m.type === 'lora'));
  if (resource.versionId) {
    const byVersion = pool.filter((m) => versionOf(m) === resource.versionId);
    if (byVersion.length === 1) return byVersion[0]!;
  }
  const wanted = normalizeModelName(resource.name ?? '');
  if (!wanted) return null;
  const byName = pool.filter((m) => normalizeModelName(m.name) === wanted);
  return byName.length === 1 ? byName[0]! : null;
}

export interface SampleUse {
  /** What goes into the form. */
  patch: Partial<ParamsFields>;
  /** The resources (models and LoRAs) that are not installed, as Civitai recorded them. */
  missing: CivitaiSampleResource[];
  /** The sampler Civitai names that this app has no scheduler for (the current one stays). */
  unknownSampler: string | null;
}

/**
 * What a sample changes in the form. A setting the sample does not record is left as it is. The LoRAs are replaced by the
 * installed ones the picture used when it recorded any (they shape the picture as much as the prompt does).
 */
export function sampleUse(sample: CivitaiSample, models: ModelConfig[]): SampleUse {
  const patch: Partial<ParamsFields> = { positivePrompt: sample.prompt };
  if (sample.negativePrompt !== null) patch.negativePrompt = sample.negativePrompt;
  if (sample.seed !== null) Object.assign(patch, { seed: sample.seed, shouldRandomizeSeed: false });
  if (sample.steps !== null) patch.steps = sample.steps;
  if (sample.cfgScale !== null) patch.cfgScale = sample.cfgScale;
  if (sample.width !== null && sample.height !== null) Object.assign(patch, { width: sample.width, height: sample.height, aspectRatio: 'free' });
  // Civitai writes A1111's number (1 is no skipping); this app counts the layers skipped.
  if (sample.clipSkip !== null) patch.clipSkip = Math.max(0, sample.clipSkip - 1);
  const scheduler = schedulerOf(sample.sampler);
  if (scheduler) patch.scheduler = scheduler;

  const missing: CivitaiSampleResource[] = [];
  const loras: LoRAParam[] = [];
  for (const r of sample.resources) {
    const kind = r.kind;
    if (kind !== 'checkpoint' && kind !== 'model' && kind !== 'lora') continue;
    const found = installedFor(r, models);
    if (!found) {
      missing.push(r);
    } else if (kind === 'lora') {
      if (!loras.some((l) => l.key === found.key)) loras.push({ key: found.key, weight: r.weight ?? 0.75, isEnabled: true });
    } else {
      patch.modelKey = found.key;
    }
  }
  if (sample.resources.some((r) => r.kind === 'lora')) patch.loras = loras;
  return { patch, missing, unknownSampler: sample.sampler && !scheduler ? sample.sampler : null };
}
