// Preset card of the video screen: the video settings without the seed or the source picture.
import { t } from '@/i18n';
import { videoPresets, type VideoPresetData } from '@/state/presets/videoPresets';
import { PresetBar } from '@/ui';

export function summarizeVideoPreset(data: VideoPresetData): string {
  const parts: string[] = [];
  if (data.model) parts.push(t(`presets.summary.videoModel.${data.model}`));
  if (data.width && data.height) parts.push(`${data.width}×${data.height}`);
  if (data.seconds) parts.push(t('presets.summary.seconds', { seconds: data.seconds }));
  if (data.fps) parts.push(t('presets.summary.fps', { fps: data.fps }));
  return parts.join(' · ');
}

export function VideoPresetBar() {
  return <PresetBar kind={videoPresets} summarize={summarizeVideoPreset} hint={t('presets.hint.video')} testId="video-presets" />;
}
