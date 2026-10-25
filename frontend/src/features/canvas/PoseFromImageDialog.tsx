// "Make a pose from a picture": the DWPose estimator reads the skeletons of the people in a gallery picture (or a file),
// and they are put on a control layer of the canvas as poses that can be edited. The pack it needs is offered for
// installing when it is missing.
import { ArrowClockwise, DownloadSimple, ImageSquare, UploadSimple, WarningCircle } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { backend } from '@/backend';
import { t, tCount } from '@/i18n';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { graphRequest } from '@/state/comfy/graphJob';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { usePackNeeds } from '@/state/comfy/packNeeds';
import { buildPoseExtractGraph, parsePoseExtract, POSE_EXTRACT_PACK, poseExtractReady, type ExtractedPoses } from '@/state/comfy/poseExtract';
import { runTextJob } from '@/state/comfy/runGraph';
import { usePoseFromImageDialog } from '@/state/dialogs/poseFromImage';
import { findImage, useGallery } from '@/state/gallery';
import { autoAddBoardId } from '@/state/invoke';
import { toast } from '@/state/toasts';
import { useUi } from '@/state/ui';
import { Button, ImageDropZone, Modal, Spinner, cx } from '@/ui';
import { placeExtractedPoses } from './actions';
import './poseFromImage.css';

/** The pack the estimator needs: say so, and offer to install it (or to restart ComfyUI once it is installed). */
function NeedsPack() {
  const need = usePackNeeds(POSE_EXTRACT_PACK);
  return (
    <div className="pfi__needs" data-testid="pose-from-image-needs">
      <p>{t('canvas.poseFromImage.needsPack', { pack: need.name })}</p>
      {need.has ? (
        <Button variant="solid" leftIcon={<ArrowClockwise size={14} />} isLoading={need.restarting} onClick={need.restart}>
          {t('canvas.poseFromImage.restart')}
        </Button>
      ) : (
        <Button variant="solid" leftIcon={<DownloadSimple size={14} />} isLoading={need.busy} onClick={need.install} data-testid="pose-from-image-install">
          {t('canvas.poseFromImage.install')}
        </Button>
      )}
      {need.error && <p className="pfi__error">{need.error}</p>}
    </div>
  );
}

export function PoseFromImageDialog() {
  const open = usePoseFromImageDialog((s) => s.open);
  const imageName = usePoseFromImageDialog((s) => s.imageName);
  const setImage = usePoseFromImageDialog((s) => s.setImage);
  const close = usePoseFromImageDialog((s) => s.close);
  const image = useGallery((s) => (imageName ? s.images.find((i) => i.name === imageName) : undefined));
  const defsState = useComfyNodes((s) => s.status);
  const defs = useComfyNodes((s) => s.defs);
  const ready = poseExtractReady(defs);

  const [found, setFound] = useState<ExtractedPoses | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // A fresh start for each picture, with the node list read again (the pack may have been installed meanwhile).
  useEffect(() => {
    abort.current?.abort();
    setFound(null);
    setError(null);
    if (open) {
      void useComfyNodes.getState().load();
      void useNodePacks.getState().load();
    }
  }, [open, imageName]);

  const upload = async (file: File) => {
    try {
      const saved = await backend.uploadImage(file, { boardId: autoAddBoardId(), category: 'user' });
      useGallery.getState().addImage(saved);
      setImage(saved.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const run = async () => {
    if (!image) return;
    const controller = new AbortController();
    abort.current = controller;
    setRunning(true);
    setError(null);
    setFound(null);
    try {
      const answer = await runTextJob(graphRequest(buildPoseExtractGraph(image.name, defs), 'intermediate'), controller.signal);
      const parsed = parsePoseExtract(answer);
      if (!parsed) throw new Error(answer.slice(0, 200) || 'empty answer');
      setFound(parsed);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      abort.current = null;
      setRunning(false);
    }
  };

  const place = (add: boolean) => {
    if (!found || !placeExtractedPoses(found, add)) return;
    useUi.getState().setTab('canvas');
    toast({ status: 'success', title: t('canvas.poseFromImage.placed') });
    close();
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && close()} size="lg" closeLabel={t('common.close')} title={t('canvas.poseFromImage.menu')}>
      <div className="pfi" data-testid="pose-from-image-dialog">
        <ImageDropZone
          className={cx('pfi__stage', running && 'is-busy')}
          label={t('canvas.poseFromImage.dropHere')}
          disabled={running}
          onImages={(names) => {
            const picked = findImage(names[0] ?? null);
            if (picked && (picked.mediaType ?? 'image') === 'image') setImage(picked.name);
          }}
          onFiles={(files) => {
            if (files[0]) void upload(files[0]);
          }}
        >
          {image ? (
            <img className="pfi__img" src={image.url} alt="" draggable={false} data-testid="pose-from-image-picture" />
          ) : (
            <button type="button" className="pfi__empty" onClick={() => fileInput.current?.click()} data-testid="pose-from-image-pick">
              <ImageSquare size={28} />
              <span>{t('canvas.poseFromImage.dropOrUpload')}</span>
              <UploadSimple size={14} />
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void upload(f);
            }}
          />
        </ImageDropZone>
        <aside className="pfi__side">
          {defsState === 'loading' || defsState === 'idle' ? (
            <p className="pfi__text">
              <Spinner size={14} /> {t('canvas.poseFromImage.loading')}
            </p>
          ) : !ready ? (
            <NeedsPack />
          ) : (
            <>
              <div className="pfi__row">
                <Button variant="solid" scheme="invoke" disabled={!image || running} isLoading={running} onClick={() => void run()} data-testid="pose-from-image-run">
                  {running ? t('canvas.poseFromImage.running') : found ? t('canvas.poseFromImage.again') : t('canvas.poseFromImage.run')}
                </Button>
                {running && (
                  <Button variant="outline" onClick={() => abort.current?.abort()} data-testid="pose-from-image-cancel">
                    {t('common.cancel')}
                  </Button>
                )}
                {image && !running && (
                  <Button variant="ghost" onClick={() => fileInput.current?.click()} leftIcon={<UploadSimple size={14} />}>
                    {t('canvas.poseFromImage.otherPicture')}
                  </Button>
                )}
              </div>
              {running && <p className="pfi__text">{t('canvas.poseFromImage.firstRun')}</p>}
              {error && (
                <p className="pfi__error" role="alert">
                  <WarningCircle size={14} /> {t('canvas.poseFromImage.failed')}: {error}
                </p>
              )}
              {found &&
                (found.people.length ? (
                  <div className="pfi__result" data-testid="pose-from-image-result">
                    <p>{tCount('canvas.poseFromImage.found', found.people.length)}</p>
                    <div className="pfi__row">
                      <Button variant="solid" onClick={() => place(false)} data-testid="pose-from-image-replace">
                        {t('canvas.poseFromImage.replace')}
                      </Button>
                      <Button variant="outline" onClick={() => place(true)} data-testid="pose-from-image-add">
                        {t('canvas.poseFromImage.add')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="pfi__text" data-testid="pose-from-image-none">
                    {t('canvas.poseFromImage.none')}
                  </p>
                ))}
            </>
          )}
        </aside>
      </div>
    </Modal>
  );
}
