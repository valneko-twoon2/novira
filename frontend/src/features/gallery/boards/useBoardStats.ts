// Per-board image counts and cover image (latest image), computed from the gallery images.
import { useMemo } from 'react';
import type { ImageDTO } from '@/backend';
import { useGallery, type BoardId } from '@/state/gallery';

export interface BoardStats {
  images: number;
  assets: number;
  cover: ImageDTO | null;
}

export function useBoardStats(): Map<BoardId, BoardStats> {
  const images = useGallery((s) => s.images);
  return useMemo(() => {
    const map = new Map<BoardId, BoardStats>();
    for (const img of images) {
      if (img.isIntermediate) continue;
      const id = img.boardId ?? 'none';
      const s = map.get(id) ?? { images: 0, assets: 0, cover: null };
      if (img.category === 'general') s.images++;
      else s.assets++;
      if (!s.cover || img.createdAt > s.cover.createdAt) s.cover = img;
      map.set(id, s);
    }
    return map;
  }, [images]);
}
