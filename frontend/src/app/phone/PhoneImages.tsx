// The Images tab of the phone layout: the board to look at, and its pictures three to a row, the jobs being drawn for it
// first. Pressing a picture opens it full screen. Pictures are added a page at a time as the list is scrolled down, so a
// board of thousands does not build thousands of cells at once.
import { ImageBroken, Star } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import type { QueueItem } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useGeneratingItems } from '@/state/generating';
import { useQueue } from '@/state/queue';
import { EmptyState, Select, Spinner } from '@/ui';
import { usePhone, usePhoneImages } from './phoneStore';

/** Pictures added each time the end of the list comes into sight. */
export const PAGE = 60;

export function PhoneImages() {
  const list = usePhoneImages();
  const boardId = useGallery((s) => s.selectedBoardId);
  const live = useGeneratingItems().filter((i) => (i.boardId ?? 'none') === boardId);
  const [shown, setShown] = useState(PAGE);
  // Another board starts from its first page.
  const [shownBoard, setShownBoard] = useState(boardId);
  if (shownBoard !== boardId) {
    setShownBoard(boardId);
    setShown(PAGE);
  }
  const end = useRef<HTMLDivElement>(null);
  const more = shown < list.length;
  useEffect(() => {
    const el = end.current;
    if (!el || !more || typeof IntersectionObserver === 'undefined') return;
    const watch = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setShown((n) => n + PAGE);
    }, { rootMargin: '400px' });
    watch.observe(el);
    return () => watch.disconnect();
  }, [more, shown]);

  return (
    <div className="phone-imgs" data-testid="phone-images">
      <BoardBar count={list.length} />
      {list.length === 0 && live.length === 0 ? (
        <div className="phone-imgs__empty">
          <EmptyState icon={<ImageBroken size={32} />} title={t('gallery.empty.noImages')} />
        </div>
      ) : (
        <div className="phone-imgs__grid" data-testid="phone-images-grid">
          {live.map((item) => (
            <LiveCell key={item.id} item={item} />
          ))}
          {list.slice(0, shown).map((image) => (
            <button
              key={image.name}
              type="button"
              className="phone-imgs__cell"
              aria-label={image.name}
              data-testid="phone-thumb"
              onClick={() => usePhone.getState().show({ kind: 'image', name: image.name })}
            >
              <img src={image.thumbnailUrl} alt="" loading="lazy" draggable={false} />
              {image.starred && <Star weight="fill" className="phone-imgs__star" aria-hidden />}
            </button>
          ))}
        </div>
      )}
      {more && <div ref={end} className="phone-imgs__end" aria-hidden />}
    </div>
  );
}

function BoardBar({ count }: { count: number }) {
  const boards = useGallery((s) => s.boards);
  const boardId = useGallery((s) => s.selectedBoardId);
  const showArchived = useGallery((s) => s.settings.showArchivedBoards);
  const options = [
    { value: 'none', label: t('gallery.boards.uncategorized') },
    ...boards.filter((b) => showArchived || !b.archived || b.id === boardId).map((b) => ({ value: b.id, label: b.name })),
  ];
  return (
    <div className="phone-imgs__bar">
      <Select value={boardId} onChange={(id) => useGallery.getState().selectBoard(id)} options={options} aria-label={t('phone.board')} data-testid="phone-board" className="phone-imgs__board" />
      <span className="phone-imgs__count" data-testid="phone-images-count">
        {count}
      </span>
    </div>
  );
}

/** A job being drawn for this board: its picture in progress; pressing it shows it full screen. */
function LiveCell({ item }: { item: QueueItem }) {
  const progress = useQueue((s) => (s.progress?.itemId === item.id ? s.progress : null));
  return (
    <button
      type="button"
      className="phone-imgs__cell is-live"
      aria-label={t('phone.openLive')}
      data-testid="phone-live-thumb"
      onClick={() => usePhone.getState().show({ kind: 'live', itemId: item.id })}
    >
      {progress?.progressImageUrl ? <img src={progress.progressImageUrl} alt="" draggable={false} /> : <Spinner size={18} />}
      {progress && <span className="phone-imgs__step">{t('gallery.generating.step', { step: progress.step, total: progress.totalSteps })}</span>}
    </button>
  );
}
