// What a step waits for before it can run: its custom node pack must be installed and loaded in ComfyUI.
import { ArrowClockwise, DownloadSimple } from '@phosphor-icons/react';
import { t, type MessageKey } from '@/i18n';
import { usePackNeeds } from '@/state/comfy/packNeeds';
import { Button } from '@/ui';

/** `id` is a catalog id; `message` is the sentence that says what the pack is needed for (it takes `{pack}`). */
export function PackNeeds({ id, message, install, restart }: { id: 'sam2' | 'inpaintNodes' | 'rmbg'; message: MessageKey; install: MessageKey; restart: MessageKey }) {
  const need = usePackNeeds(id);
  return (
    <div className="seg__needs" data-testid="seg-needs">
      <p>{t(message, { pack: need.name })}</p>
      {need.has ? (
        <Button variant="solid" leftIcon={<ArrowClockwise size={14} />} isLoading={need.restarting} onClick={need.restart}>
          {t(restart)}
        </Button>
      ) : (
        <Button variant="solid" leftIcon={<DownloadSimple size={14} />} isLoading={need.busy} onClick={need.install} data-testid={`seg-install-${id}`}>
          {t(install)}
        </Button>
      )}
      {need.error && <p className="seg__error">{need.error}</p>}
    </div>
  );
}
