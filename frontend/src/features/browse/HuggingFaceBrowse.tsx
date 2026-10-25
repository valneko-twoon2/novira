// The Hugging Face side of the model search. Its repositories are found by address, not by name: paste a repository page (or a
// folder or file in it) and pick the model files to install.
import { ArrowSquareOut } from '@phosphor-icons/react';
import { useState } from 'react';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { isPhoneLayout } from '@/state/layout';
import { installModel, sourceState } from '@/state/modelInstall';
import { useModels } from '@/state/models';
import { Button, Checkbox, EmptyState, InstallStatus, TextInput } from '@/ui';
import { useDownloadState } from './download';
import { parseHuggingFaceInput, type HuggingFaceTarget } from './huggingFaceUrl';

interface Listing {
  target: HuggingFaceTarget;
  files: string[];
}

/** One model file of the listing: a checkbox while it can be installed, else that it is installed or how far its download is. */
function HfFile({ repo, path, checked, onChange }: { repo: string; path: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const state = useDownloadState(`${repo}::${path}`, path.split('/').pop() ?? path);
  return (
    <div className="browse-hf__file" data-testid="browse-hf-file" data-state={state.kind}>
      <Checkbox checked={checked && state.kind === 'idle'} disabled={state.kind !== 'idle'} onChange={onChange} label={<span className="browse-hf__path">{path}</span>} />
      <InstallStatus state={state} />
    </div>
  );
}

export function HuggingFaceBrowse() {
  const [input, setInput] = useState('');
  const [listing, setListing] = useState<Listing | null>(null);
  const [wholeRepo, setWholeRepo] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = async () => {
    if (busy) return;
    const target = parseHuggingFaceInput(input);
    if (!target) {
      setError(t('browse.hf.invalid'));
      setListing(null);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const files = await backend.listHuggingFaceFiles(target.repo);
      setListing({ target, files });
      setWholeRepo(false);
      setChecked(new Set(target.file && files.includes(target.file) ? [target.file] : []));
    } catch (err) {
      setListing(null);
      setError(t('models.install.hfLookupFailed', { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(false);
    }
  };

  const folder = listing?.target.folder ?? '';
  const inFolder = listing ? listing.files.filter((f) => f.startsWith(`${folder}/`)) : [];
  // An address into a folder shows that folder first; when nothing there is a model file, or on request, the whole repository.
  const scoped = folder !== '' && !wholeRepo && inFolder.length > 0;
  const shown = listing ? (scoped ? inFolder : listing.files) : [];

  const installChecked = async () => {
    if (!listing) return;
    for (const f of checked) {
      const source = `${listing.target.repo}::${f}`;
      const { models, installJobs } = useModels.getState();
      // A file that got installed, or started, since it was ticked is not sent again.
      if (!sourceState(source, models, installJobs)) await installModel(source);
    }
    setChecked(new Set());
  };

  return (
    <div className="browse-hf" data-testid="browse-hf">
      <form
        className="browse-hf__form"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup();
        }}
      >
        <h2 className="browse-hf__title">{t('browse.hf.title')}</h2>
        <p className="browse-hf__help">{t('browse.hf.help')}</p>
        <div className="browse-hf__row">
          <TextInput
            className="browse-hf__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://huggingface.co/h94/IP-Adapter/tree/main/sdxl_models"
            aria-label={t('browse.hf.title')}
            spellCheck={false}
            autoFocus={!isPhoneLayout()}
            data-testid="browse-hf-input"
          />
          <Button type="submit" scheme="accent" isLoading={busy} disabled={!input.trim() || busy} data-testid="browse-hf-lookup">
            {t('models.install.hfLookup')}
          </Button>
        </div>
        {error && (
          <div className="browse-hf__error" role="alert">
            {error}
          </div>
        )}
      </form>
      {listing && (
        <div className="browse-hf__results" data-testid="browse-hf-results">
          <div className="browse-hf__head">
            <span className="browse-hf__heading">{t('models.install.hfFiles', { repo: scoped ? `${listing.target.repo}/${folder}` : listing.target.repo })}</span>
            {folder !== '' && inFolder.length > 0 && (
              <Button size="xs" variant="outline" onClick={() => setWholeRepo(!wholeRepo)} data-testid="browse-hf-scope">
                {scoped ? t('browse.hf.showAll') : t('browse.hf.showFolder', { folder })}
              </Button>
            )}
            <Button size="xs" variant="outline" leftIcon={<ArrowSquareOut size={12} />} onClick={() => void backend.openHuggingFacePage(listing.target.repo)}>
              {t('browse.hf.open')}
            </Button>
            <Button size="xs" scheme="accent" disabled={checked.size === 0} onClick={() => void installChecked()} data-testid="browse-hf-install">
              {t('models.install.installSelected', { count: checked.size })}
            </Button>
          </div>
          {shown.length === 0 ? (
            <EmptyState title={t('models.install.hfNoFiles')} />
          ) : (
            shown.map((f) => (
              <HfFile
                key={f}
                repo={listing.target.repo}
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
