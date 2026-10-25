// Shown under the reference images while their node pack (ComfyUI_IPAdapter_plus) is missing: install it, or restart
// ComfyUI once it is installed. Nothing is shown while the pack list is unknown or the pack is loaded.
import { ArrowClockwise, DownloadSimple } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { t } from '@/i18n';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { packFolder } from '@/state/comfy/packCatalog';
import { IPADAPTER_PACK, packMissing, usePackNeeds } from '@/state/comfy/packNeeds';
import { useParams } from '@/state/params';
import { Button } from '@/ui';

export function RefImagePackNeeds() {
  const enabled = useParams((s) => s.refImages.some((r) => r.isEnabled));
  const packs = useNodePacks((s) => s.packs);
  const missing = packMissing(IPADAPTER_PACK, { packs });
  const need = usePackNeeds(IPADAPTER_PACK);
  // Installed in this session and not loaded until ComfyUI restarts.
  const justInstalled = useNodePacks((s) => !!s.packs?.restartNeeded && Object.entries(s.jobs).some(([url, job]) => packFolder(url) === need.name && job.state === 'ready'));

  useEffect(() => {
    if (enabled && !useNodePacks.getState().packs) void useNodePacks.getState().load();
  }, [enabled]);

  if (!enabled || !(missing || justInstalled)) return null;
  return (
    <div className="pp-refs__needs" data-testid="ref-pack-needs">
      <p>{t('params.refImage.needsPack', { pack: need.name })}</p>
      {need.has ? (
        <Button size="sm" variant="outline" leftIcon={<ArrowClockwise size={12} />} isLoading={need.restarting} onClick={need.restart}>
          {t('params.refImage.restartEngine')}
        </Button>
      ) : (
        <Button size="sm" variant="outline" leftIcon={<DownloadSimple size={12} />} isLoading={need.busy} onClick={need.install} data-testid="ref-pack-install">
          {t('params.refImage.installPack')}
        </Button>
      )}
      {need.error && <p className="pp-refs__error">{need.error}</p>}
    </div>
  );
}
