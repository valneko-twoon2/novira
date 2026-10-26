// Board operations (create, rename, archive, delete) synced to the backend and the gallery store.
import { backend, type BoardDTO } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { recordDeletion, undoDeletion } from '@/state/galleryUndo';
import { toast } from '@/state/toasts';

export async function createBoard(): Promise<BoardDTO> {
  const board = await backend.createBoard(t('gallery.boards.newBoardName'));
  useGallery.getState().upsertBoard(board);
  return board;
}

export async function renameBoard(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  useGallery.getState().upsertBoard(await backend.updateBoard(id, { name: trimmed }));
}

export async function setBoardArchived(id: string, archived: boolean) {
  const board = await backend.updateBoard(id, { archived });
  const g = useGallery.getState();
  g.upsertBoard(board);
  if (archived && !g.settings.showArchivedBoards && g.selectedBoardId === id) g.selectBoard('none');
  if (archived && g.autoAddBoardId === id) g.setAutoAddBoard('none');
}

export async function deleteBoard(id: string, deleteImages: boolean) {
  const { deletedImages } = await backend.deleteBoard(id, deleteImages);
  const g = useGallery.getState();
  if (deletedImages.length) g.removeImages(deletedImages);
  else g.detachBoardImages(id);
  g.removeBoard(id);
  recordDeletion(deletedImages);
  toast({ status: 'success', title: t('gallery.boards.deleted'), actions: deletedImages.length ? [{ label: t('gallery.undoDelete.action'), run: () => void undoDeletion(deletedImages) }] : undefined });
}

export function downloadBoard() {
  toast({ status: 'info', title: t('gallery.boards.downloadUnavailable') });
}
