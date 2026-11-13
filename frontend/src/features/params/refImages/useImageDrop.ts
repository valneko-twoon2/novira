// Resolves gallery drags and OS file drops into ImageDTOs.
import { backend, type ImageDTO } from '@/backend';
import { findImage } from '@/state/gallery';
import { autoAddBoardId } from '@/state/invoke';

export function imageFromNames(names: string[]): ImageDTO | undefined {
  return names.map((n) => findImage(n)).find((i): i is ImageDTO => !!i);
}

/** The first picture among the names: a video or a sound dragged with it is passed over. */
export function pictureFromNames(names: string[]): ImageDTO | undefined {
  return names.map((n) => findImage(n)).find((i): i is ImageDTO => !!i && (i.mediaType ?? 'image') === 'image');
}

export async function uploadFirst(files: File[]): Promise<ImageDTO | undefined> {
  const file = files[0];
  if (!file) return undefined;
  return backend.uploadImage(file, { boardId: autoAddBoardId(), category: 'user' });
}
