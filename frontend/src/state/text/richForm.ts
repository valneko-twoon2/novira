// The settings of "finish with AI" on the Text screen (kept between sessions). The picture itself belongs to the layer.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { overDefaults } from '../persistDefaults';

export interface RichForm {
  /** The positive prompt: what the letters are painted as. */
  words: string;
  /** The negative prompt, added to the words that keep the model from writing letters of its own. */
  negative: string;
  /** The model that paints; null picks one (see `richPlan`). */
  modelKey: string | null;
  /** 0..100, mapped onto the plan's denoise range. */
  strength: number;
  /** 0..100: how far the look may leave the letters (flames, glow). */
  spill: number;
  /** The seed of the first picture; the next ones take seed + 1, + 2 ... (as a batch on the Generate screen). */
  seed: number;
  /** True when every run draws a new seed (the number then shows the one the last run used). */
  randomSeed: boolean;
}

export const RICH_FORM_DEFAULTS: RichForm = { words: '', negative: '', modelKey: null, strength: 50, spill: 0, seed: 0, randomSeed: true };

interface RichFormState {
  form: RichForm;
  setForm: (patch: Partial<RichForm>) => void;
}

export const useRichForm = create<RichFormState>()(
  persist(
    (set, get) => ({
      form: RICH_FORM_DEFAULTS,
      setForm: (patch) => set({ form: { ...get().form, ...patch } }),
    }),
    { name: 'novira.textRich', version: 1, partialize: (s) => ({ form: s.form }), merge: overDefaults('form', RICH_FORM_DEFAULTS) },
  ),
);
