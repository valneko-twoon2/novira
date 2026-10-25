// "Process several at once": one operation on every selected picture. Each picture becomes one queue item, so the
// Queue tab shows the progress and the results appear in the gallery, on the board of their source.
import { ArrowClockwise, DownloadSimple } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { backend } from '@/backend';
import { t, tCount, type MessageKey } from '@/i18n';
import { useBatch } from '@/state/dialogs/batch';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { useGallery } from '@/state/gallery';
import { graphRequest } from '@/state/comfy/graphJob';
import { useModels } from '@/state/models';
import { usePackNeeds } from '@/state/comfy/packNeeds';
import { toast } from '@/state/toasts';
import { Button, Modal, Select } from '@/ui';
import { BATCH_OPS, RMBG_NODE, RMBG_PACK, removeBackgroundGraph, upscaleGraph, type BatchOp } from './batchGraph';

const opKey = (op: BatchOp) => `batch.op.${op}.title` as MessageKey;

function PackNeeds() {
  const need = usePackNeeds(RMBG_PACK);
  return (
    <div className="batch__needs" data-testid="batch-needs">
      <p>{t('batch.needsPack', { pack: need.name })}</p>
      {need.has ? (
        <Button variant="solid" leftIcon={<ArrowClockwise size={14} />} isLoading={need.restarting} onClick={need.restart}>
          {t('batch.restart')}
        </Button>
      ) : (
        <Button variant="solid" leftIcon={<DownloadSimple size={14} />} isLoading={need.busy} onClick={need.install} data-testid="batch-install">
          {t('batch.install')}
        </Button>
      )}
      {need.error && <p className="batch__error">{need.error}</p>}
    </div>
  );
}

export function BatchDialog() {
  const names = useBatch((s) => s.names);
  const close = useBatch((s) => s.close);
  const all = useGallery((s) => s.images);
  const pictures = useMemo(() => (names ? all.filter((i) => names.includes(i.name) && (i.mediaType ?? 'image') === 'image') : []), [names, all]);
  const [op, setOp] = useState<BatchOp>('removeBackground');
  const [upscalerKey, setUpscalerKey] = useState<string | null>(null);
  const models = useModels((s) => s.models);
  const upscalers = useMemo(() => models.filter((m) => m.type === 'spandrel_image_to_image'), [models]);
  const upscaler = upscalers.find((m) => m.key === upscalerKey) ?? upscalers[0];
  const hasRmbg = useComfyNodes((s) => !!s.defs?.[RMBG_NODE]);
  const [busy, setBusy] = useState(false);

  const blocked = op === 'removeBackground' ? !hasRmbg : !upscaler;
  const run = async () => {
    if (blocked || pictures.length === 0) return;
    setBusy(true);
    try {
      const label = t(opKey(op));
      for (const picture of pictures) {
        const graph = op === 'removeBackground' ? removeBackgroundGraph(picture.name) : upscaleGraph(picture.name, upscaler!.key);
        await backend.enqueue(graphRequest(graph, 'gallery', picture.boardId, { generationMode: 'graph', width: picture.width, height: picture.height, workflowName: label }));
      }
      toast({ status: 'success', title: tCount('batch.queued', pictures.length) });
      close();
    } catch (e) {
      toast({ status: 'error', title: t('batch.failed'), description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!names} onOpenChange={(open) => !open && close()} size="md" closeLabel={t('common.close')} title={t('batch.title')}>
      <div className="batch" data-testid="batch">
        <p className="batch__count">{tCount('batch.count', pictures.length)}</p>
        <div className="batch__thumbs">
          {pictures.slice(0, 12).map((p) => (
            <img key={p.name} src={p.thumbnailUrl} alt="" draggable={false} />
          ))}
        </div>
        <div className="batch__ops" role="radiogroup" aria-label={t('batch.op')}>
          {BATCH_OPS.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={op === o} className={op === o ? 'batch__op is-on' : 'batch__op'} onClick={() => setOp(o)} data-testid={`batch-op-${o}`}>
              <strong>{t(opKey(o))}</strong>
            </button>
          ))}
        </div>
        {op === 'upscale' &&
          (upscalers.length ? (
            <Select value={upscaler?.key ?? null} onChange={setUpscalerKey} options={upscalers.map((m) => ({ value: m.key, label: m.name }))} aria-label={t('batch.upscaler')} />
          ) : (
            <p className="batch__error">{t('batch.noUpscaler')}</p>
          ))}
        {op === 'removeBackground' && !hasRmbg && <PackNeeds />}
        <div className="batch__footer">
          <Button variant="outline" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button variant="solid" scheme="invoke" disabled={blocked || pictures.length === 0 || busy} isLoading={busy} onClick={() => void run()} data-testid="batch-run">
            {t('batch.run')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
