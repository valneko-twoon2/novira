// What a page does with another page's saved state, decided key by key and without touching any storage (the live
// sync in `uiStateSync.ts` carries it out). Three views of every key are compared:
// - `theirs`: the backend's text the last time this page read or wrote it;
// - `mine`: this page's storage text at that time;
// - `local` and `remote`: this page's storage text now, and the backend's text now.
// A key follows the backend when the backend changed it since (`remote` is not `theirs`) and this page did not change
// it since (`local` is `mine`). A key this page changed wins: it is sent next, and the last writer of a key wins.

export type KeyText = Record<string, string>;

export interface RemotePlan {
  /** The keys to write into the storage and rehydrate: the new text, or `null` when the backend dropped the key. */
  apply: Map<string, string | null>;
  /** The keys that changed in the backend but were being typed into here a moment ago: tried again soon. */
  later: string[];
  /** The keys where this page already holds the backend's text: only the record of what is in step moves. */
  same: string[];
}

export interface PlanInput {
  theirs: KeyText;
  mine: KeyText;
  local: KeyText;
  remote: KeyText;
  /** Whether a running store can take a change of the key (`rehydrate.ts`). */
  canApply: (key: string) => boolean;
  /** Whether this page wrote the key a moment ago. */
  recentlyWritten: (key: string) => boolean;
}

export function planRemote({ theirs, mine, local, remote, canApply, recentlyWritten }: PlanInput): RemotePlan {
  const plan: RemotePlan = { apply: new Map(), later: [], same: [] };
  const keys = new Set([...Object.keys(theirs), ...Object.keys(remote)]);
  for (const key of keys) {
    const r = remote[key];
    if (r === theirs[key]) continue;
    if (local[key] === r) {
      plan.same.push(key);
      continue;
    }
    if (!canApply(key) || local[key] !== mine[key]) continue;
    if (recentlyWritten(key)) plan.later.push(key);
    else plan.apply.set(key, r ?? null);
  }
  return plan;
}

/** Whether two states hold the same keys with the same texts. */
export function sameState(a: KeyText, b: KeyText): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}
