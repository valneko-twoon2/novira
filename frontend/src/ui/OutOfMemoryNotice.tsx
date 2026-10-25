// What to do after a job ran out of GPU memory: a short explanation, "retry smaller" and "low-memory mode".
// Shared by the queue, the gallery's running-jobs strip and the media screens.
import { useEffect } from 'react';
import { WarningCircle, X } from '@phosphor-icons/react';
import type { QueueItem } from '@/backend';
import { t } from '@/i18n';
import { canTurnOnLowMemory, useLowMemory } from '@/state/lowMemory';
import { retrySmaller, retrySmallerSize } from '@/state/outOfMemory';
import { Button, IconButton, cx } from './controls';

export function OutOfMemoryNotice({ item, detailed = false, onDismiss, className }: {
  item: QueueItem;
  /** Also lists the other remedies (the queue's details have the room). */
  detailed?: boolean;
  /** Shows a close button. */
  onDismiss?: () => void;
  className?: string;
}) {
  const mode = useLowMemory((s) => s.mode);
  const busy = useLowMemory((s) => s.busy);
  useEffect(() => {
    void useLowMemory.getState().load();
  }, []);
  const size = retrySmallerSize(item);
  const offerLowMemory = canTurnOnLowMemory(mode);
  return (
    <div className={cx('oom-notice', className)} role="alert" data-testid="oom-notice">
      <div className="oom-notice__head">
        <WarningCircle size={16} weight="fill" className="oom-notice__icon" />
        <span className="oom-notice__title">{t('queue.oom.title')}</span>
        {onDismiss && <IconButton size="xs" variant="ghost" label={t('common.close')} icon={<X size={12} />} onClick={onDismiss} />}
      </div>
      <p className="oom-notice__text">{t('queue.oom.explain')}</p>
      {detailed && <p className="oom-notice__text oom-notice__text--faint">{t('queue.oom.tip')}</p>}
      {(size || offerLowMemory) && (
        <div className="oom-notice__actions">
          {size && (
            <Button size="xs" scheme="accent" data-testid="oom-retry-smaller" title={t('queue.oom.retrySmallerHint', { width: size.width, height: size.height })} onClick={() => void retrySmaller(item)}>
              {t('queue.oom.retrySmaller')}
            </Button>
          )}
          {offerLowMemory && (
            <Button size="xs" variant="outline" data-testid="oom-low-memory" isLoading={busy} onClick={() => void useLowMemory.getState().setEnabled(true)}>
              {t('queue.oom.lowMemory')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
