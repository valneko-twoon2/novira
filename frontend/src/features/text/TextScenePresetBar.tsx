// The preset card at the top of the Text tab: the layers and their layout saved under a name, put back in one press.
import { t } from '@/i18n';
import { textScenePresets, type TextScenePresetData } from '@/state/presets/textScenePresets';
import { PresetBar } from '@/ui';

export function summarizeTextScene(data: TextScenePresetData): string {
  const texts = data.layers.filter((l) => l.type === 'text').length;
  return t('text.template.summary', { texts, bubbles: data.layers.length - texts, width: data.width, height: data.height });
}

export function TextScenePresetBar() {
  return <PresetBar kind={textScenePresets} summarize={summarizeTextScene} hint={t('text.template.hint')} testId="text-templates" />;
}
