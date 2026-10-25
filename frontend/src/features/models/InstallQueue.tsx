// Install queue: one row per install job with progress, status and cancel.
import { X } from '@phosphor-icons/react';
import { backend, type ModelInstallJob } from '@/backend';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { Badge, Button, EmptyState, IconButton, ProgressBar } from '@/ui';
import { ACTIVE_STATUSES as ACTIVE, INSTALL_STATUS_KEYS, formatBytes } from './modelLabels';

function statusScheme(status: ModelInstallJob['status']) {
  if (status === 'completed') return 'success' as const;
  if (status === 'error') return 'danger' as const;
  if (status === 'cancelled') return 'warning' as const;
  if (status === 'waiting') return 'base' as const;
  return 'accent' as const;
}

export function InstallQueue() {
  const jobs = useModels((s) => s.installJobs);
  const prune = useModels((s) => s.clearFinishedJobs);
  const canPrune = jobs.some((j) => !ACTIVE.has(j.status));
  return (
    <div className="mm-queue" data-testid="mm-install-queue">
      <div className="mm-queue__header">
        <h3 className="mm-subtitle">{t('models.queue.title')}</h3>
        <Badge>{jobs.length}</Badge>
        <span className="mm-spacer" />
        <Button size="xs" variant="outline" disabled={!canPrune} onClick={prune}>
          {t('models.queue.prune')}
        </Button>
      </div>
      <div className="mm-queue__list">
        {jobs.length === 0 ? (
          <EmptyState title={t('models.queue.empty')} />
        ) : (
          jobs.map((job) => (
            <div key={job.id} className="mm-job" data-status={job.status}>
              <div className="mm-job__top">
                <span className="mm-item__name" title={job.source}>
                  {job.name}
                </span>
                <span className="mm-job__bytes">
                  {job.status === 'downloading' || job.status === 'running' || job.status === 'completed'
                    ? `${formatBytes(job.bytes)} / ${formatBytes(job.totalBytes)}`
                    : ''}
                </span>
                <Badge scheme={statusScheme(job.status)}>{t(INSTALL_STATUS_KEYS[job.status])}</Badge>
                <IconButton
                  label={t('models.queue.cancel')}
                  icon={<X size={12} />}
                  size="xs"
                  disabled={!ACTIVE.has(job.status)}
                  onClick={() => void backend.cancelInstall(job.id)}
                />
              </div>
              <ProgressBar
                className="mm-job__progress"
                value={job.totalBytes > 0 ? job.bytes / job.totalBytes : 0}
                indeterminate={job.status === 'waiting' || job.status === 'running'}
              />
              {job.error && <div className="mm-error">{job.error}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
