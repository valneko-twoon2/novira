// Logo creation: the form values, kept between sessions. The lettering is typed per logo; the style and shape are
// what a logo preset keeps.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { overDefaults } from '../persistDefaults';

export const LOGO_SIZES = [
  { value: 'square', width: 1024, height: 1024 },
  { value: 'wide', width: 1536, height: 768 },
  { value: 'tall', width: 768, height: 1536 },
] as const;
export type LogoSize = (typeof LOGO_SIZES)[number]['value'];

export const LOGO_LIMITS = { count: { min: 1, max: 4 }, text: 60 };

export interface LogoForm {
  /** The words the logo shows. */
  text: string;
  /** Mood, colors and look, in free words. */
  style: string;
  size: LogoSize;
  /** Candidates made per press. */
  count: number;
  seed: number;
  randomizeSeed: boolean;
}

const LOGO_DEFAULTS: LogoForm = { text: '', style: '', size: 'square', count: 2, seed: 123456789, randomizeSeed: true };

interface LogoState {
  form: LogoForm;
  setForm: (patch: Partial<LogoForm>) => void;
}

export const useLogo = create<LogoState>()(
  persist(
    (set, get) => ({
      form: LOGO_DEFAULTS,
      setForm: (patch) => set({ form: { ...get().form, ...patch } }),
    }),
    { name: 'novira.logo', version: 1, partialize: (s) => ({ form: s.form }), merge: overDefaults('form', LOGO_DEFAULTS) },
  ),
);
