// Version control of ComfyUI itself: the version it is at, the releases it can be switched to and a "not recommended" mark
// on a release that an installed extension is known not to support. Switching installs every extension again, so it asks twice.
import { useState } from 'react';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { conflictsFor } from '@/state/comfy/versions';
import { Badge, Button } from '@/ui';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function ComfyVersions() {
  const installed = useNodePacks((s) => s.packs?.installed ?? []);
  const comfyVersion = useNodePacks((s) => s.packs?.comfyVersion ?? null);
  const switching = useNodePacks((s) => s.comfySwitching);
  const failed = useNodePacks((s) => s.comfyFailed);
  const error = useNodePacks((s) => s.error);
  const switchComfy = useNodePacks((s) => s.switchComfy);
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<string[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [asked, setAsked] = useState<string | null>(null);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    setAsked(null);
    if (next && tags === null) {
      setListError(null);
      backend.comfyVersions().then(setTags, (e) => {
        setListError(message(e));
        setTags([]);
      });
    }
  };

  return (
    <div className="wf-ver" data-testid="comfy-versions">
      <Button size="xs" variant="ghost" onClick={toggle} aria-expanded={open} disabled={switching !== null} data-testid="comfy-version-toggle">
        {open ? t('workflows.packs.version.hide') : t('workflows.packs.version.change')}
      </Button>
      {switching !== null && (
        <p className="wf-ext__note" data-testid="comfy-switching">
          {t('workflows.packs.version.switching')}
        </p>
      )}
      {failed.length > 0 && <p className="wf-packs__error">{t('workflows.packs.version.switchFailed', { names: failed.join(', ') })}</p>}
      {error && <p className="wf-packs__error">{error}</p>}
      {open && (
        <div className="wf-ver__panel">
          <p className="wf-ext__note">{t('workflows.packs.version.comfyHint')}</p>
          {tags === null && <p className="wf-ext__note">{t('workflows.packs.version.loading')}</p>}
          {listError && <p className="wf-packs__error">{listError}</p>}
          {tags?.length === 0 && !listError && <p className="wf-ext__note">{t('workflows.packs.version.none')}</p>}
          <ul className="wf-ver__list">
            {tags?.map((tag) => {
              const names = [...new Set(conflictsFor({ kind: 'comfyui' }, tag, installed, comfyVersion).map((c) => (c.kind === 'pack' ? c.folder : 'ComfyUI')))];
              const current = comfyVersion !== null && tag.replace(/^v/, '') === comfyVersion.replace(/^v/, '');
              return (
                <li key={tag} className="wf-ver__row" data-testid="comfy-version-row">
                  <span className="wf-ver__tag">{tag}</span>
                  {current && <Badge scheme="success">{t('workflows.packs.installed')}</Badge>}
                  {names.length > 0 && (
                    <span className="wf-ver__warn" data-testid="comfy-version-deprecated">
                      <Badge scheme="warning">{t('workflows.packs.version.deprecated')}</Badge>
                      <span>{t('workflows.packs.version.deprecatedBy', { names: names.join(', ') })}</span>
                    </span>
                  )}
                  {!current && (
                    <Button
                      size="xs"
                      variant={asked === tag ? 'solid' : 'outline'}
                      disabled={switching !== null}
                      onClick={() => {
                        if (asked !== tag) return setAsked(tag);
                        setAsked(null);
                        void switchComfy(tag);
                      }}
                      data-testid="comfy-version-apply"
                    >
                      {asked === tag ? t('workflows.packs.version.confirm') : t('workflows.packs.version.apply')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
