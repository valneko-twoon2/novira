// Top of the Generate left panel: saved image-generation presets (settings except seed and iterations).
import { t } from '@/i18n';
import { findModel } from '@/state/models';
import { imagePresets, type PresetData } from '@/state/presets/imagePresets';
import { PresetBar } from '@/ui';

/** Model, size and steps, as far as the preset holds them. */
export function summarizeImagePreset(data: PresetData): string {
  const parts: string[] = [];
  if (data.modelKey) parts.push(findModel(data.modelKey)?.name ?? data.modelKey);
  if (data.width && data.height) parts.push(`${data.width}×${data.height}`);
  if (data.steps) parts.push(t('presets.summary.steps', { steps: data.steps }));
  return parts.join(' · ');
}

export function GenerationPresetBar() {
  return <PresetBar kind={imagePresets} summarize={summarizeImagePreset} hint={t('presets.hint.image')} testId="preset-bar" />;
}
