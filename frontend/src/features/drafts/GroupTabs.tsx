// The history of draft batches: the latest ones stay on the screen as tabs, the older ones are reached from a popup.
import { ClockCounterClockwise, X } from '@phosphor-icons/react';
import { t, tCount } from '@/i18n';
import { useDrafts, type DraftGroup } from '@/state/drafts';
import { Button, cx, IconButton, Popover, PopoverContent, PopoverTrigger } from '@/ui';

/** How many of the latest batches are shown as tabs; the rest are in the popup. */
export const RECENT_GROUPS = 5;

export function GroupTabs({ groups, currentId }: { groups: DraftGroup[]; currentId: string | null }) {
  const setCurrent = useDrafts((s) => s.setCurrent);
  const closeGroup = useDrafts((s) => s.closeGroup);
  const closeGroups = useDrafts((s) => s.closeGroups);
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
            <ul className="dv-olderlist" data-testid="drafts-older-list">
              {[...older].reverse().map((g) => (
                <li key={g.id} className={cx('dv-olderitem', g.id === currentId && 'is-on')}>
                  <button type="button" onClick={() => setCurrent(g.id)}>
                    {label(g)}
                  </button>
                  <IconButton size="xs" label={t('drafts.closeGroup')} icon={<X />} onClick={() => closeGroup(g.id)} />
                </li>
              ))}
            </ul>
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
