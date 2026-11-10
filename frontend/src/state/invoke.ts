// "Invoke": turns the active tab's state into a queue batch. Tabs register a builder.
import { useEffect, useState } from 'react';
import { backend, type EnqueueRequest, type QueueItem } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from './gallery';
import { useQueue } from './queue';
import { toast } from './toasts';
import { showViewer, useUi, type MediaKind, type TabName } from './ui';

export interface InvokeBuilder {
  /** Human readable reasons why invoking is not possible right now (empty = ready). */
  readiness: () => string[];
  /** Hints shown next to Invoke that do not block it (for example a size the model may not draw well). */
  warnings?: () => string[];
  /**
   * Build the batch. May be async (e.g. canvas compositing). `held`: the pictures are to wait in the Candidates view (the
   * `candidates` destination); only the image form's builder takes it, and it then registers them in `onEnqueued`.
   */
  build: (opts: { prepend: boolean; held?: boolean }) => Promise<EnqueueRequest>;
  /** Store subscriptions that affect readiness (re-evaluated on change). */
  subscribe?: (onChange: () => void) => () => void;
  /** Called with the queue items a build made and the request it built, so the screen can keep track of them. */
  onEnqueued?: (items: QueueItem[], built: EnqueueRequest) => void;
  /** Called when the backend refused what a build made, so the screen can let go of what the build prepared. */
  onEnqueueFailed?: (built: EnqueueRequest) => void;
  /** False when the build makes one picture whatever the iterations box says, so the box is not shown for this screen. */
  countsPictures?: boolean;
  /** False when the screen draws with its own buttons, so the Invoke button is not shown there (the Invoke shortcut still works). */
  showsInvokeButton?: boolean;
}

/** A tab, or one of the Generate tab's media panels other than the image form (which is the `generate` tab's). */
export type BuilderKey = TabName | Exclude<MediaKind, 'image'>;

const builders = new Map<BuilderKey, InvokeBuilder>();
const changeListeners = new Set<() => void>();

export function registerInvokeBuilder(tab: BuilderKey, builder: InvokeBuilder) {
  builders.set(tab, builder);
  changeListeners.forEach((l) => l());
}

/** Whether a screen has registered how to build its request. */
export function hasInvokeBuilder(key: BuilderKey): boolean {
  return builders.has(key);
}

/** Builds the batch the tab would enqueue, without enqueueing it. Null when the tab has no builder. */
export function buildRequestFor(tab: TabName, opts: { prepend?: boolean } = {}): Promise<EnqueueRequest> | null {
  return builders.get(tab)?.build({ prepend: opts.prepend ?? false }) ?? null;
}

/** The builder that Invoke uses now: the media panel's while the Generate tab shows one other than the image form. */
function activeBuilderKey(): BuilderKey {
  const { activeTab, media } = useUi.getState();
  return activeTab === 'generate' && media !== 'image' ? media : activeTab;
}

function readinessFor(tab: BuilderKey): string[] {
  const b = builders.get(tab);
  if (!b) return [t('app.invoke.notAvailableOnTab')];
  return b.readiness();
}

/** Why a screen cannot be invoked right now (empty = ready), whichever screen is open. */
export function readinessOf(tab: BuilderKey): string[] {
  return readinessFor(tab);
}

/** Whether the iterations box applies to a screen's Invoke (every screen does unless its builder says otherwise). */
export function countsPicturesOf(tab: BuilderKey): boolean {
  return builders.get(tab)?.countsPictures !== false;
}

/** Whether the Invoke button is shown for a screen (every screen shows it unless its builder says otherwise). */
export function showsInvokeButtonOf(tab: BuilderKey): boolean {
  return builders.get(tab)?.showsInvokeButton !== false;
}

/** What one press of Invoke came to: the queued items, the reasons it could not run, or the error of the enqueue. */
export type InvokeOutcome = { items: QueueItem[] } | { problems: string[] } | { error: string };

