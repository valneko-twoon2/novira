// Keeps the page's saved state (every `novira.*` key of the browser storage: settings, history, drafts, presets, the
// prompt book) in step with the backend, so the desktop app, the browser server's pages on the PC and the phones that
// open the same data folder show the same state. The stores still read and write the browser storage as they always did:
// - `adoptBackendUiState` runs first at start-up, before any store exists, and puts the backend's state into the storage;
// - after that, a change to a `novira.*` key is sent to the backend a moment later (`save_ui_state`);
// - the backend tells every page when a page saved (`ui_state_changed`); a page that is not the sender reads the state
//   and takes the keys that changed there into its storage and its running stores (`uiStateMerge.ts`, `rehydrate.ts`).
// The backend's state wins at start-up. A page that was never synced hands over what its storage has: it becomes the
// backend's state when the backend has none, and the backend keeps it aside when it has one
// (`docs/design/settings-engine.md`).
import { backend } from '@/backend';
import { canRehydrate, rehydrateKeys } from './rehydrate';
import { planRemote, sameState, type KeyText } from './uiStateMerge';
import { applyUiState, collectUiState, parseUiState, PERSIST_PREFIX } from './uiStateStorage';

/** Marks a storage that has been synced with a backend (not a `novira.*` key, so it is not part of the state). */
const SYNCED_FLAG = 'novira-ui-synced';
const SAVE_DELAY_MS = 800;
/** Another page's saves that come close together are read once. */
const PULL_DELAY_MS = 150;
/** A key this page wrote this recently is not changed from outside yet (the user may be typing into it). */
const QUIET_MS = 2000;
/** How long to wait before looking again at a key held back for that. */
const RETRY_MS = 1000;
const ORIGIN_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** An id for this page, sent with its saves so it can tell its own `ui_state_changed` events from the others'. */
function newOrigin(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return `page-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Takes the backend's saved state into `storage` and starts sending later changes. A backend that cannot be read leaves
 * the storage as it is and sends nothing this session, so a state that could not be read is never overwritten.
 */
export async function adoptBackendUiState(storage: Storage | undefined = globalThis.localStorage): Promise<void> {
  if (!storage) return;
  try {
    const synced = storage.getItem(SYNCED_FLAG) !== null;
    const state = await backend.adoptUiState(synced ? null : collectUiState(storage));
    if (state !== null) applyUiState(state, storage);
    storage.setItem(SYNCED_FLAG, '1');
  } catch (e) {
    console.error('novira: the saved screen state could not be taken from the backend', e);
    return;
  }
  stopWatching?.();
  stopWatching = watch(storage);
}

/** Ends the watch a page started before (the page starts one only; a second start replaces the first). */
let stopWatching: (() => void) | undefined;

/** Sends the state of `storage` to the backend after changes settle, and takes other pages' changes from it. */
function watch(storage: Storage): () => void {
  const origin = newOrigin();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pullTimer: ReturnType<typeof setTimeout> | undefined;
  // `theirs` is what the backend held the last time this page read or wrote it, `mine` what the storage held then.
  const start = parseUiState(collectUiState(storage)) ?? {};
  let theirs: KeyText = { ...start };
  let mine: KeyText = { ...start };
  const written = new Map<string, number>();
  let applying = false;
  let lastRevision = 0;
  let work: Promise<void> = Promise.resolve();

  const local = () => parseUiState(collectUiState(storage)) ?? {};

  /** Reads the backend's state and takes what changed there into the storage and the running stores. */
  const pull = async (): Promise<void> => {
    const text = await backend.adoptUiState(null);
    const remote = text === null ? null : parseUiState(text);
    if (remote === null) return;
    const now = Date.now();
    const plan = planRemote({
      theirs,
      mine,
      local: local(),
      remote,
      canApply: canRehydrate,
      recentlyWritten: (key) => now - (written.get(key) ?? -Infinity) < QUIET_MS,
    });
    if (plan.apply.size > 0) {
      // The stores write their own text back while they read; none of that is a change of this page's.
      applying = true;
      try {
        for (const [key, value] of plan.apply) {
          if (value === null) storage.removeItem(key);
          else storage.setItem(key, value);
        }
        rehydrateKeys([...plan.apply.keys()]);
      } finally {
        applying = false;
      }
    }
    const after = local();
    theirs = { ...theirs };
    mine = { ...mine };
    for (const key of [...plan.apply.keys(), ...plan.same]) {
      if (remote[key] === undefined) delete theirs[key];
      else theirs[key] = remote[key];
      if (after[key] === undefined) delete mine[key];
      else mine[key] = after[key];
    }
    if (plan.later.length > 0) schedulePull(RETRY_MS);
  };

  /** Pulls one at a time; a failure is logged and the next pull tries again. */
  const queuePull = (): Promise<void> => {
    work = work.then(pull).catch((e: unknown) => console.error('novira: the screen state of another page could not be read', e));
    return work;
  };
  const schedulePull = (delay: number) => {
    if (pullTimer !== undefined) clearTimeout(pullTimer);
    pullTimer = setTimeout(() => {
      pullTimer = undefined;
      void queuePull();
    }, delay);
  };

  /** Writes the state to the backend. `read` first takes in what other pages saved meanwhile, so it is not overwritten. */
  const send = async (read: boolean) => {
    timer = undefined;
    if (sameState(local(), mine)) return;
    if (read) await queuePull();
    const state = collectUiState(storage);
    const sent = parseUiState(state) ?? {};
    if (sameState(sent, mine)) return;
    try {
      await backend.saveUiState(state, origin);
      theirs = { ...sent };
      mine = { ...sent };
    } catch (e) {
      // `mine` stays as it was, so the next change sends again.
      console.error('novira: the screen state could not be saved to the backend', e);
    }
  };
  const changed = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => void send(true), SAVE_DELAY_MS);
  };
  const wrote = (key: string) => {
    if (applying) return;
    written.set(key, Date.now());
    changed();
  };

  // `Storage.prototype` holds the methods; a method set on the object would become a stored key.
  const proto = Object.getPrototypeOf(storage) as Storage;
  const { setItem, removeItem, clear } = proto;
  proto.setItem = function (this: Storage, key: string, value: string) {
    setItem.call(this, key, value);
    if (this === storage && key.startsWith(PERSIST_PREFIX)) wrote(key);
  };
  proto.removeItem = function (this: Storage, key: string) {
    removeItem.call(this, key);
    if (this === storage && key.startsWith(PERSIST_PREFIX)) wrote(key);
  };
  proto.clear = function (this: Storage) {
    clear.call(this);
    if (this === storage && !applying) changed();
  };

  // Another page saved: read its state. The page's own saves come back as events too, and are not news.
  const unsubscribe = backend.subscribe((event) => {
    if (event.type === 'queue_cleared') {
      // The event socket was reopened (or the queue was cleared): saves may have been missed meanwhile.
      schedulePull(PULL_DELAY_MS);
      return;
    }
    if (event.type !== 'ui_state_changed') return;
    // The event comes over the wire: its two fields are checked, not trusted.
    const { origin: from, revision } = event as { origin: unknown; revision: unknown };
    if (typeof from !== 'string' || (from !== '' && !ORIGIN_PATTERN.test(from))) return;
    if (typeof revision !== 'number' || !Number.isFinite(revision)) return;
    if (from === origin || revision <= lastRevision) return;
    lastRevision = revision;
    schedulePull(PULL_DELAY_MS);
  });

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      // The page is going away: nothing can be waited for, so the state goes out as it is.
      if (timer !== undefined) clearTimeout(timer);
      void send(false);
    } else {
      // Back on screen: events were not heard while it slept.
      schedulePull(PULL_DELAY_MS);
    }
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);

  return () => {
    unsubscribe();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
    clearTimeout(timer);
    clearTimeout(pullTimer);
    proto.setItem = setItem;
    proto.removeItem = removeItem;
    proto.clear = clear;
  };
}
