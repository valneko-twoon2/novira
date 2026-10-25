// Compact install dock: a badge showing active installs that opens the queue in a popover.
import { DownloadSimple } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { cx, Popover, PopoverContent, PopoverTrigger, Spinner } from '@/ui';
import { InstallQueue } from './InstallQueue';
import { ACTIVE_STATUSES } from './modelLabels';

export function InstallDock() {
  const jobs = useModels((s) => s.installJobs);
  const active = jobs.filter((j) => ACTIVE_STATUSES.has(j.status)).length;
  if (jobs.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cx('mm-dock', active > 0 && 'is-active')} data-testid="mm-install-dock">
          {active > 0 ? <Spinner size={12} /> : <DownloadSimple size={13} />}
          <span>{active > 0 ? t('models.dock.installing', { count: active }) : t('models.dock.queue')}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="mm-dock__pop">
        <InstallQueue />
      </PopoverContent>
    </Popover>
  );
}
