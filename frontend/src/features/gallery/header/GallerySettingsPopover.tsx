// Gallery settings popover (thumbnail size, auto-switch, auto-assign, sorting, grouping by date, badges, archived boards).
import { GearSix } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { t } from '@/i18n';
import { useGallery, type GallerySettings } from '@/state/gallery';
import { IconButton, Popover, PopoverContent, PopoverTrigger, Select, Slider, Switch } from '@/ui';

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="gsettings__row">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function GallerySettingsPopover() {
  const s = useGallery((st) => st.settings);
  const set = (patch: Partial<GallerySettings>) => useGallery.getState().setSettings(patch);
  const toggle = (key: 'autoSwitch' | 'autoAssignBoardOnClick' | 'starredFirst' | 'alwaysShowImageSizeBadge' | 'showArchivedBoards' | 'groupByDate', label: string) => (
    <Row label={label}>
      <Switch checked={s[key]} onChange={(v) => set({ [key]: v })} aria-label={label} />
    </Row>
  );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton label={t('gallery.settings.title')} icon={<GearSix />} size="xs" data-testid="gallery-settings" />
      </PopoverTrigger>
      <PopoverContent align="end" className="gsettings">
        <div className="gsettings__title">{t('gallery.settings.title')}</div>
        <div className="gsettings__field">
          <span>{t('gallery.settings.thumbnailSize')}</span>
          <Slider value={s.thumbnailSize} min={45} max={256} step={1} onChange={(v) => set({ thumbnailSize: v })} aria-label={t('gallery.settings.thumbnailSize')} />
        </div>
        {toggle('autoSwitch', t('gallery.settings.autoSwitch'))}
        {toggle('autoAssignBoardOnClick', t('gallery.settings.autoAssign'))}
        {toggle('alwaysShowImageSizeBadge', t('gallery.settings.alwaysShowSize'))}
        {toggle('showArchivedBoards', t('gallery.settings.showArchived'))}
        <div className="gsettings__sep" />
        {toggle('starredFirst', t('gallery.settings.starredFirst'))}
        <Row label={t('gallery.settings.sort')}>
          <Select
            value={s.sortDirection}
            onChange={(v) => set({ sortDirection: v })}
            options={[
              { value: 'desc', label: t('gallery.settings.sortNewest') },
              { value: 'asc', label: t('gallery.settings.sortOldest') },
            ]}
            aria-label={t('gallery.settings.sort')}
            className="gsettings__select"
          />
        </Row>
        {toggle('groupByDate', t('gallery.settings.groupByDate'))}
      </PopoverContent>
    </Popover>
  );
}
