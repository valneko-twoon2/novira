// Preset card of the music screen: style tags and musical settings (not the lyrics or the seed).
import { t } from '@/i18n';
import { musicPresets, type MusicPresetData } from '@/state/presets/musicPresets';
import { PresetBar } from '@/ui';

export function summarizeMusicPreset(data: MusicPresetData): string {
  const parts: string[] = [];
  if (data.instrumental) parts.push(t('presets.summary.instrumental'));
  if (data.seconds) parts.push(t('presets.summary.seconds', { seconds: data.seconds }));
  if (data.bpm) parts.push(t('presets.summary.bpm', { bpm: data.bpm }));
  if (data.key) parts.push(data.key);
  return parts.join(' · ');
}

export function MusicPresetBar() {
  return <PresetBar kind={musicPresets} summarize={summarizeMusicPreset} hint={t('presets.hint.music')} testId="music-presets" />;
}
