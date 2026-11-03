// What a tool waits for when ComfyUI lacks its custom node pack: the install (it runs in the background and goes on
// when the band closes; the download dock shows it) or, once installed, the restart that loads it.
import { ArrowClockwise, DownloadSimple } from '@phosphor-icons/react';
import { t, type MessageKey } from '@/i18n';
import { usePackNeeds } from '@/state/comfy/packNeeds';
import { Button } from '@/ui';

export function PackNeeds({ pack, message }: { pack: string; message: MessageKey }) {
  const need = usePackNeeds(pack);
  return (
    <div className="toolband__needs" data-testid="tool-band-needs" data-pack={pack}>
      <span>{t(message, { pack: need.name })}</span>
      {need.has ? (
        <Button variant="solid" leftIcon={<ArrowClockwise size={14} />} isLoading={need.restarting} onClick={need.restart} data-testid="tool-band-restart">
          {t('gallery.tools.restart')}
        </Button>
      ) : (
        <Button variant="solid" leftIcon={<DownloadSimple size={14} />} isLoading={need.busy} onClick={need.install} data-testid="tool-band-install">
          {t('gallery.tools.install')}
        </Button>
      )}
      {need.error && (
        <span className="toolband__error" role="alert">
          {need.error}
        </span>
      )}
    </div>
  );
}
