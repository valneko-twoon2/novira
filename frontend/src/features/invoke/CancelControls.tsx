// Cancel the running item (split with a queue menu).
import { CaretDown, ListBullets, Pause, Play, Trash, X, XCircle } from '@phosphor-icons/react';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { useQueue } from '@/state/queue';
import { useUi } from '@/state/ui';
import { chordLabel, IconButton, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/ui';

export function CancelControls() {
  const items = useQueue((s) => s.items);
  const status = useQueue((s) => s.status);
  const current = items.find((i) => i.status === 'in_progress');
  const hasQueue = status.pending + status.inProgress > 0;
  return (
    <div className="ib__split">
      <IconButton
        className="ib__cancel"
        scheme="danger"
        variant="outline"
        size="lg"
        label={t('params.invoke.cancelCurrent')}
        tooltip={`${t('params.invoke.cancelCurrent')} (${chordLabel('shift+x')})`}
        tooltipSide="bottom"
        icon={<X weight="bold" />}
        disabled={!current}
        onClick={() => current && void backend.cancelQueueItem(current.id)}
      />
      <Menu>
        <MenuTrigger asChild>
          <button type="button" className="ui-btn ui-btn--danger ui-btn--outline ui-btn--lg ib__caret" aria-label={t('params.invoke.queueMenu')}>
            <CaretDown size={14} weight="bold" />
          </button>
        </MenuTrigger>
        <MenuContent align="end">
          <MenuItem icon={<XCircle />} disabled={!current} shortcut={chordLabel('shift+x')} onSelect={() => current && void backend.cancelQueueItem(current.id)}>
            {t('params.invoke.cancelCurrent')}
          </MenuItem>
          <MenuItem icon={<Trash />} danger disabled={!hasQueue} shortcut={chordLabel('mod+shift+x')} onSelect={() => void backend.clearQueue()}>
            {t('params.invoke.clearQueue')}
          </MenuItem>
          <MenuSeparator />
          {status.isPaused ? (
            <MenuItem icon={<Play />} onSelect={() => void backend.resumeProcessor()}>
              {t('params.invoke.resume')}
            </MenuItem>
          ) : (
            <MenuItem icon={<Pause />} onSelect={() => void backend.pauseProcessor()}>
              {t('params.invoke.pause')}
            </MenuItem>
          )}
          <MenuItem icon={<ListBullets />} onSelect={() => useUi.getState().setTab('queue')}>
            {t('params.invoke.openQueue')}
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}
