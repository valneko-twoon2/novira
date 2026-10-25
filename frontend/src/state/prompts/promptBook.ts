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

// The id follows the content, so entries added to the seed later never collide with ones a person already holds.
const seedEntries: PromptBookEntry[] = (seed as PromptBookInput[]).map((e) => ({ ...e, id: `seed:${e.category}:${e.tag}` }));

const entryKey = (e: PromptBookInput) => `${e.category}
${e.tag.trim().toLowerCase()}`;

/** Adds the seed entries a saved book does not hold yet (a person's own and edited entries stay as they are). */
export function withNewSeedEntries(saved: PromptBookEntry[]): PromptBookEntry[] {
  const have = new Set(saved.map(entryKey));
  return [...saved, ...seedEntries.filter((e) => !have.has(entryKey(e)))];
}

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
    {
      name: 'novira.promptBook',
      version: 2,
      partialize: (s) => ({ entries: s.entries }),
      // Version 2 grew the seed (poses, motions, relations ...): bring the new words to books saved before it.
      migrate: (persisted, version) => {
        const state = persisted as { entries?: PromptBookEntry[] };
        return version < 2 && Array.isArray(state.entries) ? { ...state, entries: withNewSeedEntries(state.entries) } : state;
      },
    },
  ),
);
