// "HuggingFace" tab: enter a repo id, pick model files from the repository's listing, install them.
import { useState } from 'react';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { Button, Checkbox, EmptyState, InstallStatus, TextInput } from '@/ui';
import { installModel, useInstallState } from '@/state/modelInstall';

/** One file of the listing: a checkbox while it can be installed, else that it is installed or how far its download is. */
function HfRow({ source, path, checked, onChange }: { source: string; path: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const state = useInstallState(source);
  return (
    <div className="mm-result" data-state={state.kind}>
      <Checkbox checked={checked && state.kind === 'idle'} disabled={state.kind !== 'idle'} onChange={onChange} label={<span className="mm-mono">{path}</span>} />
      <InstallStatus state={state} />
    </div>
  );
}

export function InstallHuggingFace() {
  const [repo, setRepo] = useState('');
  const [listed, setListed] = useState<{ repo: string; files: string[] } | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = async () => {
    const r = repo.trim();
    if (busy) return;
    if (!/^[\w.-]+\/[\w.-]+$/.test(r)) {
      setError(t('models.install.hfInvalid'));
      setListed(null);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const files = await backend.listHuggingFaceFiles(r);
      setListed({ repo: r, files });
      setChecked(new Set());
    } catch (err) {
      setListed(null);
      setError(t('models.install.hfLookupFailed', { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(false);
    }
  };

  const installSelected = async () => {
    if (!listed) return;
    for (const f of checked) await installModel(`${listed.repo}::${f}`);
    setChecked(new Set());
  };

  const installAll = () => {
    if (!listed) return;
    for (const f of listed.files) void installModel(`${listed.repo}::${f}`);
  };

  return (
    <div className="mm-form">
      <label className="mm-form__label" htmlFor="mm-hf">
        {t('models.install.hfLabel')}
      </label>
      <form
        className="mm-form__row"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup();
        }}
      >
        <TextInput id="mm-hf" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="stabilityai/sdxl-turbo" />
        <Button type="submit" scheme="accent" isLoading={busy} disabled={!repo.trim() || busy}>
          {t('models.install.hfLookup')}
        </Button>
        <Button variant="outline" disabled={!listed || listed.files.length === 0} onClick={installAll}>
          {t('models.install.hfInstallRepo')}
        </Button>
      </form>
      <div className="mm-form__help">{t('models.install.hfHelp')}</div>
      {error && <div className="mm-error">{error}</div>}
      {listed && (
        <div className="mm-results">
          <div className="mm-results__header">
            <span className="mm-results__title">{t('models.install.hfFiles', { repo: listed.repo })}</span>
            <Button size="xs" scheme="accent" disabled={checked.size === 0} onClick={() => void installSelected()}>
              {t('models.install.installSelected', { count: checked.size })}
            </Button>
          </div>
          {listed.files.length === 0 ? (
            <EmptyState title={t('models.install.hfNoFiles')} />
          ) : (
            listed.files.map((f) => (
              <HfRow
                key={f}
                source={`${listed.repo}::${f}`}
                path={f}
                checked={checked.has(f)}
                onChange={(v) => {
                  const next = new Set(checked);
                  if (v) next.add(f);
                  else next.delete(f);
                  setChecked(next);
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
