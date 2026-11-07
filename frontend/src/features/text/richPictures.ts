// The pictures of AI fills: which a scene needs, and loading them so the canvas can paint them in place of the fill.
import { useEffect, useMemo, useState } from 'react';
import { loadImage } from '@/backend';
import { findImage, useGallery } from '@/state/gallery';
import { richIsCurrent, type Scene } from '@/state/text/textModel';
import type { RichPictures } from './render';

/** The stored picture names of the AI fills a scene paints now (current ones of visible text layers), without repeats. */
export function richPictureNames(scene: Scene): string[] {
  const names = new Set<string>();
  for (const layer of scene.layers) {
    if (layer.type === 'text' && layer.visible && layer.text !== '' && layer.rich && richIsCurrent(layer)) names.add(layer.rich.imageName);
  }
  return [...names];
}

/** Loads the named pictures from the gallery; one that is gone or fails to load is left out (its layer shows the plain fill). */
export async function loadRichPictures(names: string[]): Promise<Map<string, CanvasImageSource>> {
  const out = new Map<string, CanvasImageSource>();
  await Promise.all(
    names.map(async (name) => {
      const url = findImage(name)?.url;
      if (!url) return;
      try {
        out.set(name, await loadImage(url));
      } catch {
        // A picture that cannot be read is the same as no picture.
      }
    }),
  );
  return out;
}

const NONE: RichPictures = new Map();

/** The loaded pictures of the scene's AI fills, as they arrive; the scene is drawn again when the map changes. */
export function useRichPictures(scene: Scene): RichPictures {
  const names = useMemo(() => richPictureNames(scene), [scene]);
  // The urls take part in the key: a picture that appears in the gallery after the scene was loaded is picked up then.
  const urls = useGallery((s) => names.map((n) => s.images.find((i) => i.name === n)?.url ?? '').join('|'));
  const [pictures, setPictures] = useState<RichPictures>(NONE);
  useEffect(() => {
    let alive = true;
    if (names.length === 0) {
      setPictures((p) => (p.size === 0 ? p : NONE));
      return;
    }
    void loadRichPictures(names).then((loaded) => alive && setPictures(loaded));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `urls` stands for the gallery entries the names resolve to
  }, [names.join('|'), urls]);
  return pictures;
}
