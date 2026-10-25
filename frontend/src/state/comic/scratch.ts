// Pictures made only to be looked at: the page the editor views (`view_comic_page`). They are intermediate pictures, so the
// gallery does not show them, but they stay in the data folder until deleted; a run that looks at every page would leave one
// per look. The most recent few are kept for the conversation that may still name them, the rest go, and a run's end sweeps all.
import { backend } from '@/backend';

/** How many looked-at pictures stay while no run ends: enough for the page the model is still talking about. */
const KEEP = 4;

const names: string[] = [];

/** Remembers a looked-at picture, and deletes the oldest ones beyond the few kept. */
export function keepScratch(name: string): void {
  names.push(name);
  if (names.length > KEEP) void drop(names.splice(0, names.length - KEEP));
}

/** Deletes every looked-at picture (a run ended: no conversation names them any more). */
export function sweepScratch(): Promise<void> {
  return drop(names.splice(0));
}

async function drop(gone: string[]): Promise<void> {
  if (!gone.length) return;
  try {
    await backend.deleteImages(gone);
  } catch {
    // A picture that could not be deleted is only a file left behind.
  }
}
