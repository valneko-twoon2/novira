// What the "register a character" dialog is open for (null when closed). Other features open it through here; the
// params feature shows it.
import { create } from 'zustand';

export interface CharacterTarget {
  /** The gallery pictures to register (or, when editing, the character's current reference pictures). */
  imageNames: string[];
  /** Name to start with. */
  name?: string;
  /** Set when an existing character is being edited; the dialog then updates it instead of adding one. */
  editId?: string;
}

interface CharacterDialogState {
  target: CharacterTarget | null;
  open: (target: CharacterTarget) => void;
  close: () => void;
}

export const useCharacterDialog = create<CharacterDialogState>()((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));
