// Detail panel of the extension manager: author, licence, source, versions and install / remove of one extension.
import { ArrowSquareOut, DownloadSimple, Sparkle, Warning, X } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { backend, type NodePackInfo } from '@/backend';
import { t } from '@/i18n';
import { toast } from '@/state/toasts';
import { useAgent } from '@/state/agent';
import type { ExtensionItem } from '@/state/comfy/extensionList';
import { packKey, useNodePacks } from '@/state/comfy/nodePacks';
import { caveatKey, packDescKey } from '@/state/comfy/packCatalog';
import { Badge, Button, IconButton } from '@/ui';
import { ComfyVersions } from './ComfyVersions';
import { PackVersions, versionLabel } from './PackVersions';
import { JobLine, RemoveButton } from './PacksView';

/** What GitHub says about a repository (loaded once the panel is open). */
function useRepoInfo(url: string | null): { info: NodePackInfo | null; failed: boolean } {
  const [state, setState] = useState<{ url: string | null; info: NodePackInfo | null; failed: boolean }>({ url: null, info: null, failed: false });
  useEffect(() => {
    if (!url) return;
    let live = true;
    backend.nodePackInfo(url).then(
      (info) => live && setState({ url, info, failed: false }),
      () => live && setState({ url, info: null, failed: true }),
    );
    return () => {
      live = false;
    };
  }, [url]);
  return state.url === url ? state : { info: null, failed: false };
}

/** The system browser opens the page, after the backend has checked the address (a link would do nothing in the desktop window). */
function openSource(url: string) {
  if (backend.kind === 'mock') {
    toast({ status: 'info', title: t('browse.toast.openMock'), description: url }, 2200);
    return;
  }
  backend.openSourcePage(url).catch((e: unknown) => {
    toast({ status: 'error', title: t('browse.toast.openFailed'), description: e instanceof Error ? e.message : String(e) });
  });
}

function licenseText(item: ExtensionItem, info: NodePackInfo | null, failed: boolean): string {
  const known = item.catalog?.license ?? item.registry?.license ?? info?.license;
  if (known) return known;
  if (!item.url) return t('workflows.packs.mgr.authorUnknown');
  if (failed) return t('workflows.packs.mgr.licenseFailed');
  return info ? t('workflows.packs.mgr.licenseNone') : t('workflows.packs.mgr.licenseChecking');
}

export function ExtensionDetail({ item, onClose }: { item: ExtensionItem; onClose: () => void }) {
  const job = useNodePacks((s) => (item.url ? s.jobs[packKey(item.url)] : undefined));
  const install = useNodePacks((s) => s.install);
  const cancel = useNodePacks((s) => s.cancel);
  const { info, failed } = useRepoInfo(item.url);
  const busy = job?.state === 'downloading' || job?.state === 'installing';
  const url = item.url;
  const desc = item.catalog ? t(packDescKey(item.catalog.id)) : (item.registry?.description || info?.description || t('workflows.packs.manage.custom'));
  return (
    <aside className="ex-detail" data-testid="extension-detail" aria-label={item.folder}>
      <div className="ex-detail__top">
        <strong className="ex-detail__name">{item.folder}</strong>
        <IconButton size="sm" variant="ghost" label={t('workflows.packs.mgr.close')} onClick={onClose} icon={<X size={14} />} />
      </div>
      <div className="ex-detail__scroll">
        <p className="ex-detail__desc">{desc}</p>
        {item.catalog?.caveat && (
          <p className="wf-pack__caveat">
            <Warning size={12} /> {t(caveatKey(item.catalog.caveat))}
          </p>
        )}
        <dl className="ex-facts">
          <dt>{t('workflows.packs.mgr.author')}</dt>
          <dd data-testid="extension-author">{item.author ?? t('workflows.packs.mgr.authorUnknown')}</dd>
          <dt>{t('workflows.packs.mgr.license')}</dt>
          <dd data-testid="extension-license">{licenseText(item, info, failed)}</dd>
          <dt>{t('workflows.packs.version.label')}</dt>
          <dd data-testid="extension-version">{item.installed ? versionLabel(item.installed) : '—'}</dd>
          {item.registry && (
            <>
              <dt>{t('workflows.packs.mgr.latest')}</dt>
              <dd>{item.registry.version ?? '—'}</dd>
              <dt>{t('workflows.packs.mgr.updated')}</dt>
              <dd>{item.registry.updated ?? '—'}</dd>
              <dt>{t('workflows.packs.mgr.downloads')}</dt>
              <dd>{item.registry.downloads.toLocaleString()}</dd>
              <dt>{t('workflows.packs.mgr.stars')}</dt>
              <dd>{item.registry.stars.toLocaleString()}</dd>
            </>
          )}
          <dt>{t('workflows.packs.mgr.source')}</dt>
          <dd>
            {url ? (
              <button type="button" className="ex-link" onClick={() => openSource(url)} data-testid="extension-source">
                {url.replace('https://github.com/', '')} <ArrowSquareOut size={11} />
              </button>
            ) : (
              t('workflows.packs.mgr.byHand')
            )}
          </dd>
        </dl>
        {job && <JobLine status={job} />}
        <div className="ex-detail__actions">
          {url &&
            (busy ? (
              <Button size="sm" variant="outline" onClick={() => void cancel(packKey(url))}>
                {t('common.cancel')}
              </Button>
            ) : (
              <Button size="sm" variant={item.installed ? 'outline' : 'solid'} leftIcon={<DownloadSimple size={13} />} onClick={() => void install(url)} data-testid="extension-install">
                {item.installed ? t('workflows.packs.reinstall') : t('workflows.packs.install')}
              </Button>
            ))}
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Sparkle size={13} />}
            onClick={() => useAgent.getState().ask(t('agent.ask.pack', { name: item.folder }), [item.folder])}
            data-testid="extension-ask"
          >
            {t('agent.ask.button')}
          </Button>
          {item.installed && !busy && <RemoveButton folder={item.installed.folder} />}
          {item.installed && <Badge scheme="success">{t('workflows.packs.installed')}</Badge>}
        </div>
        {item.installed && <PackVersions pack={item.installed} />}
      </div>
    </aside>
  );
}

/** Detail panel of ComfyUI itself: its version and the releases it can be switched to. */
export function ComfyDetail({ version, onClose }: { version: string; onClose: () => void }) {
  return (
    <aside className="ex-detail" data-testid="comfy-detail" aria-label={t('workflows.packs.version.comfyTitle')}>
      <div className="ex-detail__top">
        <strong className="ex-detail__name">{t('workflows.packs.version.comfyTitle')}</strong>
        <IconButton size="sm" variant="ghost" label={t('workflows.packs.mgr.close')} onClick={onClose} icon={<X size={14} />} />
      </div>
      <div className="ex-detail__scroll">
        <p className="ex-detail__desc">{t('workflows.packs.mgr.comfyDesc')}</p>
        <dl className="ex-facts">
          <dt>{t('workflows.packs.version.label')}</dt>
          <dd>{version}</dd>
        </dl>
        <ComfyVersions />
      </div>
    </aside>
  );
}
