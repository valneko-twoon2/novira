// "Select and fix a part" of a gallery picture: the picture opens on a fresh canvas with an empty inpaint mask chosen
// and the brush in hand, so the part is painted at any zoom; the mask then erases, cuts out or limits a generation.
import type { ImageDTO } from '@/backend';
import { useCanvas } from './canvas';

export function fixPartOnCanvas(image: ImageDTO) {
  useCanvas.getState().importImage(image, 'newCanvasRaster');
  const canvas = useCanvas.getState();
  if (!canvas.addEntity('inpaint')) return;
  canvas.setTool('brush');
}
