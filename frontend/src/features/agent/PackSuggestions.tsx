// Cards for the extensions the assistant recommends: what each does, and a button that installs it. An id is either a
// catalog pack of novira or `ext:<folder>`, an extension of the ComfyUI Registry (or one found in ComfyUI).
import { Check, DownloadSimple, PuzzlePiece } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { t } from '@/i18n';
import { folderOfExtensionId } from '@/state/agentExtensions';
import { buildItems } from '@/state/comfy/extensionList';
import { packKey, useNodePacks } from '@/state/comfy/nodePacks';
import { PACK_CATALOG, caveatKey, packDescKey, packFolder, type CatalogPack } from '@/state/comfy/packCatalog';
import { useRegistry } from '@/state/comfy/registry';
import { Button, ProgressBar } from '@/ui';

/** What a card shows about one recommendation. */
interface Suggestion {
  key: string;
  folder: string;
  url: string;
  desc: string;
  caveat?: CatalogPack['caveat'];
}

function SuggestedPack({ pack }: { pack: Suggestion }) {
  const installed = useNodePacks((s) => s.packs?.installed.some((i) => i.url === packKey(pack.url) || i.folder === pack.folder));
  const available = useNodePacks((s) => s.packs?.available !== false);
  const restartNeeded = useNodePacks((s) => s.packs?.restartNeeded);
  const job = useNodePacks((s) => s.jobs[packKey(pack.url)]);
  const install = useNodePacks((s) => s.install);
  const restart = useNodePacks((s) => s.restart);
  const restarting = useNodePacks((s) => s.restarting);
  const busy = job?.state === 'downloading' || job?.state === 'installing';
  return (
    <li className="agent-pack" data-testid="agent-pack" data-pack={pack.key}>
      <div className="agent-pack__head">
        <PuzzlePiece size={14} />
        <strong>{pack.folder}</strong>
        {installed && (
          <span className="agent-pack__done">
            <Check size={11} weight="bold" /> {t('workflows.packs.installed')}
          </span>
        )}
      </div>
      <p>{pack.desc}</p>
      {pack.caveat && <p className="agent-pack__caveat">{t(caveatKey(pack.caveat))}</p>}
      {busy && <ProgressBar value={job.state === 'downloading' && job.totalBytes ? job.bytes / job.totalBytes : 0} indeterminate={job.state === 'installing' || !('totalBytes' in job) || !job.totalBytes} />}
      {job?.state === 'error' && <p className="agent-pack__error">{job.message}</p>}
      {available && !busy && !installed && (
        <Button size="xs" variant="solid" leftIcon={<DownloadSimple size={12} />} onClick={() => void install(pack.url)} data-testid="agent-pack-install">
          {t('workflows.packs.install')}
        </Button>
      )}
      {installed && restartNeeded && (
        <Button size="xs" variant="outline" isLoading={restarting} onClick={() => void restart()}>
          {t('workflows.packs.restart')}
        </Button>
      )}
    </li>
  );
}

/** The recommended packs, in the order the assistant gave them; ids the app does not know are skipped. */
export function PackSuggestions({ ids }: { ids: string[] }) {
  const installedPacks = useNodePacks((s) => s.packs?.installed);
  const registry = useRegistry((s) => s.nodes);
  const items = useMemo(() => (ids.some((id) => folderOfExtensionId(id)) ? buildItems(installedPacks ?? [], registry ?? []) : []), [ids, installedPacks, registry]);
  const packs = ids.flatMap((id): Suggestion[] => {
    const folder = folderOfExtensionId(id);
    if (folder) {
      const item = items.find((i) => i.folder === folder);
      return item?.url ? [{ key: id, folder, url: item.url, desc: item.catalog ? t(packDescKey(item.catalog.id)) : (item.registry?.description ?? ''), caveat: item.catalog?.caveat }] : [];
    }
    const c = PACK_CATALOG.find((p) => p.id === id);
    return c ? [{ key: id, folder: packFolder(c.url), url: c.url, desc: t(packDescKey(c.id)), caveat: c.caveat }] : [];
  });
  if (!packs.length) return null;
  return (
    <ul className="agent-packs" data-testid="agent-packs">
      {packs.map((p) => (
        <SuggestedPack key={p.key} pack={p} />
      ))}
    </ul>
  );
}
