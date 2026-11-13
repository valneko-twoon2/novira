// What the Candidates view lists in its one scrolling flow: the batches that still have something to decide, newest
// first, and the order of their pictures for a Shift click and the large view.
import type { ImageDTO } from '@/backend';
import { getLocale } from '@/i18n';
import { canFinish, useDrafts, type DraftCandidate, type DraftGroup } from '@/state/drafts';
import { dayStart } from './history';

/** How many batches the flow shows at first, and how many more each press of "show more" adds. */
export const FLOW_GROUPS = 8;

/** Whether a candidate is decided: a draft whose finished picture is in the gallery. A generation batch's pictures leave it once taken. */
export function isDecided(group: DraftGroup, c: DraftCandidate, images: ImageDTO[]): boolean {
  if (group.kind === 'generation') return false;
  return c.finalStatus === 'ready' && c.finalImageName !== null && images.some((i) => i.name === c.finalImageName);
}

/** Whether a candidate can be chosen: a generation batch's picture once drawn, a draft once its draft is drawn. */
export function isSelectable(group: DraftGroup, c: DraftCandidate, images: ImageDTO[]): boolean {
  if (group.kind === 'generation') return c.finalStatus === 'ready' && c.finalImageName !== null && images.some((i) => i.name === c.finalImageName);
  return c.status === 'ready';
}

/** Whether ✓ does something for a candidate: a held picture goes to the board, a draft not finished yet is finished. */
export function isAcceptable(group: DraftGroup, c: DraftCandidate, images: ImageDTO[]): boolean {
  if (group.kind === 'generation') return c.finalImageName !== null && images.some((i) => i.name === c.finalImageName && i.isIntermediate);
  return canFinish(c, c.finalImageName !== null && images.some((i) => i.name === c.finalImageName));
}

/** ✓ on the chosen candidates of a group: a generation batch moves its held pictures to the board, a batch of drafts finishes them. */
export function accept(group: DraftGroup, candidateIds: string[], images: ImageDTO[]): void {
  const ids = group.candidates.filter((c) => candidateIds.includes(c.id) && isAcceptable(group, c, images)).map((c) => c.id);
  if (!ids.length) return;
  const { adopt, finish } = useDrafts.getState();
  void (group.kind === 'generation' ? adopt(group.id, ids) : finish(group.id, ids));
}

/**
 * The batches of the flow, newest first: those with a candidate still to decide, and the one opened from the history
 * (`currentId`) even when everything in it is decided. `total` counts them all; `shown` is at most `limit` of them, but
 * always holds the opened one.
 */
export function flowGroups(
  groups: DraftGroup[],
  images: ImageDTO[],
  currentId: string | null,
  limit: number,
  viewingId: string | null = null,
): { shown: DraftGroup[]; total: number } {
  const open = groups.filter((g) => g.id === currentId || g.candidates.some((c) => !isDecided(g, c, images))).reverse();
  const shown = open.slice(0, limit);
  // The batch opened from the history, and the batch of the picture the large view shows (it may lie past the limit when
  // the view comes back with fewer batches listed), are always there.
  const opened = open.find((g) => g.id === currentId);
  if (opened && !shown.includes(opened)) shown.push(opened);
  const viewed = viewingId === null ? undefined : open.find((g) => g.candidates.some((c) => c.id === viewingId));
  if (viewed && !shown.includes(viewed)) shown.push(viewed);
  return { shown, total: open.length };
}

/**
 * The limit that keeps the batch of `viewingId` in the list once the large view closes: it is shown past the limit only while
 * it is viewed (`flowGroups`), so closing the view would drop it out of sight. Raised in steps of `FLOW_GROUPS`, as "Show
 * more" does; never lowered.
 */
export function limitShowing(groups: DraftGroup[], images: ImageDTO[], currentId: string | null, limit: number, viewingId: string | null): number {
  if (viewingId === null) return limit;
  const open = groups.filter((g) => g.id === currentId || g.candidates.some((c) => !isDecided(g, c, images))).reverse();
  const at = open.findIndex((g) => g.candidates.some((c) => c.id === viewingId));
  return at < limit ? limit : Math.ceil((at + 1) / FLOW_GROUPS) * FLOW_GROUPS;
}

/** The ids of every candidate in the flow, in the order shown: what a Shift click selects a range of. */
export const flowOrder = (groups: DraftGroup[]): string[] => groups.flatMap((g) => g.candidates.map((c) => c.id));

/** The ids from `anchor` to `target` in `order`, both included; just `target` when the anchor is not in the flow. */
export function rangeOf(order: string[], anchor: string | null, target: string): string[] {
  const a = anchor === null ? -1 : order.indexOf(anchor);
  const b = order.indexOf(target);
  if (a < 0 || b < 0) return [target];
  return order.slice(Math.min(a, b), Math.max(a, b) + 1);
}

/** When a batch was started: the time today, else a short date with the time. */
export function whenLabel(time: number, now = Date.now()): string {
  const today = dayStart(time) === dayStart(now);
  return new Intl.DateTimeFormat(getLocale(), today ? { hour: '2-digit', minute: '2-digit' } : { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(time);
}
