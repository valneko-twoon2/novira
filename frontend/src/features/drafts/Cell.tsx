// One candidate of the Candidates view: its picture (or what is being drawn now), its state when there is one to tell,
// and ✓ and × over the bottom of the picture on hover or focus.
import { ArrowsOut, Check, X } from '@phosphor-icons/react';
import type { KeyboardEvent, MouseEvent } from 'react';
import type { ImageDTO, ProgressEvent } from '@/backend';
import { t } from '@/i18n';
import { draftStepOf, useDrafts, type DraftCandidate, type DraftGroup } from '@/state/drafts';
import { setDragImages } from '@/state/dnd';
import { useQueue } from '@/state/queue';
import { useSettings } from '@/state/settings';
import { cx, IconButton, Spinner } from '@/ui';
import { accept, isAcceptable } from './flow';
import { pictureOf } from './pictures';

/** The queue item drawing a candidate right now, if any: its finished picture, or its draft. */
export const liveItemOf = (c: DraftCandidate) => (c.finalStatus === 'running' ? c.finalItemId : c.status === 'running' ? c.itemId : null);

/** The progress of the job drawing this candidate now, or null. */
export function useLive(c: DraftCandidate): ProgressEvent | null {
  const id = liveItemOf(c);
  return useQueue((s) => (id !== null && s.progress?.itemId === id ? s.progress : null));
}

/**
 * The state shown on a candidate, or null when there is nothing to tell: a generation batch's drawn picture and a drawn
 * draft are the normal case and carry no word (the draft's position is in the cell's tooltip).
 */
export function badgeOf(group: DraftGroup, c: DraftCandidate, finished: boolean): string | null {
  const generation = group.kind === 'generation';
  if (c.status === 'failed' || c.finalStatus === 'failed') return t('drafts.badge.failed');
  if (finished) return generation ? null : t('drafts.badge.finished');
  if (generation) return t(c.finalStatus === 'running' ? 'drafts.badge.generating' : 'drafts.badge.queued');
  if (c.finalStatus) return t('drafts.badge.finishing');
  if (c.status === 'queued') return t('drafts.badge.queued');
  if (c.status === 'running') return t('drafts.badge.drawing');
  return null;
}

export function draftLabel(group: DraftGroup): string {
  return t('drafts.badge.draft', { percent: Math.round(group.position * 100), steps: group.params.steps, step: draftStepOf(group) });
}

/** The state chip: the word, with the step while it is drawn, and the error as its tooltip. */
export function Badge({ group, c, finished, live }: { group: DraftGroup; c: DraftCandidate; finished: boolean; live: ProgressEvent | null }) {
  const word = badgeOf(group, c, finished);
  if (!word) return null;
  return (
    <span className="dv-badge" title={c.error ?? undefined}>
      {live && !finished ? `${word} ${live.step}/${live.totalSteps}` : word}
    </span>
  );
}

export function Cell({
  group,
  c,
  images,
  selected,
  selectable,
  onPick,
  onToggle,
  onLarge,
  onOpen,
}: {
  group: DraftGroup;
  c: DraftCandidate;
  images: ImageDTO[];
  selected: boolean;
  selectable: boolean;
  /** A click: `e` tells Ctrl and Shift. */
  onPick: (e: MouseEvent) => void;
  /** Space: adds or removes this one. */
  onToggle: () => void;
  /** Enter or a double click: the large view. */
  onLarge: () => void;
  /** The phone layout's own large view; with it each picture also gets a button for it. */
  onOpen: ((imageName: string) => void) | undefined;
}) {
  const { image, finished } = pictureOf(c, images);
  const generation = group.kind === 'generation';
  const live = useLive(c);
  const antialias = useSettings((s) => s.antialiasProgressImages);
  const busy = useDrafts((s) => s.busy);
  const working = c.status === 'queued' || c.status === 'running' || c.finalStatus === 'queued' || c.finalStatus === 'running';
  const failed = c.status === 'failed' || c.finalStatus === 'failed';
  const acceptable = isAcceptable(group, c, images);
  const openLarge = () => {
    if (!image) return;
    if (onOpen) onOpen(image.name);
    else onLarge();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault();
      if (selectable) onToggle();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openLarge();
    }
  };
  return (
    <div className={cx('dv-cell', selected && 'is-selected', failed && 'is-failed')} data-testid="draft-cell">
      <div
        className="dv-img"
        style={{ aspectRatio: `${group.params.width} / ${group.params.height}` }}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`seed ${c.seed}`}
        title={generation ? `seed ${c.seed}` : `seed ${c.seed} · ${draftLabel(group)}`}
        onClick={(e) => selectable && onPick(e)}
        onKeyDown={onKeyDown}
        onDoubleClick={openLarge}
        // A held picture can be dragged onto a board in the gallery, like a picture of the gallery.
        draggable={generation && !!image}
        onDragStart={(e) => image && setDragImages(e, [image.name])}
      >
        {live?.progressImageUrl ? (
          // What is being drawn now wins over the draft it finishes: the step shows how far it has come.
          <img src={live.progressImageUrl} alt="" draggable={false} style={antialias ? undefined : { imageRendering: 'pixelated' }} />
        ) : image ? (
          <img src={image.thumbnailUrl || image.url} alt="" draggable={false} />
        ) : failed ? null : (
          <Spinner size={18} />
        )}
        {image && working && (
          <span className="dv-busy">
            <Spinner size={12} />
          </span>
        )}
        {selected && (
          <span className="dv-check">
            <Check size={12} weight="bold" />
          </span>
        )}
        <Badge group={group} c={c} finished={finished} live={live} />
      </div>
      <div className="dv-actions">
        {onOpen && image && <IconButton size="xs" variant="solid" label={t('drafts.open')} icon={<ArrowsOut />} onClick={openLarge} data-testid="draft-open" />}
        <span className="dv-spacer" />
        {acceptable && (
          <IconButton
            size="xs"
            variant="solid"
            scheme="invoke"
            label={t(generation ? 'drafts.accept.generation' : 'drafts.accept.draft')}
            icon={<Check weight="bold" />}
            disabled={busy}
            onClick={() => accept(group, [c.id], images)}
            data-testid="draft-accept"
          />
        )}
        <IconButton size="xs" variant="solid" label={t('drafts.discard')} icon={<X weight="bold" />} onClick={() => useDrafts.getState().discard(group.id, [c.id])} data-testid="draft-discard" />
      </div>
    </div>
  );
}
