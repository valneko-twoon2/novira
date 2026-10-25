// The saved state of the page seen as browser storage: every key under PERSIST_PREFIX (settings, history, drafts,
// presets, the prompt book, ...) read as one JSON object and put back. It imports no store, so start-up can use it before
// any store exists (`uiStateSync.ts`).

/** The prefix of every key the app's persisted stores write. */
export const PERSIST_PREFIX = 'novira.';
/** The saved state as one JSON object of key to stored text. */
export function collectUiState(storage: Storage): string {
  const out: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(PERSIST_PREFIX)) continue;
    const value = storage.getItem(key);
    if (value !== null) out[key] = value;
  }
  return JSON.stringify(out);
}

/** Every key of the saved state that the storage holds now. */
export function persistedKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(PERSIST_PREFIX)) keys.push(key);
  }
  return keys;
}

/**
 * Replaces the saved state with `json` (from `collectUiState`): every current key goes, then the restored ones are
 * written. Keys outside the prefix and values that are not text are ignored. Returns how many keys were written.
 * Throws, changing nothing, when `json` is not an object.
 */
export function applyUiState(json: string, storage: Storage): number {
  const parsed: unknown = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('the saved screen state is not an object');
  const entries = Object.entries(parsed as Record<string, unknown>).filter(
    (e): e is [string, string] => e[0].startsWith(PERSIST_PREFIX) && typeof e[1] === 'string',
  );
  for (const key of persistedKeys(storage)) storage.removeItem(key);
  for (const [key, value] of entries) storage.setItem(key, value);
  return entries.length;
}

/** The backend refuses a state larger than this (`MAX_UI_STATE_BYTES`), so a page reads no more either. */
export const MAX_UI_STATE_CHARS = 32 * 1024 * 1024;
/** The longest key the backend takes. */
const MAX_KEY_CHARS = 200;

/**
 * The state of `json` as key to text, or `null` when it is not what the backend stores: an object of `novira.*` keys
 * (at most 200 characters) with text values, at most 32 Mi characters. For text from outside the page.
 */
export function parseUiState(json: string): Record<string, string> | null {
  if (json.length > MAX_UI_STATE_CHARS) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!key.startsWith(PERSIST_PREFIX) || key.length > MAX_KEY_CHARS || typeof value !== 'string') return null;
    out[key] = value;
  }
  return out;
}
