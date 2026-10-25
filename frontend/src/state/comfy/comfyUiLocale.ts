// The words ComfyUI's own screens show in the app's language (names of node categories, nodes, inputs and outputs),
// read from the running ComfyUI so the node editor names things as ComfyUI does. None in the browser, or when ComfyUI
// has no words for the language: the editor keeps ComfyUI's English names then.
import { create } from 'zustand';
import { backend, type ComfyUiLocale } from '@/backend';
import { devLog } from '@/state/devLog';

interface ComfyUiLocaleState {
  /** The language `words` are in. */
  locale: string | null;
  words: ComfyUiLocale | null;
  /** Reads the words of `locale` unless they are read; a failure leaves the English names and goes to the developer log. */
  load: (locale: string) => Promise<void>;
}

export const useComfyUiLocale = create<ComfyUiLocaleState>()((set, get) => ({
  locale: null,
  words: null,
  load: async (locale) => {
    if (get().locale === locale) return;
    set({ locale, words: null });
    try {
      const words = await backend.comfyUiLocale(locale);
      // The language may have changed while this one was read.
      if (get().locale === locale) set({ words });
    } catch (e) {
      devLog('warn', 'comfy', `ComfyUI's words for ${locale} are unavailable: ${e instanceof Error ? e.message : String(e)}`);
    }
  },
}));
