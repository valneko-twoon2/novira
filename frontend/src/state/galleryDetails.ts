// What a picture's `metadata` and `workflow` cost: most of what the gallery weighs (9 MB of the 12.6 MB of a library of 9000
// pictures), and the grid never shows them. The backend sends the gallery as summaries (`bootstrap` with `imagesSummary`);
// this module reads the rest, per picture, when something needs it: a picture selected, opened in the viewer or compared,
// the video and audio screens (a few pictures that read their settings), and a search (which reads the prompts).
// A summary has `metadata: null` and `workflow: null`, which every screen already handles (an uploaded picture has none), so
// a picture whose details have not arrived yet shows as having none for a moment instead of failing.
import { backend, type ImageDTO } from '@/backend';
import { useGallery } from './gallery';

/** Names of the pictures the gallery holds only as a summary. */
const summaries = new Set<string>();
/** Names being read, so a picture asked for twice is read once. */
const reading = new Map<string, Promise<void>>();

/** The most names one `getImageDetails` call takes (the backend refuses more). */
export const DETAILS_CHUNK = 500;

/** Marks `images` (the answer of a `bootstrap` with `imagesSummary`) as summaries; a picture that is no longer there is forgotten. */
export function markSummaries(images: readonly ImageDTO[]): void {
  summaries.clear();
  for (const image of images) summaries.add(image.name);
}

/** How many pictures have not had their details read yet. */
export function summaryCount(): number {
  return summaries.size;
}

/**
 * The backend's gallery as it is now, from a `bootstrap` that answered with summaries, put over what this page holds: a picture
 * whose details this page already has keeps them (the answer has none), the others stay summaries.
 */
export function mergeSummaries(incoming: readonly ImageDTO[], held: readonly ImageDTO[]): ImageDTO[] {
  const have = new Map(held.map((i) => [i.name, i]));
  return incoming.map((image) => {
    const before = have.get(image.name);
    if (before && !summaries.has(before.name)) return { ...image, metadata: before.metadata, workflow: before.workflow };
    summaries.add(image.name);
    return image;
  });
}

/** Puts the read details into the gallery without touching the other fields (a star or a board may have changed meanwhile). */
function applyDetails(details: readonly ImageDTO[]): void {
  const byName = new Map(details.map((i) => [i.name, i]));
  useGallery.setState((s) => ({
    images: s.images.map((i) => {
      const full = byName.get(i.name);
      return full ? { ...i, metadata: full.metadata, workflow: full.workflow } : i;
    }),
  }));
}

/** Reads the details of the named pictures that are still summaries. Resolves when they are in the gallery; a failure is logged. */
export async function ensureDetails(names: Iterable<string>): Promise<void> {
  const wait: Promise<void>[] = [];
  const need: string[] = [];
  for (const name of new Set(names)) {
    if (!summaries.has(name)) continue;
    const running = reading.get(name);
    if (running) wait.push(running);
    else need.push(name);
  }
  for (let from = 0; from < need.length; from += DETAILS_CHUNK) {
    const chunk = need.slice(from, from + DETAILS_CHUNK);
    const job = (async () => {
      try {
        const details = await backend.getImageDetails(chunk);
        applyDetails(details);
        // A name the backend no longer holds has nothing more to read.
        for (const name of chunk) summaries.delete(name);
      } catch (e) {
        console.error('novira: the details of pictures could not be read', e);
      } finally {
        for (const name of chunk) reading.delete(name);
      }
    })();
    for (const name of chunk) reading.set(name, job);
    wait.push(job);
  }
  await Promise.all(wait);
}

/** Reads the details of every picture that is still a summary, one chunk after the other so the first results show at once. */
export async function ensureAllDetails(): Promise<void> {
  const all = [...summaries];
  for (let from = 0; from < all.length; from += DETAILS_CHUNK) await ensureDetails(all.slice(from, from + DETAILS_CHUNK));
}

/**
 * Starts reading details as the screens need them: the selected, viewed and compared pictures, the video and audio
 * pictures (their screens read the settings), and everything once a search is typed (it looks in the prompts).
 * Returns how to stop.
 */
export function watchGalleryDetails(): () => void {
  stopWatching?.();
  const wanted = (s = useGallery.getState()): string[] => [...s.selection, s.viewerImageName, s.compareImageName].filter((n): n is string => !!n);
  const media = () => useGallery.getState().images.filter((i) => i.mediaType === 'video' || i.mediaType === 'audio').map((i) => i.name);
  void ensureDetails(media());
  void ensureDetails(wanted());
  const unsubscribe = useGallery.subscribe((s, before) => {
    if (s.images !== before.images && summaries.size > 0) void ensureDetails(media());
    if (s.selection !== before.selection || s.viewerImageName !== before.viewerImageName || s.compareImageName !== before.compareImageName) void ensureDetails(wanted(s));
    if (s.search.trim() !== '' && s.search !== before.search) void ensureAllDetails();
  });
  stopWatching = () => {
    unsubscribe();
    stopWatching = undefined;
  };
  return stopWatching;
}

let stopWatching: (() => void) | undefined;
