// The history of draft batches: the latest ones stay on the screen as tabs, the older ones are reached from a popup that
// lists them by day, each with the pictures drawn then.
import { ClockCounterClockwise, X } from '@phosphor-icons/react';
import { getLocale, t, tCount } from '@/i18n';
import { useDrafts, type DraftGroup } from '@/state/drafts';
import { useGallery } from '@/state/gallery';
import { Button, cx, IconButton, Popover, PopoverContent, PopoverTrigger } from '@/ui';
import { pictureOf } from './pictures';

/** How many of the latest batches are shown as tabs; the rest are in the popup. */
export const RECENT_GROUPS = 5;

/** How many pictures of a batch the popup shows beside its name. */
const THUMBS = 4;

const dayStart = (time: number) => {
  const d = new Date(time);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** The batches by the day they were started, the latest day first and the latest batch first within a day. */
export function byDay(groups: DraftGroup[]): { day: number; groups: DraftGroup[] }[] {
  const days = new Map<number, DraftGroup[]>();
  // Batches started in the same instant keep their order of starting.
  const latestFirst = groups.map((g, i) => ({ g, i })).sort((a, b) => b.g.createdAt - a.g.createdAt || b.i - a.i);
  for (const { g } of latestFirst) {
    const day = dayStart(g.createdAt);
    days.set(day, [...(days.get(day) ?? []), g]);
  }
  return [...days].map(([day, list]) => ({ day, groups: list }));
}

/** "Today" and "yesterday" in the UI language, else the date with its weekday. */
function dayLabel(day: number, now = Date.now()): string {
  const apart = Math.round((day - dayStart(now)) / 86_400_000);
  if (apart >= -1 && apart <= 0) return new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' }).format(apart, 'day');
  const sameYear = new Date(day).getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(getLocale(), { year: sameYear ? undefined : 'numeric', month: 'short', day: 'numeric', weekday: 'short' }).format(day);
}

const timeLabel = (time: number) => new Intl.DateTimeFormat(getLocale(), { hour: '2-digit', minute: '2-digit' }).format(time);

export function GroupTabs({ groups, currentId }: { groups: DraftGroup[]; currentId: string | null }) {
  const setCurrent = useDrafts((s) => s.setCurrent);
  const closeGroup = useDrafts((s) => s.closeGroup);
  const closeGroups = useDrafts((s) => s.closeGroups);
  const images = useGallery((s) => s.images);
  if (groups.length === 0) return null;
  const split = Math.max(0, groups.length - RECENT_GROUPS);
  const older = groups.slice(0, split);
  const label = (g: DraftGroup) => t('drafts.group', { n: groups.indexOf(g) + 1, model: g.params.modelName });
  return (
    <div className="dv-groups" role="tablist">
      {older.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" leftIcon={<ClockCounterClockwise />} className={cx('dv-older', older.some((g) => g.id === currentId) && 'is-on')} data-testid="drafts-older">
              {tCount('drafts.older', older.length)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="dv-olderpop">
            <div className="dv-olderlist" data-testid="drafts-older-list">
              {byDay(older).map(({ day, groups: list }) => (
                <section key={day} className="dv-olderday">
                  <h3>{dayLabel(day)}</h3>
                  <ul>
                    {list.map((g) => (
                      <li key={g.id} className={cx('dv-olderitem', g.id === currentId && 'is-on')}>
                        <button type="button" onClick={() => setCurrent(g.id)}>
                          <span className="dv-olderthumbs">
                            {g.candidates
                              .map((c) => pictureOf(c, images).image)
                              .filter((image) => image !== undefined)
                              .slice(0, THUMBS)
                              .map((image) => (
                                <img key={image.name} src={image.thumbnailUrl || image.url} alt="" draggable={false} />
                              ))}
                          </span>
                          <span className="dv-oldertext">
                            <span className="dv-oldername" data-truncate-ok="model name in a fixed-width popup">{label(g)}</span>
                            <span className="dv-oldertime">{timeLabel(g.createdAt)}</span>
                          </span>
                        </button>
                        <IconButton size="xs" label={t('drafts.closeGroup')} icon={<X />} onClick={() => closeGroup(g.id)} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <Button size="xs" variant="ghost" onClick={() => closeGroups(older.map((g) => g.id))} data-testid="drafts-close-older">
              {t('drafts.closeOlder')}
            </Button>
          </PopoverContent>
        </Popover>
      )}
      {groups.slice(split).map((g, i) => (
        <span key={g.id} className={cx('dv-group', g.id === currentId && 'is-on')}>
          <button type="button" role="tab" aria-selected={g.id === currentId} onClick={() => setCurrent(g.id)}>
            {t('drafts.group', { n: split + i + 1, model: g.params.modelName })}
          </button>
          <IconButton size="xs" label={t('drafts.closeGroup')} icon={<X />} onClick={() => closeGroup(g.id)} />
        </span>
      ))}
    </div>
  );
}
