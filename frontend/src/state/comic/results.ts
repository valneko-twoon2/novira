// Puts the pictures the queue makes into the comic panels and the characters' sheets they were drawn for. Called by the
// backend event wiring.
import type { ImageDTO, QueueItem } from '@/backend';
import { useQueue } from '@/state/queue';
import { useComic } from './store';
import type { SheetTarget } from './storeState';

/**
 * A panel's job that failed or was cancelled will never make a picture: forget it. A failed one is kept on its panel, so the
 * panel list can say that it could not be drawn.
 */
export function onComicQueueItem(item: QueueItem): void {
  const store = useComic.getState();
  if (item.status === 'failed' || item.status === 'canceled') {
    store.clearSheetPending(item.id);
    keepViewItems.delete(item.id);
  }
  const panelId = store.pending[item.id];
  if (item.status === 'failed' && panelId) store.markDrawFailed(panelId);
  if (item.status === 'failed' || item.status === 'canceled') store.clearPending(item.id);
}

/** The items that redraw a part of a panel's picture: their result keeps the view of the picture it replaces. */
const keepViewItems = new Set<number>();

/**
 * Remembers that a queue item was drawn for a panel (with `keepView`, a part redrawn in place: its picture keeps the place,
 * zoom and turn of the old one). The engine can refuse a job at once, so its failure can reach the wiring
 * before the enqueue call returns: the queue's latest status for the item decides, not the status in the answer.
 */
export function bindComicItem(item: QueueItem, panelId: string, options?: { keepView?: boolean }): void {
  const store = useComic.getState();
  if (options?.keepView) keepViewItems.add(item.id);
  const latest = useQueue.getState().items.find((i) => i.id === item.id)?.status ?? item.status;
  if (latest === 'failed') store.markDrawFailed(panelId);
  else if (latest !== 'canceled') store.setPending(item.id, panelId);
}

/** The queue items that draw a character's reference picture, and the pictures they made (picked up by takePortrait). */
const portraitItems = new Set<number>();
const portraitImages = new Map<number, string>();

/** Remembers that a queue item draws a character's reference picture: it belongs to no panel. */
export function bindPortraitItem(item: QueueItem): void {
  portraitItems.add(item.id);
}

/** The picture a reference-picture item made, once; undefined while it has none. */
export function takePortrait(itemId: number): string | undefined {
  const name = portraitImages.get(itemId);
  if (name === undefined) return undefined;
  portraitImages.delete(itemId);
  portraitItems.delete(itemId);
  return name;
}

/** Remembers that a queue item draws a view of a character's sheet; a job the engine refused at once is forgotten. */
export function bindSheetItem(item: QueueItem, target: SheetTarget): void {
  const latest = useQueue.getState().items.find((i) => i.id === item.id)?.status ?? item.status;
  if (latest !== 'failed' && latest !== 'canceled') useComic.getState().setSheetPending(item.id, target);
}

/** The picture of a queue item this screen is waiting for goes into its panel or its sheet. Other pictures are left alone. */
export function onComicImage(item: QueueItem, image: ImageDTO): void {
  if (portraitItems.has(item.id)) {
    portraitImages.set(item.id, image.name);
    return;
  }
  const store = useComic.getState();
  const view = store.sheetPending[item.id];
  if (view) {
    store.clearSheetPending(item.id);
    store.setCharacterView(view.projectId, view.characterId, view.view, image.name);
    return;
  }
  const panelId = store.pending[item.id];
  if (!panelId) return;
  store.clearPending(item.id);
  store.setPanelImage(panelId, image.name, { keepView: keepViewItems.delete(item.id) });
}
