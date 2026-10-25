import { Check, Warning, X } from '@phosphor-icons/react';
import { backend, type ModelInstallJob } from '@/backend';
import { t, type MessageKey } from '@/i18n';
import { useModels } from '@/state/models';
import { Button, IconButton, ProgressBar } from '@/ui';
import { CIVITAI_SOURCE_PREFIX } from './download';

const STATUS_KEYS: Record<ModelInstallJob['status'], MessageKey> = {
  waiting: 'browse.dock.status.waiting',
  downloading: 'browse.dock.status.downloading',
  running: 'browse.dock.status.running',
  completed: 'browse.dock.status.completed',
  error: 'browse.dock.status.error',
  cancelled: 'browse.dock.status.cancelled',
};

const ACTIVE = new Set<ModelInstallJob['status']>(['waiting', 'downloading', 'running']);

export function DownloadDock() {
  const allJobs = useModels((s) => s.installJobs);
  const clear = useModels((s) => s.clearFinishedJobs);
  const jobs = allJobs.filter((j) => (j.source.startsWith(CIVITAI_SOURCE_PREFIX) || j.source.includes('::'))).slice(0, 6);
  if (jobs.length === 0) return null;
  const hasFinished = jobs.some((j) => !ACTIVE.has(j.status));
  return (
    <div className="browse-dock" data-testid="browse-dock" aria-live="polite">
      <div className="browse-dock__head">
        <span>{t('browse.dock.title')}</span>
        {hasFinished && (
          <Button size="xs" variant="ghost" onClick={clear}>
            {t('browse.dock.clear')}
          </Button>
        )}
      </div>
      <ul>
        {jobs.map((j) => {
          const active = ACTIVE.has(j.status);
          return (
            <li key={j.id}>
              <div className="browse-dock__row">
                <span className="browse-dock__name" title={j.name}>
                  {j.name}
                </span>
                {j.status === 'completed' && <Check size={13} weight="bold" className="is-ok" />}
                {j.status === 'error' && <Warning size={13} className="is-err" />}
                {active && <IconButton size="xs" label={t('browse.dock.cancel')} icon={<X size={11} />} onClick={() => void backend.cancelInstall(j.id)} />}
              </div>
              {active ? (
                <ProgressBar value={j.totalBytes ? j.bytes / j.totalBytes : 0} indeterminate={j.status !== 'downloading'} />
              ) : (
                <div className="browse-dock__state">{t(STATUS_KEYS[j.status])}</div>
              )}
              {j.status === 'error' && j.error && <div className="browse-dock__error">{j.error}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
