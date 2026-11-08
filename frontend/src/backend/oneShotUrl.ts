// Blob URLs made for one hand-over to the backend (a canvas flattened to be saved or to start a job). Each holds a whole PNG in
// memory until it is revoked, and the canvas makes two or three per generation, so the real backends revoke them once they have
// read them. Only the URLs made here are revoked: any other blob URL (a layer's picture, a reference image) may be used again.
// The mock keeps the URLs it is given (it draws from them later), so it never releases.

const owned = new Set<string>();
/** What each owned URL was stored as, so a request that names the same URL again (a grid of jobs from one canvas) does not read it again. */
const stored = new Map<string, Promise<string>>();
const MAX_REMEMBERED = 200;

/** A blob URL that the backend will revoke after it has read it. */
export function oneShotUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  owned.add(url);
  return url;
}

/** Revokes `url` when it was made by `oneShotUrl`; any other URL is left alone. */
export function releaseOneShotUrl(url: string): void {
  if (owned.delete(url)) URL.revokeObjectURL(url);
}

/** How many one-shot URLs are alive (for tests and the time budgets). */
export function oneShotUrlCount(): number {
  return owned.size;
}

/**
 * Stores a picture rendered in the page: `save` reads the URL (and, for a one-shot URL, releases it). The answer is remembered for a
 * one-shot URL, so naming it again gives the same stored picture instead of reading a revoked URL. A failure is forgotten.
 */
export function storeOnce(url: string, category: string, save: () => Promise<string>): Promise<string> {
  const key = `${category}|${url}`;
  if (!owned.has(url) && !stored.has(key)) return save();
  const hit = stored.get(key);
  if (hit) return hit;
  const run = save();
  stored.set(key, run);
  if (stored.size > MAX_REMEMBERED) stored.delete(stored.keys().next().value as string);
  run.catch(() => stored.delete(key));
  return run;
}

// Layer pictures -------------------------------------------------------------------------------------------------------------
// A picture that becomes a canvas layer (merged, transformed, filtered) stays alive as long as a layer, an undo step or a preview
// shows it. Each canvas reports which of its URLs are still in use; one that no canvas holds any more is revoked.

/** layer URL -> when it was made. */
const layerUrls = new Map<string, number>();
/** The layer URLs each holder (a canvas) used the last time it reported. */
const held = new Map<string, ReadonlySet<string>>();
/** A new URL is not revoked for this long: it is made first and put into a layer a moment later (the picture is loaded in between). */
export const LAYER_URL_GRACE_MS = 30_000;

/** A blob URL for a layer picture, revoked by `holdLayerUrls` once no canvas shows it. */
export function layerUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  layerUrls.set(url, Date.now());
  return url;
}

/** `owner` now uses `inUse` (every URL it can still show, undo steps included); a layer URL that no canvas uses any more is revoked. */
export function holdLayerUrls(owner: string, inUse: ReadonlySet<string>, now = Date.now()): number {
  held.set(owner, inUse);
  const all = [...held.values()];
  let revoked = 0;
  for (const [url, madeAt] of [...layerUrls]) {
    if (now - madeAt < LAYER_URL_GRACE_MS || all.some((used) => used.has(url))) continue;
    layerUrls.delete(url);
    URL.revokeObjectURL(url);
    revoked++;
  }
  return revoked;
}

/** How many layer URLs are alive (for tests and the time budgets). */
export function layerUrlCount(): number {
  return layerUrls.size;
}
