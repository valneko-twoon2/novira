// Resolves gallery drags and OS file drops into ImageDTOs.
import { backend, type ImageDTO } from '@/backend';
import { findImage } from '@/state/gallery';
import { autoAddBoardId } from '@/state/invoke';

export function imageFromNames(names: string[]): ImageDTO | undefined {
  return names.map((n) => findImage(n)).find((i): i is ImageDTO => !!i);
}

export async function uploadFirst(files: File[]): Promise<ImageDTO | undefined> {
  const file = files[0];
  if (!file) return undefined;
  return backend.uploadImage(file, { boardId: autoAddBoardId(), category: 'user' });
}
