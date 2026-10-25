// "URL" tab: a model file's address. A file on this PC is installed from "Scan Folder" (the backend takes a local path only
// from that list), so a path typed here is pointed there instead of being sent.
import { useState } from 'react';
import { t } from '@/i18n';
import { Button, TextInput } from '@/ui';
import { installModel } from '@/state/modelInstall';

/** A drive path (`C:\…`), a share (`\\host\…`) or an absolute POSIX path. */
export function isLocalPath(text: string): boolean {
  return /^([a-z]:[\\/]|\\\\|\/)/i.test(text.trim());
}

export function InstallFromSource() {
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const local = isLocalPath(source);
  const submit = async () => {
    if (!source.trim() || local) return;
    setBusy(true);
    const started = await installModel(source);
    setBusy(false);
    // A failed install keeps the text so it can be corrected.
    if (started) setSource('');
  };
  return (
    <form
      className="mm-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label className="mm-form__label" htmlFor="mm-source">
        {t('models.install.sourceLabel')}
      </label>
      <div className="mm-form__row">
        <TextInput id="mm-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder={t('models.install.sourcePlaceholder')} data-testid="mm-source-input" />
        <Button type="submit" scheme="accent" isLoading={busy} disabled={!source.trim() || local} data-testid="mm-source-install">
          {t('models.install.install')}
        </Button>
      </div>
      {local && (
        <div className="mm-error" role="alert" data-testid="mm-source-local">
          {t('models.install.localPath')}
        </div>
      )}
      <div className="mm-form__help">{t('models.install.sourceHelp')}</div>
    </form>
  );
}
