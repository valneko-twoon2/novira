// "Finish the clip": smooth the motion and/or enlarge a finished video. The result is a new video next to the source.
import { ArrowClockwise, DownloadSimple } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { useFinish } from '@/state/dialogs/finish';
import { useGallery } from '@/state/gallery';
import { graphRequest } from '@/state/comfy/graphJob';
import { useModels } from '@/state/models';
import { usePackNeeds } from '@/state/comfy/packNeeds';
import { toast } from '@/state/toasts';
import { Button, Checkbox, Modal, Select } from '@/ui';
import { RIFE_NODE, RIFE_PACK, finishGraph } from './finishGraph';

function PackNeeds() {
  const need = usePackNeeds(RIFE_PACK);
  return (
    <div className="finish__needs" data-testid="finish-needs">
      <p>{t('finish.needsPack', { pack: need.name })}</p>
      {need.has ? (
        <Button variant="solid" leftIcon={<ArrowClockwise size={14} />} isLoading={need.restarting} onClick={need.restart}>
          {t('finish.restart')}
        </Button>
      ) : (
        <Button variant="solid" leftIcon={<DownloadSimple size={14} />} isLoading={need.busy} onClick={need.install} data-testid="finish-install">
          {t('finish.install')}
        </Button>
      )}
      {need.error && <p className="finish__error">{need.error}</p>}
    </div>
  );
}

export function FinishDialog() {
  const name = useFinish((s) => s.name);
  const close = useFinish((s) => s.close);
  const clip = useGallery((s) => s.images.find((i) => i.name === name));
  const defs = useComfyNodes((s) => s.defs);
  const hasRife = !!defs?.[RIFE_NODE];
  const models = useModels((s) => s.models);
  const upscalers = useMemo(() => models.filter((m) => m.type === 'spandrel_image_to_image'), [models]);
  const [smooth, setSmooth] = useState(true);
  const [enlarge, setEnlarge] = useState(false);
  const [upscalerKey, setUpscalerKey] = useState<string | null>(null);
  const upscaler = upscalers.find((m) => m.key === upscalerKey) ?? upscalers[0];
  const [busy, setBusy] = useState(false);

  const blocked = (!smooth && !enlarge) || (smooth && !hasRife) || (enlarge && !upscaler);
  const run = async () => {
    if (!clip || blocked) return;
    setBusy(true);
    try {
      const meta = clip.metadata;
      const fps = meta?.videoFps ?? 24;
      const graph = finishGraph({ name: clip.name, width: clip.width, height: clip.height, fps }, { smooth, upscale: enlarge && upscaler ? { modelKey: upscaler.key } : null }, defs ?? undefined);
      const frames = (meta?.videoFrames ?? 0) * (smooth ? 2 : 1);
      await backend.enqueue(
        graphRequest(graph, 'gallery', clip.boardId, {
          generationMode: 'graph',
          positivePrompt: meta?.positivePrompt ?? '',
          width: clip.width * (enlarge ? 2 : 1),
          height: clip.height * (enlarge ? 2 : 1),
          videoFps: fps * (smooth ? 2 : 1),
          ...(frames ? { videoFrames: frames } : {}),
          workflowName: t('finish.title'),
        }),
      );
      toast({ status: 'success', title: t('finish.queued') });
      close();
    } catch (e) {
      toast({ status: 'error', title: t('finish.failed'), description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!name} onOpenChange={(open) => !open && close()} size="md" closeLabel={t('common.close')} title={t('finish.title')}>
      <div className="finish" data-testid="finish">
        {clip && <video className="finish__clip" src={clip.url} poster={clip.thumbnailUrl} muted loop playsInline controls preload="metadata" />}
        <label className="finish__op">
          <Checkbox checked={smooth} onChange={setSmooth} label={t('finish.smooth.title')} />
          <span>{t('finish.smooth.desc')}</span>
        </label>
        {smooth && !hasRife && <PackNeeds />}
        <label className="finish__op">
          <Checkbox checked={enlarge} onChange={setEnlarge} label={t('finish.enlarge.title')} />
          <span>{t('finish.enlarge.desc')}</span>
        </label>
        {enlarge &&
          (upscalers.length ? (
            <Select value={upscaler?.key ?? null} onChange={setUpscalerKey} options={upscalers.map((m) => ({ value: m.key, label: m.name }))} aria-label={t('finish.upscaler')} />
          ) : (
            <p className="finish__error">{t('finish.noUpscaler')}</p>
          ))}
        <p className="finish__note">{t('finish.note')}</p>
        <div className="finish__footer">
          <Button variant="outline" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button variant="solid" scheme="invoke" disabled={blocked || busy} isLoading={busy} onClick={() => void run()} data-testid="finish-run">
            {t('finish.run')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
