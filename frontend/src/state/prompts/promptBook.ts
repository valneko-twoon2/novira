// Prompt list: tags with meanings, categories and notes, plus the dialog state.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import seed from './seed/promptBook.json';

/** Which prompt a word goes to. */
export type PromptKind = 'positive' | 'negative';

export interface PromptBookEntry {
  id: string;
  tag: string;
  meaning: string;
  category: string;
  note: string;
}

export type PromptBookInput = Omit<PromptBookEntry, 'id'>;

interface PromptBookState {
  entries: PromptBookEntry[];
  add: (input: PromptBookInput) => string;
  update: (id: string, input: PromptBookInput) => void;
  remove: (id: string) => void;
  /** Dialog state (not persisted): which prompt receives the clicked tags. */
  open: boolean;
  target: PromptKind;
  openBook: (target: PromptKind) => void;
  closeBook: () => void;
}

let seq = 0;
const newId = () => `pb-${Date.now().toString(36)}${(seq++).toString(36)}`;

const seedEntries: PromptBookEntry[] = (seed as PromptBookInput[]).map((e, i) => ({ ...e, id: `seed-${i}` }));

export const usePromptBook = create<PromptBookState>()(
  persist(
    (set, get) => ({
      entries: seedEntries,
      add: (input) => {
        const id = newId();
        set({ entries: [{ ...input, id }, ...get().entries] });
        return id;
      },
      update: (id, input) => set({ entries: get().entries.map((e) => (e.id === id ? { ...input, id } : e)) }),
      remove: (id) => set({ entries: get().entries.filter((e) => e.id !== id) }),
      open: false,
      target: 'positive',
      openBook: (target) => set({ open: true, target }),
      closeBook: () => set({ open: false }),
    }),
    { name: 'novira.promptBook', version: 1, partialize: (s) => ({ entries: s.entries }) },
  ),
);
