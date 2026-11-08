// Mirror of the backend queue plus the live progress of the running item.
import { create } from 'zustand';
import type { ProgressEvent, QueueItem, QueueStatus } from '@/backend';

interface QueueState {
  items: QueueItem[];
  status: QueueStatus;
  progress: ProgressEvent | null;
  setItems: (items: QueueItem[]) => void;
  upsertItem: (item: QueueItem) => void;
  setStatus: (status: QueueStatus) => void;
  setProgress: (progress: ProgressEvent | null) => void;
}

/**
 * The progress to show after `next`: a step that carries no picture (the engine sends each preview once, with its own frame,
 * not again with the steps after it) keeps the picture of the same item's last progress instead of blanking it.
 */
export function mergeProgress(prev: ProgressEvent | null, next: ProgressEvent): ProgressEvent {
  if (next.progressImageUrl !== null || prev?.itemId !== next.itemId || prev.progressImageUrl === null) return next;
  return { ...next, progressImageUrl: prev.progressImageUrl };
}

export const useQueue = create<QueueState>()((set, get) => ({
  items: [],
  status: { pending: 0, inProgress: 0, completed: 0, failed: 0, canceled: 0, total: 0, isPaused: false },
  progress: null,
  setItems: (items) => set({ items }),
  upsertItem: (item) => {
    const items = get().items;
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx < 0) set({ items: [...items, item] });
    else set({ items: items.map((i) => (i.id === item.id ? item : i)) });
  },
  setStatus: (status) => set({ status }),
  setProgress: (progress) => set({ progress }),
}));