/** Does what Invoke does on the screen that is open, without the notices (the assistant reports the outcome itself). */
export async function enqueueActive(opts: { prepend?: boolean; pictures?: number } = {}): Promise<InvokeOutcome> {
  const key = activeBuilderKey();
  const tab = useUi.getState().activeTab;
  const b = builders.get(key);
  if (!b) return { problems: [t('app.invoke.notAvailableOnTab')] };
  const reasons = b.readiness();
  if (reasons.length) return { problems: reasons };
  let made: EnqueueRequest | null = null;
  try {
    // The image form's pictures wait in the Candidates view unless the setting sends them straight to a board.
    const held = key === 'generate' && useGallery.getState().settings.newPicturesToCandidates;
    const built = await b.build({ prepend: opts.prepend ?? false, held });
    made = built;
    // A set number of pictures (the assistant's trial picture) replaces the iterations box.
    const request = opts.pictures === undefined ? built : { ...built, iterations: opts.pictures };
    const items = await backend.enqueue(request);
    b.onEnqueued?.(items, built);
    // Like InvokeAI, leave the launchpad so the progress preview is visible.
    if (key === tab && useUi.getState().mainView[tab] === 'launchpad') {
      if (request.destination === 'gallery') showViewer(tab);
      // Where the pictures will be, so the start screen is left for them.
      else if (request.destination === 'candidates') useUi.getState().setMainView(tab, 'drafts');
    }
    return { items };
  } catch (err) {
    if (made) b.onEnqueueFailed?.(made);
    return { error: String(err instanceof Error ? err.message : err) };
  }
}

export async function invoke(opts: { prepend?: boolean } = {}) {
  if (!builders.get(activeBuilderKey())) return;
  const outcome = await enqueueActive(opts);
  if ('problems' in outcome) toast({ status: 'warning', title: t('app.invoke.notReady'), description: outcome.problems.join('\n') });
  else if ('error' in outcome) toast({ status: 'error', title: t('app.invoke.failed'), description: outcome.error });
  else toast({ status: 'success', title: t('app.invoke.enqueued', { count: outcome.items.length }) });
}

/** Board new images go to, as a backend board id. */
export function autoAddBoardId(): string | null {
  const id = useGallery.getState().autoAddBoardId;
  return id === 'none' ? null : id;
}

/**
 * Board a generation goes to. While earlier pictures of the gallery are still waiting or drawing, a run of Invokes keeps
 * the board the first of them chose, even if another board is picked meanwhile; a board that is gone, or nothing queued,
 * falls back to the auto-add board (`autoAddBoardId`).
 */
export function generationBoardId(): string | null {
  const first = useQueue.getState().items.find((i) => (i.status === 'pending' || i.status === 'in_progress') && (i.destination === 'gallery' || i.destination === 'candidates'));
  if (first && (first.boardId === null || useGallery.getState().boards.some((b) => b.id === first.boardId))) return first.boardId;
  return autoAddBoardId();
}

/** Re-renders when any registered builder's inputs change. */
export function useReadiness(tab: BuilderKey): string[] {
  return useBuilderList(tab, 'readiness');
}

/** The builder's non-blocking hints, kept up to date like `useReadiness`. */
export function useInvokeWarnings(tab: BuilderKey): string[] {
  return useBuilderList(tab, 'warnings');
}

function readList(tab: BuilderKey, what: 'readiness' | 'warnings'): string[] {
  return what === 'readiness' ? readinessFor(tab) : (builders.get(tab)?.warnings?.() ?? []);
}

function useBuilderList(tab: BuilderKey, what: 'readiness' | 'warnings'): string[] {
  const [reasons, setReasons] = useState<string[]>(() => readList(tab, what));
  useEffect(() => {
    const update = () => setReasons(readList(tab, what));
    update();
    changeListeners.add(update);
    const unsub = builders.get(tab)?.subscribe?.(update);
    return () => {
      changeListeners.delete(update);
      unsub?.();
    };
  }, [tab, what]);
  return reasons;
}
