// Processor and bulk queue actions: pause/resume, cancel current, cancel pending, prune, clear.
import { Broom, Pause, Play, Trash, X, XCircle } from '@phosphor-icons/react';
import { useState } from 'react';
import { backend } from '@/backend';
import { t, tCount } from '@/i18n';
import { useQueue } from '@/state/queue';
import { toast } from '@/state/toasts';
import { Badge, Button, Modal } from '@/ui';

export function QueueControls() {
  const status = useQueue((s) => s.status);
  const items = useQueue((s) => s.items);
  const [confirmClear, setConfirmClear] = useState(false);
  const current = items.find((i) => i.status === 'in_progress');
  const pending = items.filter((i) => i.status === 'pending');
  const finished = status.completed + status.failed + status.canceled;

  const clear = async () => {
    await backend.clearQueue();
    setConfirmClear(false);
    toast({ status: 'success', title: t('queue.toast.cleared') });
  };
  const prune = async () => {
    await backend.pruneQueue();
    toast({ status: 'success', title: tCount('queue.toast.pruned', finished) });
  };
  const cancelPending = async () => {
    for (const item of pending) await backend.cancelQueueItem(item.id);
    toast({ status: 'info', title: tCount('queue.toast.canceledPending', pending.length) });
  };

  return (
    <div className="qt-controls">
      <div className="qt-controls__title">
        <h2 className="qt__heading">{t('queue.title')}</h2>
        <Badge scheme={status.isPaused ? 'warning' : 'success'}>{status.isPaused ? t('queue.processor.paused') : t('queue.processor.running')}</Badge>
      </div>
      <div className="qt-controls__buttons">
        {status.isPaused ? (
          <Button size="sm" scheme="accent" leftIcon={<Play size={14} weight="fill" />} onClick={() => void backend.resumeProcessor()} data-testid="queue-resume">
            {t('queue.action.resume')}
          </Button>
        ) : (
          <Button size="sm" leftIcon={<Pause size={14} weight="fill" />} onClick={() => void backend.pauseProcessor()} data-testid="queue-pause">
            {t('queue.action.pause')}
          </Button>
        )}
        <Button size="sm" leftIcon={<X size={14} />} disabled={!current} onClick={() => current && void backend.cancelQueueItem(current.id)}>
          {t('queue.action.cancelCurrent')}
        </Button>
        <Button size="sm" leftIcon={<XCircle size={14} />} disabled={pending.length === 0} onClick={() => void cancelPending()}>
          {t('queue.action.cancelAllExceptCurrent')}
        </Button>
        <Button size="sm" leftIcon={<Broom size={14} />} disabled={finished === 0} onClick={() => void prune()} data-testid="queue-prune">
          {t('queue.action.prune')}
        </Button>
        <Button size="sm" scheme="danger" variant="outline" leftIcon={<Trash size={14} />} disabled={status.total === 0} onClick={() => setConfirmClear(true)}>
          {t('queue.action.clear')}
        </Button>
      </div>
      <Modal
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={t('queue.clearTitle')}
        size="sm"
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              {t('common.cancel')}
            </Button>
            <Button scheme="danger" onClick={() => void clear()} data-testid="queue-clear-confirm">
              {t('queue.action.clear')}
            </Button>
          </>
        }
      >
        <p className="qt-dialog__text">{t('queue.clearConfirm')}</p>
      </Modal>
    </div>
  );
}
