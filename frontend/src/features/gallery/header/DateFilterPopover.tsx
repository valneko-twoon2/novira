// Date filter of the gallery: quick ranges, a month calendar with the days that have images, and a custom from–to range.
import { CalendarBlank } from '@phosphor-icons/react';
import { useState } from 'react';
import { t } from '@/i18n';
import { matchQuickRange, normalizeRange, QUICK_RANGES, quickRange, type DateRange } from '@/state/dateFilter';
import { useGallery } from '@/state/gallery';
import { Button, IconButton, Popover, PopoverContent, PopoverTrigger, TextInput } from '@/ui';
import { useBoardDayCounts } from '../useBoardImages';
import { DateCalendar } from './DateCalendar';

const setFilter = (range: DateRange | null) => useGallery.getState().setDateFilter(range);

function CustomRange({ range }: { range: DateRange | null }) {
  const [from, setFrom] = useState(range?.from ?? '');
  const [to, setTo] = useState(range?.to ?? '');
  const next = normalizeRange(from || null, to || null);
  return (
    <div className="gdate__custom">
      <div className="gsettings__title">{t('gallery.date.custom')}</div>
      <div className="gdate__inputs">
        <TextInput type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label={t('gallery.date.from')} data-testid="gallery-date-from" />
        <span className="gdate__dash" aria-hidden>
          –
        </span>
        <TextInput type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label={t('gallery.date.to')} data-testid="gallery-date-to" />
        <Button size="xs" variant="outline" disabled={!next} onClick={() => setFilter(next)} data-testid="gallery-date-apply">
          {t('gallery.date.apply')}
        </Button>
      </div>
    </div>
  );
}

export function DateFilterPopover() {
  const filter = useGallery((s) => s.dateFilter);
  const counts = useBoardDayCounts();
  const quick = matchQuickRange(filter);
  const choice = (active: boolean) => ({ size: 'xs', variant: active ? 'solid' : 'outline', scheme: active ? 'accent' : 'base', 'aria-pressed': active }) as const;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton label={t('gallery.date.button')} icon={<CalendarBlank />} size="xs" isActive={filter !== null} data-testid="gallery-date-filter" />
      </PopoverTrigger>
      <PopoverContent align="end" className="gsettings gdate">
        <div className="gsettings__title">{t('gallery.date.button')}</div>
        <div className="gdate__quick">
          {QUICK_RANGES.map((kind) => (
            <Button key={kind} {...choice(quick === kind)} onClick={() => setFilter(quickRange(kind))} data-testid={`gallery-date-quick-${kind}`}>
              {t(`gallery.date.quick.${kind}`)}
            </Button>
          ))}
          <Button {...choice(filter === null)} onClick={() => setFilter(null)} data-testid="gallery-date-quick-all">
            {t('gallery.date.quick.all')}
          </Button>
        </div>
        <div className="gsettings__sep" />
        <DateCalendar range={filter} counts={counts} onPick={(day) => setFilter({ from: day, to: day })} />
        <div className="gsettings__sep" />
        {/* Remount when the filter changes elsewhere (quick range, calendar, chip) so the inputs show it. */}
        <CustomRange key={`${filter?.from ?? ''}~${filter?.to ?? ''}`} range={filter} />
      </PopoverContent>
    </Popover>
  );
}
