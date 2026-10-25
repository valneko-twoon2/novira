// Synchronous access to decoded images for the renderer; loads in the background and notifies on arrival.
import { loadImage } from '@/backend';

const images = new Map<string, HTMLImageElement | null>();
const listeners = new Set<() => void>();
let version = 0;

/** Bumped every time an image finishes loading; part of render cache keys. */
export const imageVersion = () => version;

export function onImageLoaded(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The decoded image, or null while it is loading (a redraw is triggered when it arrives). */
export function getImage(url: string): HTMLImageElement | null {
  if (!images.has(url)) {
    images.set(url, null);
    loadImage(url)
      .then((img) => {
        images.set(url, img);
        version++;
        listeners.forEach((l) => l());
      })
      .catch(() => {
        // Broken images are simply not drawn.
      });
  }
  return images.get(url) ?? null;
}

/** Wait until all URLs are decoded so an offscreen composite is complete. */
export async function preloadImages(urls: string[]): Promise<void> {
  await Promise.all(
    urls.map(async (url) => {
      try {
        const img = await loadImage(url);
        if (!images.get(url)) {
          images.set(url, img);
          version++;
        }
      } catch {
        // ignore
      }
    }),
  );
}
