// "Select and fix a part": click a picture to say what to select (Segment Anything 2 makes the mask), then cut the
// selection out or send the picture and the selection to the canvas to be redrawn there.
import { DownloadSimple, Eraser, GridFour, PaintBrush, Scissors, WarningCircle } from '@phosphor-icons/react';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { backend } from '@/backend';
import { t, tCount } from '@/i18n';
import { useCanvas } from '@/state/canvas';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { findImage, useGallery } from '@/state/gallery';
import { graphRequest } from '@/state/comfy/graphJob';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { usePacks } from '@/state/media/packs';
import { useSegment } from '@/state/dialogs/segment';
import { toast } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { Button, Modal, NumberInput, ProgressBar, Spinner, Switch, cx } from '@/ui';
import { cutoutBlob, loadMask, mosaicBlob, overlayUrl, transparentMaskBlob, type Mask } from './maskImage';
import { PackNeeds } from './PackNeeds';
import { RedrawPanel } from './RedrawPanel';
import { showResult } from './showResult';
import { ERASE_NODE, SEGMENT_NODE, buildEraseGraph, lamaModel, type Point } from './segmentGraph';
import { runJob, runSegmentation } from './segmentJob';

const OVERLAY: [number, number, number] = [64, 128, 255];

/** The model that makes erasing clean: offered for download, then picked up by ComfyUI without a restart. */
function LamaModel({ ready }: { ready: boolean }) {
  const pack = usePacks((s) => s.packs.inpaint);
  if (ready) return <p className="seg__hint">{t('segment.lama.ready')}</p>;
  if (pack.state === 'downloading') {
    return (
      <div className="seg__lama">
        <p className="seg__hint">{t('segment.lama.downloading', { done: Math.round(pack.bytes / 1e6), total: Math.round(pack.totalBytes / 1e6) })}</p>
        <ProgressBar value={pack.totalBytes ? pack.bytes / pack.totalBytes : 0} />
        <Button size="sm" variant="outline" onClick={() => void backend.cancelPack('inpaint')}>
          {t('common.cancel')}
        </Button>
      </div>
    );
  }
  if (pack.state === 'ready') return null;
  return (
    <div className="seg__lama" data-testid="seg-lama">
      <p className="seg__hint">{t('segment.lama.offer')}</p>
      {pack.state === 'error' && <p className="seg__error">{pack.message}</p>}
      <Button size="sm" leftIcon={<DownloadSimple size={12} />} onClick={() => void backend.installPack('inpaint')} data-testid="seg-lama-get">
        {t('segment.lama.get')}
      </Button>
    </div>
  );
}

