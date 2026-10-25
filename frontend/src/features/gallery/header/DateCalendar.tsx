// Month calendar of the date filter: days that have images carry a dot; clicking a day shows only that day.
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useState } from 'react';
import { t, tCount } from '@/i18n';
import { addMonths, dayInRange, dayKey, monthGrid, monthOf, type DateRange, type DayKey } from '@/state/dateFilter';
import { cx, IconButton } from '@/ui';
import { dayOfMonthLabel, longDayLabel, monthLabel, weekdayLabels } from '../dateLabels';

interface Props {
  range: DateRange | null;
  /** Images per local day in the current board and view. */
  counts: Map<DayKey, number>;
  onPick: (day: DayKey) => void;
}

export function DateCalendar({ range, counts, onPick }: Props) {
  const today = dayKey(Date.now());
  const [month, setMonth] = useState(() => monthOf(range?.from ?? range?.to ?? today));
  const weeks = monthGrid(month);
  return (
    <div className="gcal" data-testid="gallery-date-calendar">
      <div className="gcal__head">
        <IconButton label={t('gallery.date.prevMonth')} icon={<CaretLeft />} size="xs" onClick={() => setMonth(addMonths(month, -1))} data-testid="gallery-date-prev-month" />
        <span className="gcal__month" data-testid="gallery-date-month">
          {monthLabel(month)}
        </span>
        <IconButton label={t('gallery.date.nextMonth')} icon={<CaretRight />} size="xs" onClick={() => setMonth(addMonths(month, 1))} data-testid="gallery-date-next-month" />
      </div>
      <div className="gcal__grid" role="grid">
        <div className="gcal__week" role="row">
          {weekdayLabels().map((label, i) => (
            <span key={i} className="gcal__weekday" role="columnheader">
              {label}
            </span>
          ))}
        </div>
        {weeks.map((week, w) => (
          <div key={w} className="gcal__week" role="row">
            {week.map((day, i) => {
              if (!day) return <span key={i} className="gcal__blank" role="gridcell" />;
              const count = counts.get(day) ?? 0;
              const selected = range !== null && dayInRange(day, range);
              const edge = selected && (day === range?.from || day === range?.to);
              return (
                <button
                  key={day}
                  type="button"
                  role="gridcell"
                  className={cx('gcal__day', count > 0 && 'has-images', selected && 'is-selected', edge && 'is-edge', day === today && 'is-today')}
                  aria-label={count > 0 ? tCount('gallery.date.dayCount', count, { date: longDayLabel(day) }) : longDayLabel(day)}
                  aria-selected={selected}
                  onClick={() => onPick(day)}
                  data-testid={`gallery-date-day-${day}`}
                >
                  {dayOfMonthLabel(day)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
