// Which saved `novira.*` keys follow another page live. A page that opens the same data folder (the PC and a phone, or
// two phones) sends its state to the backend as it changes, and every other page takes the keys listed here into its
// running stores (`uiStateSync.ts`). A store in this list must update on screen when its key changes under it.
//
// The keys of `LOCAL_ONLY_KEYS` stay per page: they still travel with the saved state (the next start of a page takes
// the backend's), but a running page never has them changed from outside, because they hold what one screen is doing
// (the language, theme and zoom, the thumbnail size, the assistant chat and its window, the document under edit).
import { useCharacters } from './characters';
import { useDrafts } from './drafts';
import { useMangaFinish } from './mangaFinish';
import { useLogo } from './media/logo';
import { useMusic } from './media/music';
import { useVideo } from './media/video';
import { useVoice } from './media/voice';
import { useParams } from './params';
import { useImagePresets } from './presets/imagePresets';
import { useLogoPresets } from './presets/logoPresets';
import { useMusicPresets } from './presets/musicPresets';
import { useTextStylePresets } from './presets/textStylePresets';
import { useVideoPresets } from './presets/videoPresets';
import { useVoicePresets } from './presets/voicePresets';
import { usePromptBook } from './prompts/promptBook';
import { useWildcards } from './prompts/wildcards';
import { registerRehydrate } from './rehydrate';

/** The part of a zustand store with the `persist` middleware that this file uses. */
interface Persisted {
  persist: { getOptions: () => { name?: string }; rehydrate: () => Promise<void> | void };
}

/** Keys that stay per page. Every other `novira.*` key a store writes must be in `LIVE_STORES`. */
export const LOCAL_ONLY_KEYS: readonly string[] = [
  'novira.settings',
  'novira.gallery',
  'novira.agent',
  'novira.canvas',
  'novira.workflows',
  'novira.text',
  'novira.extensions.railWidth',
  'novira.mock.comics',
];

const LIVE_STORES: readonly Persisted[] = [
  useParams,
  useDrafts,
  useImagePresets,
  useCharacters,
  useLogoPresets,
  useMusicPresets,
  useTextStylePresets,
  useVideoPresets,
  useVoicePresets,
  usePromptBook,
  useWildcards,
  useMangaFinish,
  useLogo,
  useMusic,
  useVideo,
  useVoice,
];

/** What the store's `persist` middleware names, or nothing when the page has no storage (then there is no `persist`). */
const nameOf = (store: Persisted): string | undefined => (store.persist as Persisted['persist'] | undefined)?.getOptions().name;

/** The saved keys that follow another page, as the stores name them. */
export function liveKeys(): string[] {
  return LIVE_STORES.map(nameOf).filter((n): n is string => typeof n === 'string');
}

for (const store of LIVE_STORES) {
  const name = nameOf(store);
  if (name) registerRehydrate(name, () => void store.persist.rehydrate());
}
