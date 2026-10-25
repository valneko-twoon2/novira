// "Scan Folder" tab: list model files in a folder and install them.
import { useState } from 'react';
import { backend, hasNativeDialogs } from '@/backend';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { toast } from '@/state/toasts';
import { Badge, Button, InstallSlot, TextInput } from '@/ui';
import { installModel, sourceState } from '@/state/modelInstall';

export function InstallScanFolder() {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ path: string; installed: boolean }[] | null>(null);
  const [filter, setFilter] = useState('');
  const models = useModels((s) => s.models);
  const jobs = useModels((s) => s.installJobs);

  const scan = async () => {
    setBusy(true);
    try {
      // The shell asks for the folder in its own dialog; null means the user cancelled it.
      const found = await backend.scanFolder();
      if (found) setResults(found);
    } catch (err) {
      toast({ status: 'error', title: t('models.install.scanFailed'), description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  if (!hasNativeDialogs()) {
    return (
      <div className="mm-form">
        <div className="mm-form__help" data-testid="mm-scan-desktop-only">
          {t('common.desktopOnly')}
        </div>
      </div>
    );
  }

  const state = (r: { path: string; installed: boolean }) => (r.installed ? 'installed' : sourceState(r.path, models, jobs));
  const shown = (results ?? []).filter((r) => r.path.toLowerCase().includes(filter.trim().toLowerCase()));
  const installable = shown.filter((r) => !state(r));

  return (
    <div className="mm-form">
      <label className="mm-form__label" htmlFor="mm-scan">
        {t('models.install.scanLabel')}
      </label>
      <div className="mm-form__row">
        <Button id="mm-scan" scheme="accent" isLoading={busy} onClick={() => void scan()} data-testid="mm-scan-button">
          {t('models.install.scan')}
        </Button>
      </div>
      {results && (
        <div className="mm-results">
          <div className="mm-results__header">
            <span className="mm-results__title">{t('models.install.scanResults', { count: results.length })}</span>
            <TextInput className="mm-results__filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('common.search')} aria-label={t('common.search')} />
            <Button size="xs" scheme="accent" disabled={installable.length === 0} onClick={() => installable.forEach((r) => void installModel(r.path))}>
              {t('models.install.installAll')}
            </Button>
          </div>
          {shown.map((r) => {
            return (
              <div key={r.path} className="mm-result">
                <span className="mm-result__path mm-mono" title={r.path}>
                  {r.path}
                </span>
                {r.installed ? (
                  <Badge scheme="success">{t('models.install.installed')}</Badge>
                ) : (
                  <InstallSlot source={r.path}>
                    <Button size="xs" onClick={() => void installModel(r.path)}>
                      {t('models.install.install')}
                    </Button>
                  </InstallSlot>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
