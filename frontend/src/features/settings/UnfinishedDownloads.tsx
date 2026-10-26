// Settings → Data: the partial files that interrupted downloads left in the data folder. They are kept so a download can
// continue, so deleting one makes that download start again. A file in use stays, and the reply says which ones.
import { useEffect, useState } from 'react';
import { backend, type UnfinishedDownload } from '@/backend';
import { t } from '@/i18n';
import { formatPackSize } from '@/state/media/packs';
import { toast } from '@/state/toasts';
import { Button } from '@/ui';
import { Row, SectionBlock } from './settingsLayout';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** A kept size in kilobytes under a megabyte (a stopped download is often small), otherwise the pack size format. */
function formatKept(bytes: number): string {
  return bytes < 1_000_000 ? `${Math.round(bytes / 1_000)} KB` : formatPackSize(bytes);
}

/** The folder part of a relative path: `comfyui/.downloads` for `comfyui/.downloads/comfyui.part`, empty at the top. */
function folderOf(path: string): string {
  const cut = path.lastIndexOf('/');
  return cut < 0 ? '' : path.slice(0, cut);
}

export function UnfinishedDownloads() {
  // Null until the list has come back, so the empty line does not show before the answer.
  const [items, setItems] = useState<UnfinishedDownload[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let live = true;
    backend
      .listUnfinishedDownloads()
      .then((list) => {
        if (live) setItems(list);
      })
      .catch((e: unknown) => {
        toast({ status: 'error', title: t('settings.unfinished.loadFailed'), description: errorText(e) });
      });
    return () => {
      live = false;
    };
  }, []);

  const remove = async (paths: string[]) => {
    setBusy(true);
    try {
      const remaining = await backend.deleteUnfinishedDownloads(paths);
      setItems(remaining);
      setConfirming(false);
      const kept = remaining.filter((u) => paths.includes(u.path));
      if (kept.length) toast({ status: 'warning', title: t('settings.unfinished.keptInUse'), description: kept.map((u) => u.name).join(', ') });
      else toast({ status: 'success', title: t('settings.unfinished.deleted') });
    } catch (e) {
      toast({ status: 'error', title: t('settings.unfinished.deleteFailed'), description: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const hasItems = items !== null && items.length > 0;
  return (
    <SectionBlock title={t('settings.section.unfinished')}>
      <div className="st-group" data-testid="settings-unfinished">
        <Row label={t('settings.unfinished.title')} help={t('settings.unfinished.help')} note={items !== null && items.length === 0 ? t('settings.unfinished.empty') : undefined}>
          {hasItems &&
            (confirming ? (
              <div className="st-inline">
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
                  {t('common.cancel')}
                </Button>
                <Button size="sm" scheme="danger" isLoading={busy} onClick={() => void remove(items.map((u) => u.path))} data-testid="settings-unfinished-confirm">
                  {t('settings.unfinished.confirm')}
                </Button>
              </div>
            ) : (
              <Button size="sm" scheme="danger" disabled={busy} onClick={() => setConfirming(true)} data-testid="settings-unfinished-delete-all">
                {t('settings.unfinished.deleteAll')}
              </Button>
            ))}
        </Row>
        {items !== null && items.length > 0 && (
          <ul className="st-roots" data-testid="settings-unfinished-list">
            {items.map((u, index) => (
              <li key={u.path} data-testid={`settings-unfinished-row-${index}`}>
                <Row label={u.name} note={folderOf(u.path) || undefined}>
                  <div className="st-inline">
                    <span className="st-row__help">{formatKept(u.bytes)}</span>
                    <Button size="sm" variant="outline" scheme="danger" disabled={busy} onClick={() => void remove([u.path])} data-testid={`settings-unfinished-delete-${index}`}>
                      {t('settings.unfinished.delete')}
                    </Button>
                  </div>
                </Row>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionBlock>
  );
}
