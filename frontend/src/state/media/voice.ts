// Voice creation: the form values, kept between sessions.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { overDefaults } from '../persistDefaults';
import type { VoiceMode } from '@/backend';

export interface VoiceForm {
  text: string;
  /** A language name the voice engine knows, or `Auto`. */
  language: string;
  mode: VoiceMode;
  /** Built-in speaker (preset mode). */
  speaker: string;
  /** Preset mode: how to speak (optional). Design mode: the description of the voice. */
  instruct: string;
}

const VOICE_DEFAULTS: VoiceForm = {
  text: '',
  language: 'Auto',
  mode: 'preset',
  speaker: 'Ono_Anna',
  instruct: '',
};

/** Languages the voice engine speaks; `Auto` picks from the text. */
export const VOICE_LANGUAGES = ['Auto', 'Japanese', 'English', 'Chinese', 'Korean', 'German', 'French', 'Russian', 'Portuguese', 'Spanish', 'Italian'] as const;

/** The engine's built-in speakers. */
export const VOICE_SPEAKERS = ['Ono_Anna', 'Vivian', 'Serena', 'Uncle_Fu', 'Dylan', 'Eric', 'Ryan', 'Aiden', 'Sohee'] as const;

interface VoiceState {
  form: VoiceForm;
  setForm: (patch: Partial<VoiceForm>) => void;
}

export const useVoice = create<VoiceState>()(
  persist(
    (set, get) => ({
      form: VOICE_DEFAULTS,
      setForm: (patch) => set({ form: { ...get().form, ...patch } }),
    }),
    { name: 'novira.voice', version: 1, partialize: (s) => ({ form: s.form }), merge: overDefaults('form', VOICE_DEFAULTS) },
  ),
);
