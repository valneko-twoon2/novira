// Saved voice presets: language and voice (built-in speaker and how it speaks, or a described voice); not the text.
import { useVoice, type VoiceForm } from '../media/voice';
import { createPresetStore, pickFields, type Preset, type PresetKind } from './presetStore';
import seed from './seed/voice.json';

export const VOICE_PRESET_FIELDS = ['language', 'mode', 'speaker', 'instruct'] as const satisfies readonly (keyof VoiceForm)[];

export type VoicePresetData = Partial<Pick<VoiceForm, (typeof VOICE_PRESET_FIELDS)[number]>>;

export const useVoicePresets = createPresetStore<VoicePresetData>({ name: 'novira.voicePresets', seed: seed as Preset<VoicePresetData>[] });

export const voicePresets: PresetKind<VoicePresetData> = {
  store: useVoicePresets,
  snapshot: () => pickFields(useVoice.getState().form, VOICE_PRESET_FIELDS),
  apply: (data) => useVoice.getState().setForm(pickFields(data, VOICE_PRESET_FIELDS)),
};
