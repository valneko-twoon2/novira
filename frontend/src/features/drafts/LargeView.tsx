// The large view of the Candidates view: one picture at a time, ← → through the flow, ✓ (Enter) and × (Delete) and on to
// the next, Esc back to the list, and a strip of the pictures at the bottom. Its keys work only while it has the focus.
import { ArrowLeft, CaretLeft, CaretRight, Check, X } from '@phosphor-icons/react';
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { t } from '@/i18n';
import { useDrafts, type DraftCandidate, type DraftGroup } from '@/state/drafts';
import { useGallery } from '@/state/gallery';
import { cx, IconButton, Kbd } from '@/ui';
import { ZoomableImage } from '@/ui/zoom/ZoomableImage';
import { Badge, useLive } from './Cell';
import { accept, isAcceptable } from './flow';
import { pictureOf } from './pictures';

interface Entry {
  group: DraftGroup;
  c: DraftCandidate;
}

const hint = (label: string, key: string): ReactNode => (
  <>
    {label} <Kbd>{key}</Kbd>
  </>
);

export function LargeView({ groups, id, onMove, onClose }: { groups: DraftGroup[]; id: string; onMove: (id: string) => void; onClose: () => void }) {
  const images = useGallery((s) => s.images);
  const busy = useDrafts((s) => s.busy);
  // Only candidates with a picture to look at.
  const entries: Entry[] = groups.flatMap((group) => group.candidates.filter((c) => pictureOf(c, images).image).map((c) => ({ group, c })));
  const found = entries.findIndex((e) => e.c.id === id);
  // A picture that left (taken to a board by a drag, thrown away elsewhere) gives way to the one now at its place.
  const last = useRef(0);
  const index = found >= 0 ? found : Math.min(last.current, entries.length - 1);
  if (index >= 0) last.current = index;
  const entry = entries[index];
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!entry) onClose();
    else if (entry.c.id !== id) onMove(entry.c.id);
  }, [entry, id, onMove, onClose]);
  useEffect(() => root.current?.focus(), []);
  // A focused button that went away (a strip picture thrown away) or turned off (next at the end) drops the focus to the page
  // body, where the keys no longer reach the view: take it back then, but never from something else the person focused.
  useEffect(() => {
    const active = document.activeElement;
    if (root.current && (active === null || active === document.body)) root.current.focus();
  });

  if (!entry) return null;
  const { group, c } = entry;
  const acceptable = isAcceptable(group, c, images);
  const go = (step: number) => {
    const next = entries[index + step];
    if (next) onMove(next.c.id);
  };
  // After ✓ or × the next picture shows; at the end, the one before. A finished draft stays in the flow, so it is passed by.
  const advance = (leaves: boolean) => {
    const next = entries[index + 1] ?? (leaves ? entries[index - 1] : undefined);
    if (next) onMove(next.c.id);
    else if (leaves) onClose();
  };
  const onAccept = () => {
    if (!acceptable || busy) return;
    accept(group, [c.id], images);
    advance(group.kind === 'generation');
  };
  const onDiscard = () => {
    useDrafts.getState().discard(group.id, [c.id]);
    advance(true);
  };
  const keys: Record<string, () => void> = {
    ArrowLeft: () => go(-1),
    ArrowRight: () => go(1),
    Enter: onAccept,
    Delete: onDiscard,
    Backspace: onDiscard,
    Escape: onClose,
  };
  const onKeyDown = (e: KeyboardEvent) => {
    // Enter on a focused button inside stays that button's.
    if (e.target !== e.currentTarget && e.key === 'Enter') return;
    const run = keys[e.key];
    if (!run) return;
    e.preventDefault();
    e.stopPropagation();
    run();
  };

  return (
    <div className="dv-large" ref={root} tabIndex={-1} onKeyDown={onKeyDown} data-testid="drafts-large">
      <div className="dv-large__bar">
        <IconButton label={t('drafts.view.back')} tooltip={hint(t('drafts.view.back'), 'Esc')} icon={<ArrowLeft />} onClick={onClose} data-testid="drafts-large-back" />
        <span className="dv-spacer" />
        <IconButton
          label={t(group.kind === 'generation' ? 'drafts.accept.generation' : 'drafts.accept.draft')}
          tooltip={hint(t(group.kind === 'generation' ? 'drafts.accept.generation' : 'drafts.accept.draft'), 'Enter')}
          icon={<Check weight="bold" />}
          variant="solid"
          scheme="invoke"
          disabled={!acceptable || busy}
          onClick={onAccept}
          data-testid="drafts-large-accept"
        />
        <IconButton label={t('drafts.discard')} tooltip={hint(t('drafts.discard'), 'Delete')} icon={<X weight="bold" />} variant="outline" onClick={onDiscard} data-testid="drafts-large-discard" />
      </div>
      <div className="dv-large__stage">
        <IconButton label={t('gallery.viewer.prev')} tooltip={hint(t('gallery.viewer.prev'), '←')} icon={<CaretLeft />} disabled={index === 0} onClick={() => go(-1)} data-testid="drafts-large-prev" />
        <Picture entry={entry} />
        <IconButton label={t('gallery.viewer.next')} tooltip={hint(t('gallery.viewer.next'), '→')} icon={<CaretRight />} disabled={index >= entries.length - 1} onClick={() => go(1)} data-testid="drafts-large-next" />
      </div>
      <div className="dv-strip">
        {entries.map((e) => {
          const image = pictureOf(e.c, images).image!;
          return (
            <button
              key={e.c.id}
              type="button"
              className={cx('dv-strip__thumb', e.c.id === c.id && 'is-current')}
              aria-current={e.c.id === c.id}
              aria-label={`seed ${e.c.seed}`}
              onClick={() => onMove(e.c.id)}
              data-testid="drafts-strip-thumb"
            >
              <img src={image.thumbnailUrl || image.url} alt="" draggable={false} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Picture({ entry: { group, c } }: { entry: Entry }) {
  const images = useGallery((s) => s.images);
  const { image, finished } = pictureOf(c, images);
  const live = useLive(c);
  const progress = live?.progressImageUrl;
  // A drawn picture zooms and pans like the viewer's (wheel, the controls, the zoom keys), fitted again for the next one;
  // a picture still being drawn shows its progress as it is.
  return (
    <div className="dv-large__picture">
      {progress ? (
        <img src={progress} alt="" draggable={false} data-testid="drafts-large-image" />
      ) : (
        image && (
          <div className="dv-large__zoom" data-testid="drafts-large-image" data-name={image.name}>
            <ZoomableImage image={image} />
          </div>
        )
      )}
      <Badge group={group} c={c} finished={finished} live={live} />
    </div>
  );
}
