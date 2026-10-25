// The natural size of a picture by its address, loaded once and kept: the panel and the picture's handles need the
// picture's shape to size it as the page image does.
import { useEffect, useState } from 'react';
import type { Size } from '@/state/comic/imageView';

const known = new Map<string, Size>();

/** The picture's size in pixels, or null until it has loaded (or when it cannot be loaded). */
export function useImageSize(url: string | undefined): Size | null {
  const [size, setSize] = useState<Size | null>(() => (url ? (known.get(url) ?? null) : null));
  useEffect(() => {
    if (!url) {
      setSize(null);
      return;
    }
    const cached = known.get(url);
    if (cached) {
      setSize(cached);
      return;
    }
    let live = true;
    const img = new Image();
    img.onload = () => {
      const loaded = { width: img.naturalWidth, height: img.naturalHeight };
      known.set(url, loaded);
      if (live) setSize(loaded);
    };
    img.src = url;
    return () => {
      live = false;
    };
  }, [url]);
  return size;
}
