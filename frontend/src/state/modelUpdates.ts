// Installed Civitai models that have a newer version. Asked of Civitai once a day when the Model Manager opens (and when the
// person asks); the answer is kept, so the badges show at once the next time. Only the ids of the installed models' pages go out.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { backend, type ModelUpdate } from '@/backend';
import { t } from '@/i18n';
import { toast } from './toasts';

/** How long an answer stays fresh. */
export const UPDATE_CHECK_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface ModelUpdatesState {
  updates: ModelUpdate[];
  /** When the last successful check ended (epoch ms), or null. */
  checkedAt: number | null;
  /** Updates the person was already told about (`<model key>:<latest version id>`), so a toast comes once per new version. */
  told: string[];
  checking: boolean;
  /** Asks Civitai. `quiet` leaves out the toast for a failure (the automatic check). Returns false when it failed. */
  check: (options?: { quiet?: boolean }) => Promise<boolean>;
  /** Checks when the kept answer is older than a day (or there is none). */
  checkIfStale: (now?: number) => Promise<boolean | null>;
  /** Drops the updates of models that are no longer installed. */
  forget: (installedKeys: string[]) => void;
}

const tag = (u: ModelUpdate) => `${u.key}:${u.latestVersionId}`;

export const useModelUpdates = create<ModelUpdatesState>()(
  persist(
    (set, get) => ({
      updates: [],
      checkedAt: null,
      told: [],
      checking: false,
      check: async (options) => {
        if (get().checking) return true;
        set({ checking: true });
        try {
          const updates = await backend.checkModelUpdates();
          const told = new Set(get().told);
          const fresh = updates.filter((u) => !told.has(tag(u)));
          set({ updates, checkedAt: Date.now(), checking: false, told: [...told, ...fresh.map(tag)].slice(-200) });
          if (fresh.length > 0) toast({ status: 'info', title: t('models.updates.found', { count: fresh.length }) });
          return true;
        } catch (e) {
          set({ checking: false });
          if (!options?.quiet) toast({ status: 'error', title: t('models.updates.failed'), description: e instanceof Error ? e.message : String(e) });
          return false;
        }
      },
      checkIfStale: async (now = Date.now()) => {
        const at = get().checkedAt;
        if (at !== null && now - at < UPDATE_CHECK_MAX_AGE_MS && now >= at) return null;
        return get().check({ quiet: true });
      },
      forget: (installedKeys) => {
        const keep = get().updates.filter((u) => installedKeys.includes(u.key));
        if (keep.length !== get().updates.length) set({ updates: keep });
      },
    }),
    {
      name: 'novira.modelUpdates',
      version: 1,
      partialize: (s) => ({ updates: s.updates, checkedAt: s.checkedAt, told: s.told }),
    },
  ),
);
