// Wildcard lists: `__name__` in a prompt stands for one of the entries of the list `name` (one entry per line). The lists
// are kept in this browser profile (persisted), with a few small starter lists; the dialog state is not persisted.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import seed from './seed/wildcards.json';

export interface WildcardList {
  id: string;
  name: string;
  /** The entries as typed: one per line; blank lines and lines starting with `#` are not entries. */
  text: string;
}

/** A list name: letters and digits, with `-` and `_` inside (never at the ends, so `__name__` reads unambiguously). */
export const WILDCARD_NAME_SOURCE = String.raw`[\p{L}\p{N}](?:[\p{L}\p{N}_-]*?[\p{L}\p{N}])?`;
const NAME = new RegExp(`^${WILDCARD_NAME_SOURCE}$`, 'u');

export const isWildcardName = (name: string) => NAME.test(name);

/** The entries of a list's text. */
export function wildcardEntries(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

/** Entries of every list by name, as the prompt expansion reads them. */
export function wildcardMap(lists: readonly WildcardList[]): Record<string, string[]> {
  return Object.fromEntries(lists.map((l) => [l.name, wildcardEntries(l.text)]));
}

/** A valid, unused name made from any text (a file name, say): other characters become `-`, a number is added when taken. */
export function freeWildcardName(wanted: string, lists: readonly WildcardList[], fallback = 'list'): string {
  const base =
    wanted
      .normalize('NFC')
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/^[_-]+|[_-]+$/g, '') || fallback;
  const taken = new Set(lists.map((l) => l.name));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

export type RenameResult = 'ok' | 'invalid' | 'taken';

interface WildcardsState {
  lists: WildcardList[];
  /** Adds a list and returns its id. */
  add: (name: string, text?: string) => string;
  rename: (id: string, name: string) => RenameResult;
  setText: (id: string, text: string) => void;
  remove: (id: string) => void;
  /** Dialog state (not persisted). */
  open: boolean;
  selectedId: string | null;
  openEditor: (selectedId?: string | null) => void;
  closeEditor: () => void;
  select: (id: string | null) => void;
}

let seq = 0;
const newId = () => `wc-${Date.now().toString(36)}${(seq++).toString(36)}`;

const seedLists: WildcardList[] = (seed as Omit<WildcardList, 'id'>[]).map((l, i) => ({ ...l, id: `seed-${i}` }));

export const useWildcards = create<WildcardsState>()(
  persist(
    (set, get) => ({
      lists: seedLists,
      add: (name, text = '') => {
        const id = newId();
        set({ lists: [...get().lists, { id, name: freeWildcardName(name, get().lists), text }] });
        return id;
      },
      rename: (id, name) => {
        if (!isWildcardName(name)) return 'invalid';
        if (get().lists.some((l) => l.name === name && l.id !== id)) return 'taken';
        set({ lists: get().lists.map((l) => (l.id === id ? { ...l, name } : l)) });
        return 'ok';
      },
      setText: (id, text) => set({ lists: get().lists.map((l) => (l.id === id ? { ...l, text } : l)) }),
      remove: (id) => {
        const lists = get().lists.filter((l) => l.id !== id);
        set({ lists, selectedId: get().selectedId === id ? (lists[0]?.id ?? null) : get().selectedId });
      },
      open: false,
      selectedId: null,
      openEditor: (selectedId) => set({ open: true, selectedId: selectedId ?? get().selectedId ?? get().lists[0]?.id ?? null }),
      closeEditor: () => set({ open: false }),
      select: (id) => set({ selectedId: id }),
    }),
    { name: 'novira.wildcards', version: 1, partialize: (s) => ({ lists: s.lists }) },
  ),
);
