// The history of draft batches: the latest ones stay on the screen as tabs; every batch, the older ones too, is on the
// history screen the button at the left opens.
import { ClockCounterClockwise, X } from '@phosphor-icons/react';
import { useState } from 'react';
import { t } from '@/i18n';
import { useDrafts, type DraftGroup } from '@/state/drafts';
import { Button, cx, IconButton } from '@/ui';
import { DraftHistory } from './DraftHistory';
import { RECENT_GROUPS } from './history';

export function GroupTabs({ groups, currentId }: { groups: DraftGroup[]; currentId: string | null }) {
  const setCurrent = useDrafts((s) => s.setCurrent);
  const closeGroup = useDrafts((s) => s.closeGroup);
  const [history, setHistory] = useState(false);
  if (groups.length === 0) return null;
  const split = Math.max(0, groups.length - RECENT_GROUPS);
  const olderOn = groups.slice(0, split).some((g) => g.id === currentId);
  return (
    <div className="dv-groups" role="tablist">
      <Button size="sm" variant="outline" leftIcon={<ClockCounterClockwise />} className={cx('dv-older', olderOn && 'is-on')} onClick={() => setHistory(true)} data-testid="drafts-history-button">
        {t('drafts.history.button', { count: groups.length })}
      </Button>
      <DraftHistory open={history} onClose={() => setHistory(false)} />
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
