// The frontend's saved state: every browser-storage key under PERSIST_PREFIX (characters, presets, prompt book,
// workflows being edited, drafts, settings, ...). A backup carries it as `ui-state.json`; after a restore the backend
// hands it back once at start-up and it replaces what this browser storage holds.
import { backend, type RestoreOutcome } from '@/backend';
import { t } from '@/i18n';
import { toast } from './toasts';
import { applyUiState, collectUiState, PERSIST_PREFIX, persistedKeys } from './uiStateStorage';

export { applyUiState, collectUiState, PERSIST_PREFIX, persistedKeys };

/** Session flag that survives the reload after a restore, so the next load can say it worked. */
const RESTORED_FLAG = 'novira-restore-done';

/** What a reset can clear: the keys of each part of the saved state, or null for all of it. */
export const RESET_SCOPES = {
  settings: ['novira.settings'],
  generation: ['novira.params'],
  gallery: ['novira.gallery'],
  assistant: ['novira.agent'],
  all: null,
} as const satisfies Record<string, readonly string[] | null>;
export type ResetScope = keyof typeof RESET_SCOPES;

/** Removes the saved state of one part (every key of the app for "all"); returns how many keys went. */
export function clearSavedState(scope: ResetScope, storage: Storage): number {
  const keys: readonly string[] = RESET_SCOPES[scope] ?? persistedKeys(storage);
  let removed = 0;
  for (const key of keys) {
    if (storage.getItem(key) === null) continue;
    storage.removeItem(key);
    removed++;
  }
  return removed;
}

/**
 * Asks the backend whether this start applied a restore. If so, the restored screen state replaces this browser's and
 * the page reloads (returns true: nothing else should start). A failed restore is reported. Called first at start-up,
 * before any store writes to the storage.
 */
export async function takeRestoredUiState(
  storage: Storage | undefined = globalThis.localStorage,
  session: Storage | undefined = globalThis.sessionStorage,
  reload: () => void = () => location.reload(),
): Promise<boolean> {
  try {
    if (session?.getItem(RESTORED_FLAG)) {
      session?.removeItem(RESTORED_FLAG);
      toast({ status: 'success', title: t('share.backup.restored') });
    }
  } catch {
    // Session storage may be unavailable; the notice is optional.
  }
  let outcome: RestoreOutcome;
  try {
    outcome = await backend.takeRestoredUiState();
  } catch {
    return false;
  }
  if (outcome.state === 'failed') {
    toast({ status: 'error', title: t('share.backup.restoreFailed'), description: outcome.message }, 0);
    return false;
  }
  if (outcome.state !== 'restored') return false;
  try {
    if (!storage) throw new Error('browser storage is unavailable');
    applyUiState(outcome.uiState, storage);
    // The backend keeps the screen state too and its copy wins at the next start, so it takes the restored one first.
    await backend.saveUiState(collectUiState(storage));
    session?.setItem(RESTORED_FLAG, '1');
  } catch (e) {
    toast({ status: 'error', title: t('share.backup.restoreFailed'), description: e instanceof Error ? e.message : String(e) }, 0);
    return false;
  }
  reload();
  return true;
}
