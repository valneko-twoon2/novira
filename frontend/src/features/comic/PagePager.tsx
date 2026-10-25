// The pages of the comic, under the page view and in its middle: a small drawing of each page (its panels and pictures),
// which opens that page when pressed. As many pages as the row has room for are shown at once (never more than ten); the
// arrows on either side show the group before or after, and the group follows the page on screen. Beside them are how
// many pages there are, adding a page, and deleting the page on screen (on the second press, so one click cannot lose
// the work). What the view gives it sits at the two ends of the same row (undo and redo at the start, the zoom at the end).
// A comic read from the right (its first page's direction) lists its pages from the right, as a printed manga runs: page 1
// at the right end, the later pages and groups to the left.
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { CaretLeft, CaretRight, Plus, Trash } from '@phosphor-icons/react';
import { t } from '@/i18n';
import type { ComicPage, ComicProject } from '@/state/comic/document';
import { pageAspect, pageShapes } from '@/state/comic/layout';
import { useComic } from '@/state/comic/store';
import { useGallery } from '@/state/gallery';
import { cx, IconButton, PressAgainIconButton } from '@/ui';
import { PageThumb } from './PageThumb';

/** The most pages shown at once. */
export const PAGE_GROUP_MAX = 10;
/** The height of a page's drawing in the row, and the space between two drawings, in pixels (the CSS uses the same). */
const THUMB_HEIGHT = 56;
const THUMB_GAP = 4;
/** The frame around a drawing (the page on screen is marked by it), on both sides, in pixels. */
const THUMB_FRAME = 4;

/** How many drawings fit in a row this wide, between one and PAGE_GROUP_MAX. */
export function groupSize(rowWidth: number, aspect: number): number {
  const slot = THUMB_HEIGHT / aspect + THUMB_FRAME + THUMB_GAP;
  return Math.max(1, Math.min(PAGE_GROUP_MAX, Math.floor((rowWidth + THUMB_GAP) / slot)));
}

/** How many drawings the row has room for, measured as the row changes width (every one, where it cannot be measured). */
function useGroupSize(row: RefObject<HTMLDivElement | null>, aspect: number): number {
  const [size, setSize] = useState(PAGE_GROUP_MAX);
  useEffect(() => {
    const el = row.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      if (el.clientWidth) setSize(groupSize(el.clientWidth, aspect));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [row, aspect]);
  return size;
}

export function PagePager({
  project,
  page,
  start,
  children,
}: {
  project: ComicProject;
  page: ComicPage;
  start?: ReactNode;
  children?: ReactNode;
}) {
  const index = project.pages.findIndex((p) => p.id === page.id);
  const row = useRef<HTMLDivElement>(null);
  const images = useGallery((s) => s.images);
  const urls = useMemo(() => new Map(images.map((i) => [i.name, i.url])), [images]);
  // The widest page of the comic decides how many fit, so a group never runs out of the row.
  const widest = Math.min(...project.pages.map((p) => pageAspect(p.size)));
  const size = useGroupSize(row, widest);
  const groups = Math.max(1, Math.ceil(project.pages.length / size));
  const [group, setGroup] = useState(() => Math.floor(Math.max(0, index) / size));
  // The group that holds the page on screen is shown whenever the page changes (a new page is added at the end).
  useEffect(() => {
    setGroup(Math.floor(Math.max(0, index) / size));
  }, [index, size, project.pages.length]);
  const shown = Math.min(group, groups - 1);
  const first = shown * size;
  const rtl = project.pages[0]?.direction === 'rtl';
  const earlier = (
    <IconButton
      size="sm"
      label={t('comic.page.prevGroup')}
      icon={rtl ? <CaretRight /> : <CaretLeft />}
      disabled={shown <= 0}
      onClick={() => setGroup(shown - 1)}
      data-testid="comic-page-group-prev"
    />
  );
  const later = (
    <IconButton
      size="sm"
      label={t('comic.page.nextGroup')}
      icon={rtl ? <CaretLeft /> : <CaretRight />}
      disabled={shown >= groups - 1}
      onClick={() => setGroup(shown + 1)}
      data-testid="comic-page-group-next"
    />
  );
  return (
    <div className="comic-pager">
      <div className="comic-pager__start">{start}</div>
      <nav className="comic-pager__nav" aria-label={t('comic.page.pages')} data-testid="comic-pager">
        {rtl ? later : earlier}
        <div ref={row} className={cx('comic-pager__list', rtl && 'is-rtl')} data-testid="comic-pager-list">
          {project.pages.slice(first, first + size).map((p, i) => {
            const number = first + i + 1;
            const aspect = pageAspect(p.size);
            const backdrop = p.backdrop ? urls.get(p.backdrop.imageName) : undefined;
            return (
              <button
                key={p.id}
                type="button"
                className={cx('comic-pager__page', p.id === page.id && 'is-active')}
                style={{ width: THUMB_HEIGHT / aspect + THUMB_FRAME }}
                aria-pressed={p.id === page.id}
                aria-label={t('comic.page.number', { number })}
                title={t('comic.page.number', { number })}
                onClick={() => useComic.getState().selectPage(p.id)}
                data-testid={`comic-page-${number}`}
              >
                <PageThumb
                  shapes={pageShapes(p)}
                  aspect={aspect}
                  pictures={p.panels.map((panel) => (panel.imageName ? urls.get(panel.imageName) : undefined))}
                  backdrop={backdrop}
                  page={p}
                  urlOf={(name) => urls.get(name)}
                />
                <span className="comic-pager__number" aria-hidden="true">
                  {number}
                </span>
              </button>
            );
          })}
        </div>
        {rtl ? earlier : later}
        <span className="comic-pager__count">{t('comic.page.of', { number: index + 1, count: project.pages.length })}</span>
        <IconButton
          size="sm"
          label={t('comic.page.add')}
          icon={<Plus />}
          onClick={() => useComic.getState().addPage()}
          data-testid="comic-page-add"
        />
        <PressAgainIconButton
          key={page.id}
          size="sm"
          scheme="danger"
          label={t('comic.page.delete')}
          againLabel={t('comic.page.deleteAgain')}
          icon={<Trash />}
          onConfirm={() => useComic.getState().deletePage(page.id)}
          data-testid="comic-page-delete"
        />
      </nav>
      <div className="comic-pager__end">{children}</div>
    </div>
  );
}
