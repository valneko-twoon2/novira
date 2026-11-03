// Which picture the stage draws over the bbox: the live progress on staging's generating page (or before any result),
// the staged result on a result's page, or none.
import type { ProgressEvent, QueueItem } from '@/backend';
import { stagedPage, type CanvasState } from '@/state/canvas';
import { findImage } from '@/state/gallery';

type Staging = Pick<CanvasState, 'stagedImageNames' | 'stagedIndex' | 'stagingGenerating' | 'stagingShowResults'>;

/** `receivesJobs`: the store is the Image tab's canvas, the only one canvas jobs draw into. */
export function overlayImageUrl(s: Staging, q: { items: QueueItem[]; progress: ProgressEvent | null }, receivesJobs: boolean): string | null {
  const page = stagedPage(s);
  // The progress shows on the generating page only, so a finished result stays visible while the next one is made.
  if (page.generating || !s.stagedImageNames.length) {
    if (!receivesJobs || !q.progress?.progressImageUrl) return null;
    const item = q.items.find((i) => i.id === q.progress?.itemId);
    return item?.destination === 'canvas' ? q.progress.progressImageUrl : null;
  }
  return s.stagingShowResults ? (findImage(s.stagedImageNames[page.index] ?? null)?.url ?? null) : null;
}
