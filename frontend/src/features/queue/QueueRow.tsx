// One queue item row with cancel/retry actions and an expandable detail section; a job that ran out of GPU memory
// also shows what to do about it.
import { ArrowCounterClockwise, CaretRight, X } from '@phosphor-icons/react';
import { backend, type QueueItem } from '@/backend';
import { t } from '@/i18n';
import { isOutOfMemory } from '@/state/outOfMemory';
import { toast } from '@/state/toasts';
import { IconButton, OutOfMemoryNotice, cx } from '@/ui';
import { QueueItemDetail } from './QueueItemDetail';
import { DESTINATION_KEYS, ORIGIN_KEYS, STATUS_KEYS, durationSeconds, formatTime, shortId } from './queueFormat';

export function QueueRow({ item, expanded, onToggle }: { item: QueueItem; expanded: boolean; onToggle: () => void }) {
  const canCancel = item.status === 'pending' || item.status === 'in_progress';
  const canRetry = item.status === 'failed' || item.status === 'canceled';
  const duration = durationSeconds(item);
  const p = item.params;

  const retry = async () => {
    const copy = await backend.retryQueueItem(item.id);
    if (copy) toast({ status: 'info', title: t('queue.toast.retried', { id: item.id }) });
  };

  return (
    <div className={cx('qt-item', expanded && 'is-expanded')} data-status={item.status} data-testid="queue-item">
      <div className="qt-row" role="row" onClick={onToggle}>
        <span className="qt-row__caret">
          <CaretRight size={12} weight="bold" />
        </span>
        <span className="qt-mono">{item.id}</span>
        <span>
          <span className="qt-status" data-status={item.status}>
            {t(STATUS_KEYS[item.status])}
          </span>
        </span>
        <span className="qt-ellipsis">{t(ORIGIN_KEYS[item.origin])}</span>
        <span className="qt-ellipsis">{t(DESTINATION_KEYS[item.destination])}</span>
        <span className="qt-mono qt-ellipsis" title={item.batchId}>
          {shortId(item.batchId)}
        </span>
        <span className="qt-fields">
          <span className="qt-fields__prompt" title={p.positivePrompt}>
            {p.positivePrompt || t('queue.noPrompt')}
          </span>
          <span className="qt-fields__chip">{t('queue.field.seed', { seed: p.seed })}</span>
          <span className="qt-fields__chip">{p.modelName}</span>
          <span className="qt-fields__chip">
            {p.width}×{p.height}
          </span>
        </span>
        <span className="qt-time">
          <span>{formatTime(item.createdAt)}</span>
          {duration !== null && <span className="qt-faint">{t('queue.duration', { seconds: duration.toFixed(1) })}</span>}
        </span>
        <span className="qt-row__actions" onClick={(e) => e.stopPropagation()}>
          {canCancel && <IconButton label={t('common.cancel')} icon={<X size={14} />} size="xs" scheme="danger" onClick={() => void backend.cancelQueueItem(item.id)} />}
          {canRetry && <IconButton label={t('queue.action.retry')} icon={<ArrowCounterClockwise size={14} />} size="xs" onClick={() => void retry()} />}
        </span>
      </div>
      {isOutOfMemory(item) && <OutOfMemoryNotice item={item} detailed={expanded} className="qt-oom" />}
      {expanded && <QueueItemDetail item={item} />}
    </div>
  );
}
