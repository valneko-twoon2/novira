// Saving the scene: drawn at the image's own size, uploaded and added to the gallery.
import { backend } from '@/backend';
import { useGallery } from '@/state/gallery';
import { autoAddBoardId } from '@/state/invoke';
import type { Scene } from '@/state/text/textModel';
import { ensureFont } from '@/state/fonts';
import { renderScene } from './render';

/** Draws the scene at full size and stores the picture in the gallery; rejects when it cannot be drawn or stored. */
export async function saveSceneToGallery(scene: Scene, base: CanvasImageSource | null): Promise<void> {
  const c = document.createElement('canvas');
  c.width = scene.width;
  c.height = scene.height;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  await Promise.all(scene.layers.map((l) => ensureFont(l.style.fontFamily, l.style.fontWeight, l.text)));
  renderScene(ctx, scene, base, 1);
  const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('empty image');
  const image = await backend.uploadImage(blob, { boardId: autoAddBoardId(), category: 'user' });
  useGallery.getState().addImage(image);
}