export function SegmentDialog() {
  const imageName = useSegment((s) => s.imageName);
  const close = useSegment((s) => s.close);
  const image = useGallery((s) => (imageName ? s.images.find((i) => i.name === imageName) : undefined));
  const defsState = useComfyNodes((s) => s.status);
  const ready = useComfyNodes((s) => !!s.defs?.[SEGMENT_NODE]);
  const canErase = useComfyNodes((s) => !!s.defs?.[ERASE_NODE]);
  const lama = useComfyNodes((s) => lamaModel(s.defs));
  const lamaFile = usePacks((s) => s.packs.inpaint.state === 'ready');

  const [points, setPoints] = useState<Point[]>([]);
  const [mode, setMode] = useState<'include' | 'exclude'>('include');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mask, setMask] = useState<Mask | null>(null);
  const [maskName, setMaskName] = useState<string | null>(null);
  const [erasing, setErasing] = useState(false);
  const [invert, setInvert] = useState(false);
  // The mosaic's block edge in pixels; null follows the picture's size (about 1/40 of its short side).
  const [block, setBlock] = useState<number | null>(null);
  const [overlay, setOverlay] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const stage = useRef<HTMLDivElement>(null);

  // A fresh start for each picture.
  useEffect(() => {
    abort.current?.abort();
    setPoints([]);
    setMask(null);
    setMaskName(null);
    setOverlay(null);
    setError(null);
    setInvert(false);
    setBlock(null);
    setMode('include');
    if (imageName) {
      void useComfyNodes.getState().load();
      void useNodePacks.getState().load();
    }
  }, [imageName]);

  // ComfyUI lists a model file it did not know at start the next time its nodes are asked for.
  useEffect(() => {
    if (imageName && canErase && lamaFile && !lama) void useComfyNodes.getState().load(true);
  }, [imageName, canErase, lamaFile, lama]);

  useEffect(() => {
    if (!mask) {
      setOverlay(null);
      return;
    }
    let alive = true;
    void overlayUrl(mask, OVERLAY, invert).then((url) => {
      if (alive) setOverlay(url);
      else URL.revokeObjectURL(url);
    });
    return () => {
      alive = false;
    };
  }, [mask, invert]);

  const addPoint = (e: MouseEvent, include: boolean) => {
    if (!image || !stage.current) return;
    const r = stage.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * image.width;
    const y = ((e.clientY - r.top) / r.height) * image.height;
    setPoints((all) => [...all, { x, y, include }]);
    setMask(null);
  };

  const run = async () => {
    if (!image || !points.some((p) => p.include)) return;
    const controller = new AbortController();
    abort.current = controller;
    setRunning(true);
    setError(null);
    try {
      const picture = await runSegmentation(image.name, points, controller.signal);
      setMask(await loadMask(picture.url));
      setMaskName(picture.name);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      abort.current = null;
      setRunning(false);
    }
  };

  const cutOut = async () => {
    if (!image || !mask) return;
    try {
      const saved = await backend.uploadImage(await cutoutBlob(image.url, mask, invert), { boardId: image.boardId });
      showResult(saved.name, image.name);
      toast({ status: 'success', title: t('segment.cutoutSaved') });
    } catch (e) {
      toast({ status: 'error', title: t('segment.failed'), description: e instanceof Error ? e.message : String(e) });
    }
  };

  const mosaicBlock = block ?? (image ? Math.max(8, Math.round(Math.min(image.width, image.height) / 40)) : 16);
  const mosaic = async () => {
    if (!image || !mask) return;
    try {
      const saved = await backend.uploadImage(await mosaicBlob(image.url, mask, invert, mosaicBlock), { boardId: image.boardId });
      showResult(saved.name, image.name);
      toast({ status: 'success', title: t('segment.mosaicSaved') });
    } catch (e) {
      toast({ status: 'error', title: t('segment.failed'), description: e instanceof Error ? e.message : String(e) });
    }
  };

  const erase = async () => {
    if (!image || !mask || !maskName) return;
    const controller = new AbortController();
    abort.current = controller;
    setErasing(true);
    try {
      const graph = buildEraseGraph(image.name, maskName, { invert, lama: lamaModel(useComfyNodes.getState().defs) });
      const result = await runJob(graphRequest(graph, 'gallery', image.boardId), controller.signal);
      showResult(result.name, image.name);
      toast({ status: 'success', title: t('segment.erased') });
      close();
    } catch (e) {
      if (!controller.signal.aborted) toast({ status: 'error', title: t('segment.failed'), description: e instanceof Error ? e.message : String(e) });
    } finally {
      abort.current = null;
      setErasing(false);
    }
  };

  const toCanvas = async () => {
    if (!image || !mask) return;
    try {
      const maskPicture = await backend.uploadImage(await transparentMaskBlob(mask, invert), { boardId: null, isIntermediate: true });
      const canvas = useCanvas.getState();
      canvas.importImage(findImage(image.name) ?? image, 'newCanvasRaster');
      canvas.importImage(maskPicture, 'inpaint');
      const ui = useUi.getState();
      ui.setTab('canvas');
      ui.setMainView('canvas', 'canvas');
      close();
    } catch (e) {
      toast({ status: 'error', title: t('segment.failed'), description: e instanceof Error ? e.message : String(e) });
    }
  };

  const clear = () => {
    setPoints([]);
    setMask(null);
  };

  const includes = points.filter((p) => p.include).length;
  return (
    <Modal open={!!imageName} onOpenChange={(open) => !open && close()} size="xl" closeLabel={t('common.close')} title={t('segment.title')}>
      {!image ? null : (
        <div className="seg">
          <div
            ref={stage}
            className={cx('seg__stage', running && 'is-busy')}
            style={{ aspectRatio: `${image.width} / ${image.height}` }}
            role="img"
            aria-label={t('segment.stage')}
            data-testid="seg-stage"
            onClick={(e) => ready && !running && addPoint(e, (mode === 'include') !== e.shiftKey)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (ready && !running) addPoint(e, false);
            }}
          >
            <img className="seg__img" src={image.url} alt="" draggable={false} />
            {overlay && <img className="seg__overlay" src={overlay} alt="" draggable={false} data-testid="seg-overlay" />}
            {points.map((p, i) => (
              <button
                key={i}
                type="button"
                className={cx('seg__point', p.include ? 'is-include' : 'is-exclude')}
                style={{ left: `${(p.x / image.width) * 100}%`, top: `${(p.y / image.height) * 100}%` }}
                aria-label={t('segment.point.remove')}
                title={t('segment.point.remove')}
                data-testid="seg-point"
                onClick={(e) => {
                  e.stopPropagation();
                  setPoints((all) => all.filter((_, k) => k !== i));
                  setMask(null);
                }}
                onContextMenu={(e) => e.stopPropagation()}
              />
            ))}
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
                  <Spinner size={14} /> {t('segment.loading')}
                </p>
              ) : (
                <PackNeeds id="sam2" message="segment.needsPack" install="segment.install" restart="segment.restart" />
              )
            ) : (
              <>
                <p className="seg__hint">{t('segment.hint')}</p>
                <div className="seg__modes" role="group">
                  {(['include', 'exclude'] as const).map((m) => (
                    <button key={m} type="button" className={cx('seg__mode', `is-${m}`, mode === m && 'is-on')} onClick={() => setMode(m)} aria-pressed={mode === m} data-testid={`seg-mode-${m}`}>
                      {t(`segment.mode.${m}`)}
                    </button>
                  ))}
                </div>
                <span className="seg__count">{tCount('segment.points', points.length)}</span>
                <div className="seg__row">
                  <Button variant="solid" scheme="invoke" disabled={includes === 0 || running} isLoading={running} onClick={() => void run()} data-testid="seg-run">
                    {running ? t('segment.running') : mask ? t('segment.again') : t('segment.run')}
                  </Button>
                  {running && (
                    <Button variant="outline" onClick={() => abort.current?.abort()} data-testid="seg-cancel">
                      {t('common.cancel')}
                    </Button>
                  )}
                  <Button variant="ghost" disabled={points.length === 0 || running} onClick={clear} data-testid="seg-clear">
                    {t('segment.clear')}
                  </Button>
                </div>
                {running && <p className="seg__hint">{t('segment.firstRun')}</p>}
                {error && (
                  <p className="seg__error" role="alert">
                    <WarningCircle size={14} /> {t('segment.failed')}: {error}
                  </p>
                )}
                {mask && (
                  <div className="seg__result" data-testid="seg-result">
                    <p className="seg__hint">{t('segment.done')}</p>
                    <label className="seg__invert">
                      <Switch checked={invert} onChange={setInvert} aria-label={t('segment.invert')} />
                      <span>{t('segment.invert')}</span>
                    </label>
                    <Button leftIcon={<Scissors size={14} />} disabled={erasing} onClick={() => void cutOut()} data-testid="seg-cutout">
                      {t('segment.cutout')}
                    </Button>
                    <div className="seg__mosaic">
                      <Button leftIcon={<GridFour size={14} />} disabled={erasing} onClick={() => void mosaic()} data-testid="seg-mosaic">
                        {t('segment.mosaic')}
                      </Button>
                      <NumberInput value={mosaicBlock} onChange={(v) => setBlock(Math.max(2, Math.min(256, Math.round(v))))} min={2} max={256} aria-label={t('segment.mosaicBlock')} data-testid="seg-mosaic-block" />
                    </div>
                    <Button leftIcon={<PaintBrush size={14} />} disabled={erasing} onClick={() => void toCanvas()} data-testid="seg-canvas">
                      {t('segment.toCanvas')}
                    </Button>
                    {canErase ? (
                      <>
                        <Button leftIcon={<Eraser size={14} />} isLoading={erasing} disabled={erasing} onClick={() => void erase()} data-testid="seg-erase">
                          {erasing ? t('segment.erasing') : t('segment.erase')}
                        </Button>
                        <p className="seg__hint">{t('segment.eraseHint')}</p>
                        <LamaModel ready={!!lama} />
                        {erasing && (
                          <Button variant="outline" onClick={() => abort.current?.abort()} data-testid="seg-erase-cancel">
                            {t('common.cancel')}
                          </Button>
                        )}
                      </>
                    ) : (
                      <PackNeeds id="inpaintNodes" message="segment.eraseNeedsPack" install="segment.install" restart="segment.restart" />
                    )}
                    {maskName && <RedrawPanel image={image} maskName={maskName} invert={invert} disabled={erasing} onDone={close} />}
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
