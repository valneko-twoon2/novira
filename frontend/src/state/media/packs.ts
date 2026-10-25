// The extra models each kind of media needs (video, music, voice): whether they are installed, and download progress.
import { create } from 'zustand';
import { t } from '@/i18n';
import type { PackKind, PackStatus, Packs } from '@/backend';

interface PacksState {
  packs: Packs;
  setPack: (kind: PackKind, status: PackStatus) => void;
  setAll: (packs: Packs) => void;
}

export const usePacks = create<PacksState>()((set, get) => ({
  packs: { video: { state: 'ready' }, turbo: { state: 'ready' }, music: { state: 'ready' }, voice: { state: 'ready' }, inpaint: { state: 'ready' }, logo: { state: 'ready' } },
  setPack: (kind, status) => set({ packs: { ...get().packs, [kind]: status } }),
  setAll: (packs) => set({ packs }),
}));

/** Bytes as `12.3 GB`. */
export function formatGb(bytes: number): string {
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

/** "3 min 20 s" style time; whole seconds below a minute. */
export function formatRemaining(seconds: number): string {
  const s = Math.max(1, Math.round(seconds));
  if (s < 60) return t('splash.engine.seconds', { n: s });
  const minutes = Math.floor(s / 60);
  return minutes >= 60 ? t('splash.engine.hours', { h: Math.floor(minutes / 60), m: minutes % 60 }) : t('splash.engine.minutes', { n: minutes, s: s % 60 });
}

/** Bytes as `850 MB` below a gigabyte, else `1.4 GB` (small packs would all read `0.0 GB`). */
export function formatPackSize(bytes: number): string {
  return bytes >= 1_000_000_000 ? formatGb(bytes) : `${Math.max(1, Math.round(bytes / 1_000_000))} MB`;
}
