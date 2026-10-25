// "Trim the transparent margin": a picture with a transparent background (a cut-out) is cropped to the area that is
// not transparent and saved next to the original as a new transparent PNG, ready to use as a sticker or a material.
import { backend, type ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from './gallery';
import { toast } from './toasts';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Pixels with at most this much opacity (0 to 255) count as transparent; soft shadows below it do not widen the box. */
export const ALPHA_THRESHOLD = 8;

interface Pixels {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

/** The smallest box holding every pixel that is not transparent, or null when the whole picture is transparent. */
export function opaqueBounds({ width, height, data }: Pixels, threshold: number = ALPHA_THRESHOLD): Box | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) <= threshold) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      bottom = y;
    }
  }
  return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:/.test(url)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

/** Crops the picture to its non-transparent area and stores the result. Null (with a notification) when there is nothing to trim or it failed. */
export async function trimTransparent(image: ImageDTO): Promise<ImageDTO | null> {
  try {
    const img = await load(image.url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no canvas');
    ctx.drawImage(img, 0, 0);
    const box = opaqueBounds(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (!box) {
      toast({ status: 'warning', title: t('gallery.trim.empty') });
      return null;
    }
    if (box.width === canvas.width && box.height === canvas.height) {
      toast({ status: 'info', title: t('gallery.trim.nothing') });
      return null;
    }
    const out = document.createElement('canvas');
    out.width = box.width;
    out.height = box.height;
    out.getContext('2d')?.drawImage(canvas, box.left, box.top, box.width, box.height, 0, 0, box.width, box.height);
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('empty image');
    const saved = await backend.uploadImage(blob, { boardId: image.boardId, category: image.category });
    useGallery.getState().addImage(saved);
    toast({ status: 'success', title: t('gallery.trim.saved', { width: box.width, height: box.height }) });
    return saved;
  } catch (e) {
    toast({ status: 'error', title: t('gallery.trim.failed'), description: e instanceof Error ? e.message : String(e) });
    return null;
  }
}
