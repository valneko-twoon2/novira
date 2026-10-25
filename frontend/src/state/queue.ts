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
