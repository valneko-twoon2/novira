// Virtualized image grid with selection, context menu, keyboard navigation and optional day headers.
import { CalendarBlank, ImageBroken, MagnifyingGlass, UploadSimple } from '@phosphor-icons/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { t } from '@/i18n';
import { useGeneratingItems } from '@/state/generating';
import { useGallery } from '@/state/gallery';
import type { TabName } from '@/state/ui';
import { Button, ContextMenu, ContextMenuContent, ContextMenuTrigger, EmptyState } from '@/ui';
import { longDayLabel } from '../dateLabels';
import { MultiImageMenu } from '../menus/MultiImageMenu';
import { SingleImageMenu } from '../menus/SingleImageMenu';
import { useBoardImages } from '../useBoardImages';
import { useElementSize } from '../useElementSize';
import { buildGridLayout, verticalStep } from './layout';
import { LiveThumbnail } from './LiveThumbnail';
import { clickImage } from './selection';
import { Thumbnail } from './Thumbnail';
import { useGridHotkeys } from './useGridHotkeys';

const GAP = 4;
/** Height of a day header row, its spacing included. */
const HEADER_H = 26;

export function ImageGrid({ tab, onUploadClick }: { tab: TabName; onUploadClick: () => void }) {
  const list = useBoardImages();
  const names = useMemo(() => list.map((i) => i.name), [list]);
  const selection = useGallery((s) => s.selection);
  const compareName = useGallery((s) => s.compareImageName);
  const thumbSize = useGallery((s) => s.settings.thumbnailSize);
  const alwaysShowSize = useGallery((s) => s.settings.alwaysShowImageSizeBadge);
  const search = useGallery((s) => s.search);
  const dateFilter = useGallery((s) => s.dateFilter);
  const grouped = useGallery((s) => s.settings.groupByDate);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { width } = useElementSize(scrollRef);
  const inner = Math.max(0, width - 2 * GAP);
  const cols = Math.max(1, Math.floor((inner + GAP) / (thumbSize + GAP)));
  const cell = inner > 0 ? Math.floor((inner - GAP * (cols - 1)) / cols) : thumbSize;
  const layout = useMemo(() => buildGridLayout(list, cols, grouped), [list, cols, grouped]);

  // Pictures being drawn come first, above the rows (they are not images yet, so they are no part of the layout).
  const generating = useGeneratingItems();
  const selectedBoardId = useGallery((s) => s.selectedBoardId);
  const view = useGallery((s) => s.view);
  const live = useMemo(
    () => (view === 'images' && !search.trim() && !dateFilter ? generating.filter((i) => (i.boardId ?? 'none') === selectedBoardId) : []),
    [generating, view, search, dateFilter, selectedBoardId],
  );
  const liveHeight = live.length ? Math.ceil(live.length / cols) * (cell + GAP) : 0;

  const virtualizer = useVirtualizer({
    count: layout.rows.length,
    getScrollElement: () => scrollRef.current,
    scrollMargin: liveHeight,
    estimateSize: (i) => (layout.rows[i]?.kind === 'header' ? HEADER_H : cell + GAP),
    overscan: 4,
  });
  // Row heights depend on the cell size and on where the headers fall.
  useEffect(() => virtualizer.measure(), [cell, layout, virtualizer]);

  const scrollToIndex = useCallback((idx: number) => virtualizer.scrollToIndex(layout.rowOf[idx] ?? 0, { align: 'auto' }), [virtualizer, layout]);
  const stepRow = useCallback((idx: number, dir: -1 | 1) => verticalStep(layout, idx, dir), [layout]);
  useGridHotkeys({ tab, names, stepRow, gridRef: scrollRef, scrollToIndex });

  const selectedSet = useMemo(() => new Set(selection), [selection]);
  const onClick = useCallback((name: string, e: MouseEvent) => clickImage(name, e, names), [names]);

  const [menuTarget, setMenuTarget] = useState<string | null>(null);
  const menuImage = list.find((i) => i.name === menuTarget);
  const multi = menuTarget !== null && selection.length > 1 && selection.includes(menuTarget);

  const empty = dateFilter ? (
    <EmptyState icon={<CalendarBlank size={32} />} title={t('gallery.empty.noDateResults')} description={t('gallery.empty.noDateResultsHint')}>
      <Button size="sm" variant="outline" onClick={() => useGallery.getState().setDateFilter(null)} data-testid="gallery-date-empty-clear">
        {t('gallery.date.clear')}
      </Button>
    </EmptyState>
  ) : search.trim() ? (
    <EmptyState icon={<MagnifyingGlass size={32} />} title={t('gallery.empty.noResults')} />
  ) : (
    <EmptyState icon={<ImageBroken size={32} />} title={t('gallery.empty.noImages')} description={t('gallery.empty.noImagesHint')}>
      <Button size="sm" variant="outline" leftIcon={<UploadSimple />} onClick={onUploadClick}>
        {t('common.upload')}
      </Button>
    </EmptyState>
  );

  return (
    <ContextMenu onOpenChange={(open) => !open && setMenuTarget(null)}>
      <ContextMenuTrigger
        asChild
        onContextMenu={(e) => {
          const el = (e.target as HTMLElement).closest<HTMLElement>('[data-image-name]');
          const name = el?.dataset.imageName;
          if (!name) {
            e.preventDefault();
            return;
          }
          setMenuTarget(name);
        }}
      >
        <div
          className="ggrid"
          ref={scrollRef}
          data-testid="gallery-grid"
        >
          {live.length > 0 && (
            <div className="ggrid__live" style={{ gap: GAP, paddingBottom: GAP }} data-testid="gallery-live">
              {live.map((item) => (
                <LiveThumbnail key={item.id} item={item} size={cell} />
              ))}
            </div>
          )}
          {!list.length && !live.length && empty}
          <div className="ggrid__inner" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((row) => {
              const entry = layout.rows[row.index];
              if (!entry) return null;
              if (entry.kind === 'header') {
                return (
                  <div key={row.key} className="ggrid__day" style={{ transform: `translateY(${row.start - liveHeight}px)`, height: HEADER_H }} data-testid="gallery-day-header">
                    {t('gallery.date.groupHeader', { date: longDayLabel(entry.day), count: entry.count })}
                  </div>
                );
              }
              return (
                <div key={row.key} className="ggrid__row" style={{ transform: `translateY(${row.start - liveHeight}px)`, gap: GAP, height: cell }}>
                  {list.slice(entry.start, entry.end).map((image) => (
                    <Thumbnail
                      key={image.name}
                      image={image}
                      size={cell}
                      selected={selectedSet.has(image.name)}
                      isCompare={compareName === image.name}
                      alwaysShowSize={alwaysShowSize}
                      onClick={onClick}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {multi ? <MultiImageMenu names={selection} /> : menuImage ? <SingleImageMenu image={menuImage} /> : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}
