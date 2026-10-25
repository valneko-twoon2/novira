// Preset card of the voice screen: language and voice (not the text to speak).
import { t } from '@/i18n';
import { VOICE_LANGUAGES, VOICE_SPEAKERS } from '@/state/media/voice';
import { voicePresets, type VoicePresetData } from '@/state/presets/voicePresets';
import { PresetBar } from '@/ui';

const isOneOf = <T extends string>(list: readonly T[], v: string): v is T => (list as readonly string[]).includes(v);

export function summarizeVoicePreset(data: VoicePresetData): string {
  const parts: string[] = [];
  if (data.mode === 'design') parts.push(t('presets.summary.designedVoice'));
  else if (data.speaker) parts.push(isOneOf(VOICE_SPEAKERS, data.speaker) ? t(`voice.speaker.${data.speaker}`) : data.speaker);
  if (data.language) parts.push(isOneOf(VOICE_LANGUAGES, data.language) ? t(`voice.lang.${data.language}`) : data.language);
  if (data.instruct) parts.push(data.instruct);
  return parts.join(' · ');
}

export function VoicePresetBar() {
  return <PresetBar kind={voicePresets} summarize={summarizeVoicePreset} hint={t('presets.hint.voice')} testId="voice-presets" />;
}
