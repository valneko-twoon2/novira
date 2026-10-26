// Undo and redo of deleting pictures from the gallery. The backend keeps a deleted picture in its trash for a while, so
// taking a deletion back is a restore; doing it again is another delete. Each entry is the names of one deletion.
import { create } from 'zustand';
import { backend } from '@/backend';
import { t, tCount } from '@/i18n';
import { useGallery } from './gallery';
import { toast } from './toasts';

/** How many deletions are remembered each way. */
const LIMIT = 30;

interface UndoState {
  /** Deletions that can be taken back, the latest last. */
  undo: string[][];
  /** Deletions that were taken back and can be made again, the latest last. */
  redo: string[][];
}

export const useGalleryUndo = create<UndoState>()(() => ({ undo: [], redo: [] }));

const cap = (list: string[][]): string[][] => list.slice(-LIMIT);

/** Remembers a deletion that has just been made; a new deletion ends what could be made again. */
export function recordDeletion(names: string[]) {
  if (!names.length) return;
  useGalleryUndo.setState((s) => ({ undo: cap([...s.undo, names]), redo: [] }));
}

const failed = (err: unknown) => toast({ status: 'error', title: t('gallery.undoDelete.failed'), description: err instanceof Error ? err.message : String(err) });

/** Takes back a deletion: the given one, or the latest. Returns whether pictures came back. */
export async function undoDeletion(names?: string[]): Promise<boolean> {
  const { undo } = useGalleryUndo.getState();
  const entry = names ? undo.find((e) => e === names) : undo[undo.length - 1];
  if (!entry) return false;
  try {
    const back = await backend.restoreImages(entry);
    useGalleryUndo.setState((s) => ({ undo: s.undo.filter((e) => e !== entry), redo: back.length ? cap([...s.redo, back.map((i) => i.name)]) : s.redo }));
    if (!back.length) {
      toast({ status: 'warning', title: t('gallery.undoDelete.expired') });
      return false;
    }
    const g = useGallery.getState();
    const names = new Set(back.map((i) => i.name));
    g.setImages([...back, ...g.images.filter((i) => !names.has(i.name))]);
    toast({ status: 'success', title: tCount('gallery.undoDelete.done', back.length) });
    return true;
  } catch (err) {
    failed(err);
    return false;
  }
}

/** Deletes again what was taken back. Returns whether pictures were deleted. */
export async function redoDeletion(): Promise<boolean> {
  const { redo } = useGalleryUndo.getState();
  const entry = redo[redo.length - 1];
  if (!entry) return false;
  try {
    await backend.deleteImages(entry);
    useGallery.getState().removeImages(entry);
    useGalleryUndo.setState((s) => ({ redo: s.redo.filter((e) => e !== entry), undo: cap([...s.undo, entry]) }));
    toast({ status: 'success', title: tCount('gallery.redoDelete.done', entry.length) });
    return true;
  } catch (err) {
    failed(err);
    return false;
  }
}
