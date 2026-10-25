// The stores that can take a change of their saved `novira.*` key while the page runs. A page that learns another
// page's saved state (`uiStateSync.ts`) writes the changed keys into the browser storage and then asks the stores that
// keep those keys to read them again. This file imports no store, so start-up code can use it before any store exists;
// `liveStores.ts` is where the stores register.

const handlers = new Map<string, () => void>();

/** Says that `read` makes the store behind `key` take the storage's text for it again. */
export function registerRehydrate(key: string, read: () => void): void {
  handlers.set(key, read);
}

/** Whether a running store can take a change of `key`. A key without one is never changed from outside. */
export function canRehydrate(key: string): boolean {
  return handlers.has(key);
}

/** Asks the stores behind `keys` to read the storage again. One store failing does not stop the others. */
export function rehydrateKeys(keys: readonly string[]): void {
  for (const key of keys) {
    try {
      handlers.get(key)?.();
    } catch (e) {
      console.error(`novira: the store of ${key} could not take the other page's change`, e);
    }
  }
}
