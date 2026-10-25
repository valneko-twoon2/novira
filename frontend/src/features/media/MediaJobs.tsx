// Running, waiting and recently failed jobs of one kind of media, shown above its finished results.
import { X } from '@phosphor-icons/react';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { isOutOfMemory } from '@/state/outOfMemory';
import { useQueue } from '@/state/queue';
import { IconButton, OutOfMemoryNotice, ProgressBar } from '@/ui';
import type { GeneratedKind } from './MediaPanel';

/** The jobs of `kind`, so the caller can tell whether anything is going on. */
export function useMediaJobs(kind: GeneratedKind) {
  const items = useQueue((s) => s.items);
  const mine = items.filter((i) => i.params.generationMode === kind);
  return {
    active: mine.filter((i) => i.status === 'pending' || i.status === 'in_progress'),
    failed: mine.filter((i) => i.status === 'failed').slice(-3),
  };
}

export function MediaJobs({ kind }: { kind: GeneratedKind }) {
  const { active, failed } = useMediaJobs(kind);
  const progress = useQueue((s) => s.progress);
  return (
    <>
      {active.map((i) => (
        <div key={i.id} className="mf-job" data-testid={`${kind}-job`}>
          <span>{i.status === 'in_progress' ? t(`media.job.running.${kind}`) : t('media.job.waiting')}</span>
          <ProgressBar value={i.status === 'in_progress' && progress?.itemId === i.id ? progress.step / progress.totalSteps : 0} indeterminate={i.status === 'pending'} />
          <IconButton size="xs" label={t('media.job.cancel')} icon={<X />} onClick={() => void backend.cancelQueueItem(i.id)} />
        </div>
      ))}
      {failed.map((i) =>
        isOutOfMemory(i) ? (
          <OutOfMemoryNotice key={i.id} item={i} />
        ) : (
          <div key={i.id} className="mf-job is-failed">
            <span>{t(`media.job.failed.${kind}`)}</span>
            <span className="mf-job__error">{i.error}</span>
          </div>
        ),
      )}
    </>
  );
}
