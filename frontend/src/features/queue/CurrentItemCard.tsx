// The item being processed: progress image, step counter and a cancel button.
import { Hourglass, X } from '@phosphor-icons/react';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { useQueue } from '@/state/queue';
import { Button, EmptyState, ProgressBar } from '@/ui';
import { ORIGIN_KEYS } from './queueFormat';

export function CurrentItemCard() {
  const items = useQueue((s) => s.items);
  const progress = useQueue((s) => s.progress);
  const current = items.find((i) => i.status === 'in_progress');
  if (!current) return <EmptyState icon={<Hourglass size={28} />} title={t('queue.current.idle')} />;
  const p = progress?.itemId === current.id ? progress : null;
  const fraction = p ? p.step / Math.max(1, p.totalSteps) : 0;
  return (
    <div className="qt-current" data-testid="queue-current">
      <div className="qt-current__thumb">{p?.progressImageUrl ? <img src={p.progressImageUrl} alt="" /> : <Hourglass size={24} />}</div>
      <div className="qt-current__info">
        <div className="qt-current__row">
          <span className="qt-current__label">{t('queue.current.title')}</span>
          <span className="qt-mono">#{current.id}</span>
          <span className="qt-faint">{t(ORIGIN_KEYS[current.origin])}</span>
          <span className="qt-spacer" />
          <Button size="xs" scheme="danger" variant="outline" leftIcon={<X size={12} />} onClick={() => void backend.cancelQueueItem(current.id)}>
            {t('common.cancel')}
          </Button>
        </div>
        <div className="qt-current__prompt" title={current.params.positivePrompt}>
          {current.params.positivePrompt || <span className="qt-faint">{t('queue.noPrompt')}</span>}
        </div>
        <div className="qt-current__meta">
          <span>{current.params.modelName}</span>
          <span>
            {current.params.width}×{current.params.height}
          </span>
          <span>{t('queue.field.seed', { seed: current.params.seed })}</span>
        </div>
        <ProgressBar value={fraction} indeterminate={!p} className="qt-current__bar" />
        <div className="qt-current__steps">{p ? t('queue.current.steps', { step: p.step, total: p.totalSteps }) : t('queue.current.preparing')}</div>
      </div>
    </div>
  );
}
