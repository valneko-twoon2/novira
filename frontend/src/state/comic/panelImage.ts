// Pictures put into a panel by hand: a gallery picture dropped on the panel or picked, or a file from the computer, which is
// uploaded to the gallery first so the panel can show it like any other picture.
import { backend } from '@/backend';
import { t } from '@/i18n';
import { findImage, useGallery } from '@/state/gallery';
import { autoAddBoardId } from '@/state/invoke';
import { toast } from '@/state/toasts';
import { useComic } from './store';

/** Puts the first named gallery picture into a panel. Returns false when none of the names is in the gallery. */
export function putGalleryImage(panelId: string, names: string[]): boolean {
  const image = findImage(names[0] ?? null);
  if (!image) return false;
  useComic.getState().setPanelImage(panelId, image.name);
  return true;
}

/** Uploads a file to the gallery and puts it into the panel. */
export async function putFileImage(panelId: string, file: File): Promise<void> {
  const image = await backend.uploadImage(file, { boardId: autoAddBoardId(), category: 'user' });
  useGallery.getState().addImage(image);
  useComic.getState().setPanelImage(panelId, image.name);
}

/** Tells the user that a picture could not be put into a panel. */
export function reportImageFailure(err: unknown): void {
  toast({ status: 'error', title: t('comic.panel.imageFailed'), description: err instanceof Error ? err.message : String(err) });
}
