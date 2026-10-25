import { WarningCircle } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useEngine } from '@/state/engine';
import { ProgressBar, Spinner } from '@/ui';
import './engine.css';

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${Math.round(mb)} MB`;
}

/** Shows what the backend is doing to get ComfyUI running; hidden while idle or ready. */
export function EngineBanner() {
  const status = useEngine((s) => s.status);
  if (status.state === 'idle' || status.state === 'ready') return null;
  if (status.state === 'error') {
    return (
      <div className="engine-banner is-error" role="alert" data-testid="engine-banner">
        <WarningCircle size={18} weight="fill" />
        <div className="engine-banner__body">
          <div className="engine-banner__title">{t('engine.title.error')}</div>
          <div className="engine-banner__desc">{status.message}</div>
        </div>
      </div>
    );
  }
  const downloading = status.state === 'downloading';
  return (
    <div className="engine-banner" role="status" data-testid="engine-banner">
      <Spinner size={16} />
      <div className="engine-banner__body">
        <div className="engine-banner__title">{t(`engine.title.${status.state}`)}</div>
        {downloading && status.totalBytes > 0 && (
          <div className="engine-banner__desc">
            {t('engine.sizeProgress', { done: formatBytes(status.bytes), total: formatBytes(status.totalBytes) })}
          </div>
        )}
        <ProgressBar value={downloading && status.totalBytes ? status.bytes / status.totalBytes : 0} indeterminate={!downloading || !status.totalBytes} />
        {downloading && <div className="engine-banner__desc">{t('engine.firstRunNote')}</div>}
      </div>
    </div>
  );
}
