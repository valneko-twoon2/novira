// The picture over the whole page, put in by hand: a gallery picture dropped on the page tool, or a file from the computer,
// which is uploaded to the gallery first so the page can show it like any other picture.
import { backend } from '@/backend';
import { findImage, useGallery } from '@/state/gallery';
import { autoAddBoardId } from '@/state/invoke';
import { useComic } from './store';

/** Puts the first named gallery picture over the page. Returns false when none of the names is in the gallery. */
export function putBackdropGalleryImage(pageId: string, names: string[]): boolean {
  const image = findImage(names[0] ?? null);
  if (!image) return false;
  useComic.getState().setBackdrop(pageId, image.name);
  useComic.getState().selectBackdrop(true);
  return true;
}

/** Uploads a file to the gallery and puts it over the page. */
export async function putBackdropFile(pageId: string, file: File): Promise<void> {
  const image = await backend.uploadImage(file, { boardId: autoAddBoardId(), category: 'user' });
  useGallery.getState().addImage(image);
  useComic.getState().setBackdrop(pageId, image.name);
  useComic.getState().selectBackdrop(true);
}
