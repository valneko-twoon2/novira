// "Remove the background": one button turns a picture into the same picture with a transparent background (the RMBG
// node finds the subject on its own, no clicks needed). The result is saved next to the original.
import { Crop, Eye, WarningCircle } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { CUTOUT_NODE, buildCutoutGraph, cutoutModels } from '@/state/comfy/cutout';
import { graphRequest } from '@/state/comfy/graphJob';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { useCutout } from '@/state/dialogs/cutout';
import { useGallery } from '@/state/gallery';
import { trimTransparent } from '@/state/trim';
import { toast } from '@/state/toasts';
import { Button, Modal, Select, SliderNumber, Spinner, cx } from '@/ui';
import { PackNeeds } from './PackNeeds';
import { runJob } from './segmentJob';
import { showResult } from './showResult';

export function CutoutDialog() {
  const imageName = useCutout((s) => s.imageName);
  const close = useCutout((s) => s.close);
  const image = useGallery((s) => (imageName ? s.images.find((i) => i.name === imageName) : undefined));
  const defsState = useComfyNodes((s) => s.status);
  const defs = useComfyNodes((s) => s.defs);
  const ready = !!defs?.[CUTOUT_NODE];
  const models = useMemo(() => cutoutModels(defs), [defs]);

  const [model, setModel] = useState<string | null>(null);
  const [sensitivity, setSensitivity] = useState(1);
  const [edge, setEdge] = useState(0);
  const [background, setBackground] = useState<'alpha' | 'white'>('alpha');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImageDTO | null>(null);
  const abort = useRef<AbortController | null>(null);
  const chosen = model && models.includes(model) ? model : models[0];

  // A fresh start for each picture.
  useEffect(() => {
    abort.current?.abort();
    setResult(null);
    setError(null);
    if (imageName) {
      void useComfyNodes.getState().load();
      void useNodePacks.getState().load();
    }
  }, [imageName]);

  const run = async () => {
    if (!image || !chosen) return;
    const controller = new AbortController();
    abort.current = controller;
    setRunning(true);
    setError(null);
    try {
      const graph = buildCutoutGraph(image.name, { model: chosen, sensitivity, edge, background });
      const picture = await runJob(graphRequest(graph, 'gallery', image.boardId, { width: image.width, height: image.height }), controller.signal);
      setResult(picture);
      toast({ status: 'success', title: t('cutout.saved') });
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      abort.current = null;
      setRunning(false);
    }
  };

  const open = () => {
    if (!image || !result) return;
    showResult(result.name, image.name);
    close();
  };

  return (
    <Modal open={!!imageName} onOpenChange={(o) => !o && close()} size="xl" closeLabel={t('common.close')} title={t('cutout.title')}>
      {!image ? null : (
        <div className="seg">
          <div className={cx('seg__stage', 'seg__stage--checker', running && 'is-busy')} style={{ aspectRatio: `${image.width} / ${image.height}` }} role="img" aria-label={result ? t('cutout.result') : t('cutout.stage')} data-testid="cutout-stage">
            <img className="seg__img" src={result ? result.url : image.url} alt="" draggable={false} data-testid={result ? 'cutout-result' : undefined} />
            {running && (
              <span className="seg__busy" aria-hidden>
                <Spinner size={22} />
              </span>
            )}
          </div>
          <aside className="seg__side">
            {!ready ? (
              defsState === 'loading' || defsState === 'idle' ? (
                <p className="seg__hint">
                  <Spinner size={14} /> {t('cutout.loading')}
                </p>
              ) : (
                <PackNeeds id="rmbg" message="cutout.needsPack" install="cutout.install" restart="cutout.restart" />
              )
            ) : (
              <>
                <Select value={chosen ?? ''} onChange={setModel} options={models.map((m) => ({ value: m, label: m }))} disabled={running} aria-label={t('cutout.model')} />
                <label className="seg__row2">
                  <span>{t('cutout.sensitivity')}</span>
                  <SliderNumber value={sensitivity} onChange={setSensitivity} min={0.1} max={1} step={0.05} precision={2} disabled={running} aria-label={t('cutout.sensitivity')} />
                  <span className="seg__hint">{t('cutout.sensitivityHint')}</span>
                </label>
                <label className="seg__row2">
                  <span>{t('cutout.edge')}</span>
                  <SliderNumber value={edge} onChange={setEdge} min={-10} max={10} step={1} precision={0} disabled={running} aria-label={t('cutout.edge')} />
                  <span className="seg__hint">{t('cutout.edgeHint')}</span>
                </label>
                <label className="seg__row2">
                  <span>{t('cutout.background')}</span>
                  <Select
                    value={background}
                    onChange={(v) => setBackground(v === 'white' ? 'white' : 'alpha')}
                    options={[
                      { value: 'alpha', label: t('cutout.background.alpha') },
                      { value: 'white', label: t('cutout.background.white') },
                    ]}
                    disabled={running}
                    aria-label={t('cutout.background')}
                  />
                </label>
                <div className="seg__row">
                  <Button variant="solid" scheme="invoke" disabled={!chosen || running} isLoading={running} onClick={() => void run()} data-testid="cutout-run">
                    {running ? t('cutout.running') : result ? t('cutout.again') : t('cutout.run')}
                  </Button>
                  {running && (
                    <Button variant="outline" onClick={() => abort.current?.abort()} data-testid="cutout-cancel">
                      {t('common.cancel')}
                    </Button>
                  )}
                </div>
                {running && <p className="seg__hint">{t('cutout.firstRun')}</p>}
                {error && (
                  <p className="seg__error" role="alert">
                    <WarningCircle size={14} /> {t('cutout.failed')}: {error}
                  </p>
                )}
                {result && (
                  <div className="seg__result" data-testid="cutout-done">
                    <p className="seg__hint">{t('cutout.done')}</p>
                    <Button leftIcon={<Eye size={14} />} onClick={open} data-testid="cutout-open">
                      {t('cutout.open')}
                    </Button>
                    {background === 'alpha' && (
                      <Button leftIcon={<Crop size={14} />} onClick={() => void trimTransparent(result)} data-testid="cutout-trim">
                        {t('cutout.trim')}
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
      )}
    </Modal>
  );
}
