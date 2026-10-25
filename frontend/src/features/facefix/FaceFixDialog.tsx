// "Fix the face": the Impact Pack finds every face in the picture and draws it again at a higher resolution with the
// picture's own model and prompt, which cleans up the small, misshapen faces of a wide picture. The result is saved
// next to the original.
import { ArrowClockwise, DownloadSimple, Eye, WarningCircle } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { DETECTOR_NODE, FACE_NODE, buildFaceFixGraph, faceDetectors } from '@/state/comfy/faceFix';
import { graphRequest } from '@/state/comfy/graphJob';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { usePackNeeds } from '@/state/comfy/packNeeds';
import { runJob } from '@/state/comfy/runGraph';
import { useFaceFixDialog } from '@/state/dialogs/facefix';
import { useGallery } from '@/state/gallery';
import { checkpointModels, useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { recalledModel, recalledModelKey } from '@/state/recallModel';
import { toast } from '@/state/toasts';
import { showViewer } from '@/state/ui';
import { Button, Modal, Select, SliderNumber, Spinner, Textarea, cx } from '@/ui';
import './facefix.css';

const DEFAULT_STRENGTH = 0.4;
const DEFAULT_SENSITIVITY = 0.5;

/** A custom node pack the fix needs: say so, and offer to install it (or to restart ComfyUI once it is installed). */
function NeedsPack({ id, message }: { id: 'impact' | 'impactSubpack'; message: 'facefix.needsImpact' | 'facefix.needsSubpack' }) {
  const need = usePackNeeds(id);
  return (
    <div className="ffx__needs" data-testid={`facefix-needs-${id}`}>
      <p>{t(message, { pack: need.name })}</p>
      {need.has ? (
        <Button variant="solid" leftIcon={<ArrowClockwise size={14} />} isLoading={need.restarting} onClick={need.restart}>
          {t('facefix.restart')}
        </Button>
      ) : (
        <Button variant="solid" leftIcon={<DownloadSimple size={14} />} isLoading={need.busy} onClick={need.install} data-testid={`facefix-install-${id}`}>
          {t('facefix.install')}
        </Button>
      )}
      {need.error && <p className="ffx__error">{need.error}</p>}
    </div>
  );
}

export function FaceFixDialog() {
  const imageName = useFaceFixDialog((s) => s.imageName);
  const close = useFaceFixDialog((s) => s.close);
  const image = useGallery((s) => (imageName ? s.images.find((i) => i.name === imageName) : undefined));
  const defsState = useComfyNodes((s) => s.status);
  const defs = useComfyNodes((s) => s.defs);
  const models = useModels((s) => s.models);
  const formModel = useParams((s) => s.modelKey);

  const detectors = useMemo(() => faceDetectors(defs), [defs]);
  const hasImpact = !!defs?.[FACE_NODE];
  const hasSubpack = !!defs?.[DETECTOR_NODE];
  const ready = hasImpact && hasSubpack && detectors.length > 0;

  const [modelKey, setModelKey] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [strength, setStrength] = useState(DEFAULT_STRENGTH);
  const [sensitivity, setSensitivity] = useState(DEFAULT_SENSITIVITY);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImageDTO | null>(null);
  const abort = useRef<AbortController | null>(null);

  const mains = useMemo(() => checkpointModels(models), [models]);
  // The picture's own model, found by its name when it was made elsewhere and carries no key of this app.
  const pictureModel = image?.metadata ? recalledModelKey(recalledModel(image.metadata, mains), null) : null;
  const chosen = mains.find((m) => m.key === modelKey)?.key ?? pictureModel ?? mains.find((m) => m.key === formModel)?.key ?? mains[0]?.key ?? null;

  // A fresh start for each picture: its own prompt, and the node list read again (a pack may have been installed).
  useEffect(() => {
    abort.current?.abort();
    setResult(null);
    setError(null);
    setModelKey(null);
    if (!imageName) return;
    setPrompt(useGallery.getState().images.find((i) => i.name === imageName)?.metadata?.positivePrompt ?? '');
    // Forced: a pack installed and ComfyUI restarted since the nodes were read must show up now.
    void useComfyNodes.getState().load(true);
    void useNodePacks.getState().load();
  }, [imageName]);

  const run = async () => {
    if (!image || !chosen || !ready) return;
    const stored = image.metadata;
    const controller = new AbortController();
    abort.current = controller;
    setRunning(true);
    setError(null);
    try {
      const graph = buildFaceFixGraph(image.name, {
        modelKey: chosen,
        prompt,
        negative: stored?.negativePrompt ?? '',
        detector: detectors[0]!,
        strength,
        sensitivity,
        steps: 20,
        cfg: Math.min(stored?.cfgScale || 6, 7),
        scheduler: stored?.scheduler ?? 'dpmpp_2m_k',
      });
      const picture = await runJob(graphRequest(graph, 'gallery', image.boardId, { width: image.width, height: image.height }), controller.signal);
      setResult(picture);
      toast({ status: 'success', title: t('facefix.saved') });
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      abort.current = null;
      setRunning(false);
    }
  };

  const compare = () => {
    if (!image || !result) return;
    const gallery = useGallery.getState();
    gallery.setSelection([result.name]);
    gallery.setCompareImage(image.name);
    showViewer();
    close();
  };

  return (
    <Modal open={!!imageName} onOpenChange={(o) => !o && close()} size="xl" closeLabel={t('common.close')} title={t('facefix.title')}>
      {!image ? null : (
        <div className="ffx" data-testid="facefix-dialog">
          <div className={cx('ffx__stage', running && 'is-busy')} style={{ aspectRatio: `${image.width} / ${image.height}` }} role="img" aria-label={result ? t('facefix.result') : t('facefix.stage')}>
            <img className="ffx__img" src={result ? result.url : image.url} alt="" draggable={false} data-testid={result ? 'facefix-result' : undefined} />
            {running && (
              <span className="ffx__busy" aria-hidden>
                <Spinner size={22} />
              </span>
            )}
          </div>
          <aside className="ffx__side">
            {defsState === 'loading' || defsState === 'idle' ? (
              <p className="ffx__hint">
                <Spinner size={14} /> {t('facefix.loading')}
              </p>
            ) : !hasImpact ? (
              <NeedsPack id="impact" message="facefix.needsImpact" />
            ) : !hasSubpack ? (
              <NeedsPack id="impactSubpack" message="facefix.needsSubpack" />
            ) : !detectors.length ? (
              <p className="ffx__error" role="alert" data-testid="facefix-no-detector">
                <WarningCircle size={14} /> {t('facefix.noDetector')}
              </p>
            ) : (
              <>
                <label className="ffx__field">
                  <span>{t('facefix.model')}</span>
                  <Select value={chosen ?? ''} onChange={setModelKey} options={mains.map((m) => ({ value: m.key, label: m.name }))} disabled={running} aria-label={t('facefix.model')} />
                  {!mains.length && <span className="ffx__hint">{t('facefix.noModel')}</span>}
                </label>
                <label className="ffx__field">
                  <span>{t('facefix.prompt')}</span>
                  <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} disabled={running} data-testid="facefix-prompt" />
                  <span className="ffx__hint">{t('facefix.promptHint')}</span>
                </label>
                <label className="ffx__field">
                  <span>{t('facefix.strength')}</span>
                  <SliderNumber value={strength} onChange={setStrength} min={0.1} max={0.8} step={0.05} precision={2} disabled={running} aria-label={t('facefix.strength')} />
                  <span className="ffx__hint">{t('facefix.strengthHint')}</span>
                </label>
                <label className="ffx__field">
                  <span>{t('facefix.sensitivity')}</span>
                  <SliderNumber value={sensitivity} onChange={setSensitivity} min={0.1} max={0.9} step={0.05} precision={2} disabled={running} aria-label={t('facefix.sensitivity')} />
                  <span className="ffx__hint">{t('facefix.sensitivityHint')}</span>
                </label>
                <div className="ffx__row">
                  <Button variant="solid" scheme="invoke" disabled={!chosen || running} isLoading={running} onClick={() => void run()} data-testid="facefix-run">
                    {running ? t('facefix.running') : result ? t('facefix.again') : t('facefix.run')}
                  </Button>
                  {running && (
                    <Button variant="outline" onClick={() => abort.current?.abort()} data-testid="facefix-cancel">
                      {t('common.cancel')}
                    </Button>
                  )}
                </div>
                {running && <p className="ffx__hint">{t('facefix.firstRun')}</p>}
                {error && (
                  <p className="ffx__error" role="alert">
                    <WarningCircle size={14} /> {t('facefix.failed')}: {error}
                  </p>
                )}
                {result && (
                  <div className="ffx__result" data-testid="facefix-done">
                    <p className="ffx__hint">{t('facefix.done')}</p>
                    <Button leftIcon={<Eye size={14} />} onClick={compare} data-testid="facefix-open">
                      {t('facefix.open')}
                    </Button>
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
