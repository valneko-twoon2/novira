// Downloads of the extra models (video, music, voice, ...) and of custom node packs that were started or reported
// during this session, for the dock that shows their progress. Packs that were already installed never appear here.
import { create } from 'zustand';
import type { PackKind, PackStatus } from '@/backend';

/** What the list adds to a download: when it started and how fast the file in progress is coming. */
interface Timing {
  /** Epoch milliseconds of the first report. */
  since?: number;
  /** Bytes per second of the file in progress, smoothed; null until there is enough to say. */
  speed?: number | null;
  /** The last point the speed was measured at. */
  sample?: { at: number; bytes: number; file: string; index: number };
}

export type PackDownload =
  | ({ key: string; kind: 'model'; pack: PackKind; status: PackStatus } & Timing)
  /** `url` is the GitHub address the pack is installed from. */
  | ({ key: string; kind: 'node'; url: string; status: PackStatus } & Timing);

/** Reports come in many times a second; the speed is measured over spans at least this long. */
const MIN_SPAN_MS = 1000;
/** How much of the newest measurement goes into the smoothed speed. */
const SMOOTHING = 0.3;

interface DownloadsState {
  entries: PackDownload[];
  /** Adds an entry or replaces the one with the same key; a pack that went back to `missing` (cancelled) leaves. */
  track: (entry: PackDownload) => void;
  dismiss: (key: string) => void;
  clearFinished: () => void;
}

/** Still working: nothing to dismiss yet. */
export const isActive = (status: PackStatus) => status.state === 'downloading' || status.state === 'installing';

/**
 * Seconds until the file in progress is down, or null when it cannot be said (no size announced, no speed yet).
 * A pack of several files counts only the one being fetched: the sizes of the others are not known yet.
 */
export function remainingSeconds(d: PackDownload): number | null {
  const s = d.status;
  if (s.state !== 'downloading' || !s.totalBytes || !d.speed || d.speed <= 0) return null;
  return Math.max(0, s.totalBytes - s.bytes) / d.speed;
}

/** The entry with its speed brought up to date by the newest report. */
function timed(prev: PackDownload | undefined, entry: PackDownload, now: number): PackDownload {
  const since = prev?.since ?? now;
  const s = entry.status;
  if (s.state !== 'downloading') return { ...entry, since, speed: null, sample: undefined };
  const point = { at: now, bytes: s.bytes, file: s.file, index: s.index };
  const last = prev?.sample;
  if (!last || last.file !== s.file || last.index !== s.index || s.bytes < last.bytes) return { ...entry, since, speed: null, sample: point };
  const span = now - last.at;
  if (span < MIN_SPAN_MS) return { ...entry, since, speed: prev?.speed ?? null, sample: last };
  const measured = ((s.bytes - last.bytes) * 1000) / span;
  const speed = prev?.speed ? prev.speed * (1 - SMOOTHING) + measured * SMOOTHING : measured;
  return { ...entry, since, speed: speed > 0 ? speed : (prev?.speed ?? null), sample: point };
}

export const useDownloads = create<DownloadsState>()((set, get) => ({
  entries: [],
  track: (entry) => {
    const rest = get().entries.filter((e) => e.key !== entry.key);
    if (entry.status.state === 'missing') return set({ entries: rest });
    const prev = get().entries.find((e) => e.key === entry.key);
    const next = timed(prev, entry, Date.now());
    set({ entries: prev ? get().entries.map((e) => (e.key === entry.key ? next : e)) : [...rest, next] });
  },
  dismiss: (key) => set({ entries: get().entries.filter((e) => e.key !== key) }),
  clearFinished: () => set({ entries: get().entries.filter((e) => isActive(e.status)) }),
}));
