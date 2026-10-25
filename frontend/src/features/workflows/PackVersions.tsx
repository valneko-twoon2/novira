// Version control of one installed extension: the version it is at, the versions its repository offers (the tags) and a
// "not recommended" mark on a version that an installed extension, or ComfyUI, is known not to support.
import { useEffect, useState } from 'react';
import { backend, type InstalledNodePack } from '@/backend';
import { t } from '@/i18n';
import { packKey, useNodePacks } from '@/state/comfy/nodePacks';
import { catalogPackOf } from '@/state/comfy/packCatalog';
import { conflictsFor } from '@/state/comfy/versions';
import { Badge, Button } from '@/ui';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The version a pack is at, as the screen shows it. */
export function versionLabel(pack: InstalledNodePack): string {
  if (pack.version) return pack.version;
  return pack.url ? t('workflows.packs.version.latest') : t('workflows.packs.version.unknown');
}

export function PackVersions({ pack }: { pack: InstalledNodePack }) {
  const installed = useNodePacks((s) => s.packs?.installed ?? []);
  const comfyVersion = useNodePacks((s) => s.packs?.comfyVersion ?? null);
  const job = useNodePacks((s) => (pack.url ? s.jobs[packKey(pack.url)] : undefined));
  const install = useNodePacks((s) => s.install);
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const known = catalogPackOf(pack);
  const busy = job?.state === 'downloading' || job?.state === 'installing';

  const url = pack.url;
  // The versions are looked up as soon as the pack is shown, so a pack whose repository has no tags shows no version control at all.
  useEffect(() => {
    setTags(null);
    setError(null);
    setOpen(false);
    if (!url) return;
    let live = true;
    backend.nodePackVersions(url).then(
      (list) => live && setTags(list),
      (e) => {
        if (!live) return;
        setError(message(e));
        setTags([]);
      },
    );
    return () => {
      live = false;
    };
  }, [url]);

  if (!url) return <span className="wf-ext__note">{t('workflows.packs.version.byHand')}</span>;
  if (tags === null) return <span className="wf-ext__note">{t('workflows.packs.version.loading')}</span>;
  if (tags.length === 0 && !error) return null;
  const toggle = () => setOpen(!open);

  return (
    <div className="wf-ver" data-testid="pack-versions">
      <Button size="xs" variant="ghost" onClick={toggle} aria-expanded={open} data-testid="pack-version-toggle">
        {open ? t('workflows.packs.version.hide') : t('workflows.packs.version.change')}
      </Button>
      {open && (
        <div className="wf-ver__panel">
          {error && <p className="wf-packs__error">{error}</p>}
          {job?.state === 'error' && <p className="wf-packs__error">{job.message}</p>}
          <ul className="wf-ver__list">
            {tags?.map((tag) => {
              const names = known
                ? conflictsFor({ kind: 'pack', id: known.id }, tag, installed, comfyVersion).map((c) => (c.kind === 'comfyui' ? 'ComfyUI' : c.folder))
                : [];
              const current = pack.version === tag;
              return (
                <li key={tag} className="wf-ver__row" data-testid="pack-version-row">
                  <span className="wf-ver__tag">{tag}</span>
                  {current && <Badge scheme="success">{t('workflows.packs.installed')}</Badge>}
                  {names.length > 0 && (
                    <span className="wf-ver__warn" data-testid="pack-version-deprecated">
                      <Badge scheme="warning">{t('workflows.packs.version.deprecated')}</Badge>
                      <span>{t('workflows.packs.version.deprecatedBy', { names: [...new Set(names)].join(', ') })}</span>
                    </span>
                  )}
                  {!current && (
                    <Button size="xs" variant="outline" disabled={busy} onClick={() => void install(url, tag)} data-testid="pack-version-apply">
                      {t('workflows.packs.version.apply')}
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
