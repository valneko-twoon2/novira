// Gallery toolbar: Images / Assets tabs, image count, search, date filter, settings and upload; below it the active date filter.
import { ArrowArcLeft, ArrowArcRight, MagnifyingGlass, UploadSimple, X } from '@phosphor-icons/react';
import { useState } from 'react';
import { t } from '@/i18n';
import type { DateRange } from '@/state/dateFilter';
import { useGallery, type GalleryView } from '@/state/gallery';
import { redoDeletion, undoDeletion, useGalleryUndo } from '@/state/galleryUndo';
import { cx, IconButton, TextInput } from '@/ui';
import { rangeLabel } from '../dateLabels';
import { useBoardImages } from '../useBoardImages';
import { DateFilterPopover } from './DateFilterPopover';
import { GallerySettingsPopover } from './GallerySettingsPopover';

const VIEWS: GalleryView[] = ['images', 'assets'];

/** The active date filter, removable with its x button. */
function DateChip({ range }: { range: DateRange }) {
  const label = rangeLabel(range);
  return (
    <span className="gheader__chip" title={t('gallery.date.active', { range: label })} data-testid="gallery-date-chip">
      <span className="gheader__chip-label">{label}</span>
      <IconButton
        label={t('gallery.date.clear')}
        icon={<X />}
        size="xs"
        tooltip={false}
        className="gheader__chip-clear"
        onClick={() => useGallery.getState().setDateFilter(null)}
        data-testid="gallery-date-chip-clear"
      />
    </span>
  );
}

export function GalleryHeader({ onUploadClick }: { onUploadClick: () => void }) {
  const view = useGallery((s) => s.view);
  const search = useGallery((s) => s.search);
  const dateFilter = useGallery((s) => s.dateFilter);
  const count = useBoardImages().length;
  const canUndo = useGalleryUndo((s) => s.undo.length > 0);
  const canRedo = useGalleryUndo((s) => s.redo.length > 0);
  const [searchOpen, setSearchOpen] = useState(search.length > 0);
  const g = useGallery.getState;
  return (
    <div className="gheader">
      <div className="gheader__bar">
        <div className="gheader__tabs" role="tablist">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={cx('gheader__tab', view === v && 'is-active')}
              onClick={() => g().setView(v)}
              data-testid={`gallery-view-${v}`}
            >
              {v === 'images' ? t('gallery.view.images') : t('gallery.view.assets')}
            </button>
          ))}
        </div>
        <span className="gheader__count" data-testid="gallery-count">
          {count}
        </span>
        <span className="gheader__spacer" />
        <IconButton label={t('gallery.undoDelete.label')} icon={<ArrowArcLeft />} size="xs" disabled={!canUndo} onClick={() => void undoDeletion()} data-testid="gallery-undo-delete" />
        <IconButton label={t('gallery.redoDelete.label')} icon={<ArrowArcRight />} size="xs" disabled={!canRedo} onClick={() => void redoDeletion()} data-testid="gallery-redo-delete" />
        <IconButton
          label={t('gallery.search.label')}
          icon={<MagnifyingGlass />}
          size="xs"
          isActive={searchOpen}
          onClick={() => {
            if (searchOpen) g().setSearch('');
            setSearchOpen(!searchOpen);
          }}
        />
        <DateFilterPopover />
        <GallerySettingsPopover />
        <IconButton label={t('gallery.upload')} icon={<UploadSimple />} size="xs" onClick={onUploadClick} data-testid="gallery-upload" />
      </div>
      {dateFilter && (
        <div className="gheader__filters">
          <DateChip range={dateFilter} />
        </div>
      )}
      {searchOpen && (
        <div className="gheader__search">
          <MagnifyingGlass size={13} className="gheader__search-icon" />
          <TextInput
            autoFocus
            value={search}
            placeholder={t('gallery.search.placeholder')}
            aria-label={t('gallery.search.label')}
            onChange={(e) => g().setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                g().setSearch('');
                setSearchOpen(false);
              }
            }}
          />
          {search && <IconButton label={t('common.clear')} icon={<X />} size="xs" onClick={() => g().setSearch('')} tooltip={false} />}
        </div>
      )}
    </div>
  );
}
