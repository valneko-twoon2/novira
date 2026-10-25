// "Describe as a prompt": Florence-2 looks at a picture and writes tags or a sentence that can be used as the
// positive prompt (replace it, add to it, or copy the text). The picture comes from the gallery (menu, viewer, a drop
// on the prompt box's button) or from a file.
import { ArrowClockwise, ClipboardText, DownloadSimple, ImageSquare, Plus, Swap, UploadSimple, WarningCircle } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { backend } from '@/backend';
import { t } from '@/i18n';
import { CAPTION_PACK, appendToPrompt, buildCaptionGraph, captionModel, captionReady, tidyCaption, type CaptionStyle } from '@/state/comfy/caption';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { graphRequest } from '@/state/comfy/graphJob';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { usePackNeeds } from '@/state/comfy/packNeeds';
import { runTextJob } from '@/state/comfy/runGraph';
import { useCaptionDialog } from '@/state/dialogs/caption';
import { findImage, useGallery } from '@/state/gallery';
import { autoAddBoardId } from '@/state/invoke';
import { useParams } from '@/state/params';
import { toast } from '@/state/toasts';
import { Button, cx, ImageDropZone, Modal, Select, Spinner, Textarea, writeClipboardText } from '@/ui';
import './caption.css';

/** The pack the description needs: say so, and offer to install it (or to restart ComfyUI once it is installed). */
function NeedsPack() {
  const need = usePackNeeds(CAPTION_PACK);
  return (
    <div className="cap__needs" data-testid="caption-needs">
      <p>{t('caption.needsPack', { pack: need.name })}</p>
      {need.has ? (
        <Button variant="solid" leftIcon={<ArrowClockwise size={14} />} isLoading={need.restarting} onClick={need.restart}>
          {t('caption.restart')}
        </Button>
      ) : (
        <Button variant="solid" leftIcon={<DownloadSimple size={14} />} isLoading={need.busy} onClick={need.install} data-testid="caption-install">
          {t('caption.install')}
        </Button>
      )}
      {need.error && <p className="cap__error">{need.error}</p>}
    </div>
  );
}

export function CaptionDialog() {
  const open = useCaptionDialog((s) => s.open);
  const imageName = useCaptionDialog((s) => s.imageName);
  const setImage = useCaptionDialog((s) => s.setImage);
  const close = useCaptionDialog((s) => s.close);
  const image = useGallery((s) => (imageName ? s.images.find((i) => i.name === imageName) : undefined));
  const defsState = useComfyNodes((s) => s.status);
  const defs = useComfyNodes((s) => s.defs);
  const ready = captionReady(defs);

  const [style, setStyle] = useState<CaptionStyle>('tags');
  const [text, setText] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // A fresh start for each picture, with the node list read again (the pack may have been installed meanwhile).
  useEffect(() => {
    abort.current?.abort();
    setText('');
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
    const model = captionModel(defs);
    if (!image || !model) return;
    const controller = new AbortController();
    abort.current = controller;
    setRunning(true);
    setError(null);
    try {
      const answer = await runTextJob(graphRequest(buildCaptionGraph(image.name, { style, model }), 'intermediate'), controller.signal);
      setText(tidyCaption(answer, style));
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      abort.current = null;
      setRunning(false);
    }
  };

  const applyToPrompt = (how: 'replace' | 'append') => {
    const params = useParams.getState();
    params.set({ positivePrompt: how === 'replace' ? text.trim() : appendToPrompt(params.positivePrompt, text) });
    toast({ status: 'success', title: how === 'replace' ? t('caption.replaced') : t('caption.appended') });
    close();
  };

  const copy = async () => {
    try {
      await writeClipboardText(text.trim());
      toast({ status: 'success', title: t('caption.copied') });
    } catch {
      toast({ status: 'error', title: t('caption.copyFailed') });
    }
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && close()} size="lg" closeLabel={t('common.close')} title={t('caption.title')}>
      <div className="cap" data-testid="caption-dialog">
        <ImageDropZone
          className={cx('cap__stage', running && 'is-busy')}
          label={t('caption.dropHere')}
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
            <img className="cap__img" src={image.url} alt="" draggable={false} data-testid="caption-picture" />
          ) : (
            <button type="button" className="cap__empty" onClick={() => fileInput.current?.click()} data-testid="caption-pick">
              <ImageSquare size={28} />
              <span>{t('caption.dropOrUpload')}</span>
              <UploadSimple size={14} />
            </button>
          )}
          {running && (
            <span className="cap__busy" aria-hidden>
              <Spinner size={22} />
            </span>
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
        <aside className="cap__side">
          {defsState === 'loading' || defsState === 'idle' ? (
            <p className="cap__hint">
              <Spinner size={14} /> {t('caption.loading')}
            </p>
          ) : !ready ? (
            <NeedsPack />
          ) : (
            <>
              <label className="cap__field">
                <span>{t('caption.style')}</span>
                <Select
                  value={style}
                  onChange={(v) => setStyle(v === 'sentence' ? 'sentence' : 'tags')}
                  options={[
                    { value: 'tags', label: t('caption.style.tags') },
                    { value: 'sentence', label: t('caption.style.sentence') },
                  ]}
                  disabled={running}
                  aria-label={t('caption.style')}
                />
              </label>
              <div className="cap__row">
                <Button variant="solid" scheme="invoke" disabled={!image || running} isLoading={running} onClick={() => void run()} data-testid="caption-run">
                  {running ? t('caption.running') : text ? t('caption.again') : t('caption.run')}
                </Button>
                {running && (
                  <Button variant="outline" onClick={() => abort.current?.abort()} data-testid="caption-cancel">
                    {t('common.cancel')}
                  </Button>
                )}
                {image && !running && (
                  <Button variant="ghost" onClick={() => fileInput.current?.click()} leftIcon={<UploadSimple size={14} />}>
                    {t('caption.otherPicture')}
                  </Button>
                )}
              </div>
              {running && <p className="cap__hint">{t('caption.firstRun')}</p>}
              {error && (
                <p className="cap__error" role="alert">
                  <WarningCircle size={14} /> {t('caption.failed')}: {error}
                </p>
              )}
              {text && (
                <div className="cap__result" data-testid="caption-result">
                  <label className="cap__field">
                    <span>{t('caption.result')}</span>
                    <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} data-testid="caption-text" />
                  </label>
                  <div className="cap__row cap__row--wrap">
                    <Button variant="solid" leftIcon={<Swap size={14} />} disabled={!text.trim()} onClick={() => applyToPrompt('replace')} data-testid="caption-replace">
                      {t('caption.replace')}
                    </Button>
                    <Button variant="outline" leftIcon={<Plus size={14} />} disabled={!text.trim()} onClick={() => applyToPrompt('append')} data-testid="caption-append">
                      {t('caption.append')}
                    </Button>
                    <Button variant="ghost" leftIcon={<ClipboardText size={14} />} disabled={!text.trim()} onClick={() => void copy()} data-testid="caption-copy">
                      {t('caption.copy')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </Modal>
  );
}
