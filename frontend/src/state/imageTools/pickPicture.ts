// The picture a tool button outside the gallery acts on (the prompt box's "describe", the canvas's "pose from a
// picture"): the one picture selected in the gallery, or a file the user picks, uploaded to the gallery first.
import { backend } from '@/backend';
import { t } from '@/i18n';
import { findImage, useGallery } from '../gallery';
import { autoAddBoardId } from '../invoke';
import { toast } from '../toasts';

/** The name of the gallery's selected picture when exactly one still picture is selected. */
export function selectedStill(): string | null {
  const { selection } = useGallery.getState();
  const picked = selection.length === 1 ? findImage(selection[0] ?? null) : undefined;
  return picked && (picked.mediaType ?? 'image') === 'image' ? picked.name : null;
}

/** Puts a file into the gallery (on the board new pictures go to) and gives its name; null, with a notice, when it fails. */
export async function uploadPicture(file: File): Promise<string | null> {
  try {
    const image = await backend.uploadImage(file, { boardId: autoAddBoardId(), category: 'user' });
    useGallery.getState().addImage(image);
    return image.name;
  } catch (e) {
    toast({ status: 'error', title: t('gallery.tools.uploadFailed'), description: e instanceof Error ? e.message : String(e) });
    return null;
  }
}
