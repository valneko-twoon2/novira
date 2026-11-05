// Small copies of pictures for a notification to show which pictures it is about. A deleted picture's file goes to the
// trash, where its address no longer serves it, so the copy is drawn while the picture is still there and kept as a data
// URL with the notification.
import type { ImageDTO } from '@/backend';

/** How many pictures a notification shows; the title says how many there were in all. */
export const MARKS_SHOWN = 4;
/** Height of a copy, in pixels: twice the shown size, for sharp edges on a high-density screen. */
const HEIGHT = 64;
/** A picture that does not load by then is left out (the notification must not wait on it). */
const WAIT_MS = 1500;

function drawSmall(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), WAIT_MS);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const scale = HEIGHT / Math.max(1, img.naturalHeight);
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * scale));
        c.height = HEIGHT;
        c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/webp', 0.8));
      } catch {
        resolve(null); // a picture the canvas may not read (another origin): no mark rather than no notification
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    if (/^https?:/.test(url)) img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

/** Small kept copies of the first pictures of `images` (a video's first frame, a sound's waveform). */
export async function keepMarks(images: ImageDTO[]): Promise<string[]> {
  const urls = images.map((i) => i.thumbnailUrl).filter((u): u is string => !!u).slice(0, MARKS_SHOWN);
  return (await Promise.all(urls.map(drawSmall))).filter((u): u is string => !!u);
}

/** The addresses of pictures that are still in the gallery (after they came back), no copy needed. */
export function liveMarks(images: ImageDTO[]): string[] {
  return images.map((i) => i.thumbnailUrl).filter((u): u is string => !!u).slice(0, MARKS_SHOWN);
}
