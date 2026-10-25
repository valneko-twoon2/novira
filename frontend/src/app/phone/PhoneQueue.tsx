// The Queue tab of the phone layout: the processor's state with pause / resume and tidying the finished ones, and every
// job as a card, newest first, with its picture, state and prompt. A card of a job being drawn or of a finished picture
// opens it full screen; one waiting or running can be cancelled, one that failed or was cancelled tried again.
import { ArrowCounterClockwise, Broom, ListBullets, Pause, Play, Warning, X } from '@phosphor-icons/react';
import { backend, type QueueItem } from '@/backend';
import { DESTINATION_KEYS, STATUS_KEYS } from '@/features/queue/queueFormat';
import { t, tCount } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useQueue } from '@/state/queue';
import { toast } from '@/state/toasts';
import { cx, EmptyState, Spinner } from '@/ui';
import { usePhone } from './phoneStore';

export function PhoneQueue() {
  const items = useQueue((s) => s.items);
  const newestFirst = [...items].sort((a, b) => b.id - a.id);
  return (
    <div className="phone-queue" data-testid="phone-queue">
      <QueueBar />
      {newestFirst.length === 0 ? (
        <div className="phone-imgs__empty">
          <EmptyState icon={<ListBullets size={32} />} title={t('queue.empty.title')} description={t('queue.empty.description')} />
        </div>
      ) : (
        <ul className="phone-queue__list">
          {newestFirst.map((item) => (
            <QueueCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function QueueBar() {
  const status = useQueue((s) => s.status);
  const finished = status.completed + status.failed + status.canceled;
  const prune = async () => {
    await backend.pruneQueue();
    toast({ status: 'success', title: tCount('queue.toast.pruned', finished) });
  };
  return (
    <div className="phone-imgs__bar phone-queue__bar">
      <span className={cx('phone-queue__state', status.isPaused && 'is-paused')} data-testid="phone-queue-state">
        {status.isPaused ? t('queue.processor.paused') : t('queue.processor.running')}
      </span>
      {status.isPaused ? (
        <button type="button" className="phone-queue__button" data-testid="phone-queue-resume" onClick={() => void backend.resumeProcessor()}>
          <Play size={18} weight="fill" />
          {t('queue.action.resume')}
        </button>
      ) : (
        <button type="button" className="phone-queue__button" data-testid="phone-queue-pause" onClick={() => void backend.pauseProcessor()}>
          <Pause size={18} weight="fill" />
          {t('queue.action.pause')}
        </button>
      )}
      <button type="button" className="phone-queue__button" disabled={finished === 0} data-testid="phone-queue-prune" onClick={() => void prune()}>
        <Broom size={18} />
        {t('queue.action.prune')}
      </button>
    </div>
  );
}

function QueueCard({ item }: { item: QueueItem }) {
  const image = useGallery((s) => (item.imageName ? s.images.find((i) => i.name === item.imageName) : undefined));
  const progress = useQueue((s) => (s.progress?.itemId === item.id ? s.progress : null));
  const canCancel = item.status === 'pending' || item.status === 'in_progress';
  const canRetry = item.status === 'failed' || item.status === 'canceled';
  const running = item.status === 'in_progress';
  const opens = running ? item.destination === 'gallery' : !!image;
  const open = () => {
    if (running) usePhone.getState().show({ kind: 'live', itemId: item.id });
    else if (image) usePhone.getState().show({ kind: 'image', name: image.name });
  };
  const retry = async () => {
    const copy = await backend.retryQueueItem(item.id);
    if (copy) toast({ status: 'info', title: t('queue.toast.retried', { id: item.id }) });
  };
  const p = item.params;
  const thumb = running && progress?.progressImageUrl ? progress.progressImageUrl : image?.thumbnailUrl;
  return (
    <li className="phone-queue__card" data-status={item.status} data-testid="phone-queue-item">
      <button type="button" className="phone-queue__main" disabled={!opens} onClick={open} aria-label={p.positivePrompt || t('queue.noPrompt')}>
        <span className="phone-queue__thumb">
          {thumb ? <img src={thumb} alt="" draggable={false} /> : item.status === 'failed' ? <Warning size={20} /> : canCancel ? <Spinner size={16} /> : null}
        </span>
        <span className="phone-queue__text">
          <span className="phone-queue__line">
            <span className="phone-queue__status" data-status={item.status}>
              {t(STATUS_KEYS[item.status])}
            </span>
            {running && progress && <span className="phone-queue__step">{t('gallery.generating.step', { step: progress.step, total: progress.totalSteps })}</span>}
            {item.destination !== 'gallery' && <span className="phone-queue__where">{t(DESTINATION_KEYS[item.destination])}</span>}
          </span>
          <span className="phone-queue__prompt">{p.positivePrompt || t('queue.noPrompt')}</span>
          <span className="phone-queue__meta">
            {p.modelName} · {p.width}×{p.height}
          </span>
          {item.status === 'failed' && item.error && <span className="phone-queue__error">{item.error}</span>}
        </span>
      </button>
      {canCancel && (
        <button type="button" className="phone-queue__act is-danger" aria-label={t('common.cancel')} data-testid="phone-queue-cancel" onClick={() => void backend.cancelQueueItem(item.id)}>
          <X size={20} weight="bold" />
        </button>
      )}
      {canRetry && (
        <button type="button" className="phone-queue__act" aria-label={t('queue.action.retry')} data-testid="phone-queue-retry" onClick={() => void retry()}>
          <ArrowCounterClockwise size={20} />
        </button>
      )}
    </li>
  );
}
