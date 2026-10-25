// "Invoke": turns the active tab's state into a queue batch. Tabs register a builder.
import { useEffect, useState } from 'react';
import { backend, type EnqueueRequest, type QueueItem } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from './gallery';
import { toast } from './toasts';
import { showViewer, useUi, type MediaKind, type TabName } from './ui';

export interface InvokeBuilder {
  /** Human readable reasons why invoking is not possible right now (empty = ready). */
  readiness: () => string[];
  /** Hints shown next to Invoke that do not block it (for example a size the model may not draw well). */
  warnings?: () => string[];
  /** Build the batch. May be async (e.g. canvas compositing). */
  build: (opts: { prepend: boolean }) => Promise<EnqueueRequest>;
  /** Store subscriptions that affect readiness (re-evaluated on change). */
  subscribe?: (onChange: () => void) => () => void;
  /** Called with the queue items the last build made, so the screen can keep track of them. */
  onEnqueued?: (items: QueueItem[]) => void;
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
export async function enqueueActive(opts: { prepend?: boolean } = {}): Promise<InvokeOutcome> {
  const key = activeBuilderKey();
  const tab = useUi.getState().activeTab;
  const b = builders.get(key);
  if (!b) return { problems: [t('app.invoke.notAvailableOnTab')] };
  const reasons = b.readiness();
  if (reasons.length) return { problems: reasons };
  try {
    const request = await b.build({ prepend: opts.prepend ?? false });
    const items = await backend.enqueue(request);
    b.onEnqueued?.(items);
    // Like InvokeAI, leave the launchpad so the progress preview is visible.
    if (key === tab && request.destination === 'gallery' && useUi.getState().mainView[tab] === 'launchpad') showViewer(tab);
    return { items };
  } catch (err) {
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
