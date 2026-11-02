// Top of the Generate left panel: saved image-generation presets (settings except seed and iterations), and on the
// Generate tab the random run of chosen presets.
import { t } from '@/i18n';
import { findModel } from '@/state/models';
import { imagePresets, type PresetData } from '@/state/presets/imagePresets';
import { PresetBar } from '@/ui';
import { PresetRunButton } from './PresetRunButton';

/** Model, size and steps, as far as the preset holds them. */
export function summarizeImagePreset(data: PresetData): string {
  const parts: string[] = [];
  if (data.modelKey) parts.push(findModel(data.modelKey)?.name ?? data.modelKey);
  if (data.width && data.height) parts.push(`${data.width}×${data.height}`);
  if (data.steps) parts.push(t('presets.summary.steps', { steps: data.steps }));
  return parts.join(' · ');
}

/** On the Generate tab the bar also runs chosen presets at random (`random`). */
export function GenerationPresetBar({ random = false }: { random?: boolean }) {
  return <PresetBar kind={imagePresets} summarize={summarizeImagePreset} hint={t('presets.hint.image')} testId="preset-bar" actions={random && <PresetRunButton />} />;
}
