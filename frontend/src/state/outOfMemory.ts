// Jobs that failed because the GPU ran out of memory: which ones to explain, and the smaller retry they offer.
import { create } from 'zustand';
import { backend, type GenerationMode, type QueueItem, type RetrySize } from '@/backend';
import { t } from '@/i18n';
import { canTurnOnLowMemory, useLowMemory } from './lowMemory';
import { toast, type ToastAction } from './toasts';

/** Modes made at a chosen picture size, where a smaller one needs less memory (the backend accepts these only). */
const RESIZABLE: ReadonlySet<GenerationMode> = new Set(['txt2img', 'img2img', 'inpaint', 'outpaint']);
/** A smaller retry keeps about this share of the area. */
const AREA_SHARE = 0.75;
const MIN_SIDE = 64;

export const isOutOfMemory = (item: QueueItem) => item.status === 'failed' && item.errorKind === 'out_of_memory';

/** About 75% of the area with the same aspect ratio, each side a multiple of 8 and at least 64; `null` when nothing is smaller. */
export function smallerSize(width: number, height: number): RetrySize | null {
  const scale = Math.sqrt(AREA_SHARE);
  const side = (v: number) => Math.min(v, Math.max(MIN_SIDE, Math.round((v * scale) / 8) * 8));
  const next = { width: side(width), height: side(height) };
  return next.width < width || next.height < height ? next : null;
}

/** The size a smaller retry of `item` would use, or `null` when it does not apply (another mode, already tiny). */
export function retrySmallerSize(item: QueueItem): RetrySize | null {
  if (!RESIZABLE.has(item.params.generationMode) || item.comfyGraph) return null;
  return smallerSize(item.params.width, item.params.height);
}

/** Queues the item again at the smaller size and hides its notice. */
export async function retrySmaller(item: QueueItem): Promise<void> {
  const size = retrySmallerSize(item);
  if (!size) return;
  try {
    const copy = await backend.retryQueueItem(item.id, size);
    if (copy) toast({ status: 'info', title: t('queue.oom.toast.retried', { id: item.id, width: size.width, height: size.height }) });
    useOutOfMemoryNotices.getState().dismiss(item.id);
  } catch (err) {
    toast({ status: 'error', title: t('queue.oom.toast.retryFailed'), description: err instanceof Error ? err.message : String(err) });
  }
}

/** How long the out-of-memory toast stays: long enough to read it and pick an action. */
const TOAST_MS = 12_000;

/** A job just ran out of memory: keep its notice for the gallery and say so in a toast with the ways out. */
export function reportOutOfMemory(item: QueueItem): void {
  useOutOfMemoryNotices.getState().report(item.id);
  const actions: ToastAction[] = [];
  if (retrySmallerSize(item)) actions.push({ label: t('queue.oom.retrySmaller'), run: () => void retrySmaller(item) });
  if (canTurnOnLowMemory(useLowMemory.getState().mode)) {
    actions.push({ label: t('queue.oom.lowMemory'), run: () => void useLowMemory.getState().setEnabled(true) });
  }
  toast({ status: 'error', title: t('queue.oom.title'), description: t('queue.oom.explain'), actions }, TOAST_MS);
}

interface NoticeState {
  /** Items that ran out of memory while the app was open, newest last, until dismissed or retried. */
  ids: number[];
  report: (id: number) => void;
  dismiss: (id: number) => void;
}

export const useOutOfMemoryNotices = create<NoticeState>()((set, get) => ({
  ids: [],
  report: (id) => {
    if (!get().ids.includes(id)) set({ ids: [...get().ids, id].slice(-3) });
  },
  dismiss: (id) => set({ ids: get().ids.filter((i) => i !== id) }),
}));
