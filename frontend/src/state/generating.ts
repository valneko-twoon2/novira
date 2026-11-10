// The picture jobs that are being drawn right now and appear in the gallery: the strip above the grid, the cells at the
// start of the grid and the viewer all show these (also while the picture is for the Candidates view). Drafts go to the
// Candidates view and a canvas job shows on the canvas.
import { useMemo } from 'react';
import type { QueueItem } from '@/backend';
import { useQueue } from './queue';

export function generatingItems(items: QueueItem[]): QueueItem[] {
  return items.filter((i) => i.status === 'in_progress' && (i.destination === 'gallery' || i.destination === 'candidates') && i.params.draftAt === undefined);
}

export function useGeneratingItems(): QueueItem[] {
  const items = useQueue((s) => s.items);
  return useMemo(() => generatingItems(items), [items]);
}
