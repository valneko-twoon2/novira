// The picture jobs that are being drawn right now and appear in the gallery: the strip above the grid, the cells at the
// start of the grid and the viewer all show these. Drafts go to the Drafts view and a canvas job shows on the canvas.
import { useMemo } from 'react';
import type { QueueItem } from '@/backend';
import { useQueue } from './queue';

export function generatingItems(items: QueueItem[]): QueueItem[] {
  return items.filter((i) => i.status === 'in_progress' && i.destination === 'gallery' && i.params.draftAt === undefined);
}

export function useGeneratingItems(): QueueItem[] {
  const items = useQueue((s) => s.items);
  return useMemo(() => generatingItems(items), [items]);
}
