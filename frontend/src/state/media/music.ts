// Music creation: the form values, kept between sessions.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { overDefaults } from '../persistDefaults';

export interface MusicForm {
  /** Style tags: genre, mood, instruments (the positive prompt). */
  tags: string;
  lyrics: string;
  instrumental: boolean;
  /** Language of the lyrics as ACE-Step names it (`ja`, `en`, ... or `unknown`). */
  language: string;
  seconds: number;
  bpm: number;
  key: string;
  timeSignature: number;
  steps: number;
  cfgScale: number;
  seed: number;
  randomizeSeed: boolean;
}

const MUSIC_DEFAULTS: MusicForm = {
  tags: '',
  lyrics: '',
  instrumental: false,
  language: 'ja',
  seconds: 60,
  bpm: 120,
  key: 'C major',
  timeSignature: 4,
  steps: 8,
  cfgScale: 1,
  seed: 123456789,
  randomizeSeed: true,
};

export const MUSIC_LIMITS = { seconds: { min: 10, max: 240 }, bpm: { min: 40, max: 220 }, steps: { min: 4, max: 50 }, cfg: { min: 1, max: 8 } };

/** Lyrics languages offered (the model knows more; `unknown` lets it guess). */
export const MUSIC_LANGUAGES = ['ja', 'en', 'zh', 'yue', 'ko', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'unknown'] as const;

export const TIME_SIGNATURES = [2, 3, 4, 6] as const;

const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
/** Every key the music node lists, as `C major` ... `B minor`. */
export const MUSIC_KEYS = ROOTS.flatMap((root) => [`${root} major`, `${root} minor`]);

interface MusicState {
  form: MusicForm;
  setForm: (patch: Partial<MusicForm>) => void;
}

export const useMusic = create<MusicState>()(
  persist(
    (set, get) => ({
      form: MUSIC_DEFAULTS,
      setForm: (patch) => set({ form: { ...get().form, ...patch } }),
    }),
    { name: 'novira.music', version: 1, partialize: (s) => ({ form: s.form }), merge: overDefaults('form', MUSIC_DEFAULTS) },
  ),
);
