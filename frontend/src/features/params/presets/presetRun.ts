// The random preset run of the Generate tab: a number of pictures, each made with one of the chosen presets picked at
// random (every preset equally likely) and its own random seed. Each request is built from a copy of the form with the
// preset applied (`withPreset`), so the form stays exactly as the user left it.
import { backend, randomSeed, type EnqueueRequest, type QueueItem } from '@/backend';
import { t } from '@/i18n';
import { useParams } from '@/state/params';
import { useImagePresets, withPreset, type GenerationPreset } from '@/state/presets/imagePresets';
import { usePresetRun } from '@/state/presets/presetRun';
import { toast } from '@/state/toasts';
import { showViewer, useUi } from '@/state/ui';
import { dynamicBatches, generateRequestOf } from '../buildRequest';
import { generateReadiness } from '../readiness';

/** The chosen presets that still exist, in the order of the preset list. */
export function chosenPresets(ids: readonly string[], presets: readonly GenerationPreset[] = useImagePresets.getState().presets): GenerationPreset[] {
  return presets.filter((p) => ids.includes(p.id));
}

/** Why the run cannot start: for each chosen preset that cannot be drawn, its name and its first reason. */
export function presetRunProblems(presets: readonly GenerationPreset[]): string[] {
  const form = useParams.getState();
  return presets.flatMap((p) => {
    const [reason] = generateReadiness(withPreset(form, p.data));
    return reason ? [t('presets.run.notReady', { name: p.name, reason })] : [];
  });
}

export interface PresetRunSources {
  /** A number in [0, 1) that picks the preset of a picture. */
  random?: () => number;
  /** The seed of a picture. */
  seed?: () => number;
}

/**
 * The requests of one run: `count` pictures (one request each), each with one of `presets` picked by `random` and a seed
 * from `seed`. Dynamic prompts in a preset draw one prompt per picture from its seed, so the count stays the count of
 * pictures whatever the preset's dynamic prompt mode is.
 */
export function presetRunRequests(presets: readonly GenerationPreset[], count: number, { random = Math.random, seed = randomSeed }: PresetRunSources = {}): EnqueueRequest[] {
  if (!presets.length) return [];
  const form = useParams.getState();
  return Array.from({ length: Math.max(0, Math.floor(count)) }, () => {
    const preset = presets[Math.min(presets.length - 1, Math.floor(random() * presets.length))]!;
    const request = generateRequestOf(withPreset(form, preset.data), false);
    const one = { ...request, iterations: 1, randomizeSeed: false, params: { ...request.params, seed: seed() } };
    return dynamicBatches(one, 'random')[0]!;
  });
}

/** Queues one run with the chosen presets and count, and says how it went. */
export async function runPresets(): Promise<void> {
  const { ids, count } = usePresetRun.getState();
  const presets = chosenPresets(ids);
  if (!presets.length) return;
  const problems = presetRunProblems(presets);
  if (problems.length) {
    toast({ status: 'warning', title: t('app.invoke.notReady'), description: problems.join('\n') });
    return;
  }
  const items: QueueItem[] = [];
  try {
    for (const request of presetRunRequests(presets, count)) items.push(...(await backend.enqueue(request)));
  } catch (err) {
    toast({ status: 'error', title: t('app.invoke.failed'), description: String(err instanceof Error ? err.message : err) });
    return;
  }
  // Like Invoke, leave the launchpad so the progress preview is visible.
  if (useUi.getState().mainView.generate === 'launchpad') showViewer('generate');
  toast({ status: 'success', title: t('app.invoke.enqueued', { count: items.length }) });
}
