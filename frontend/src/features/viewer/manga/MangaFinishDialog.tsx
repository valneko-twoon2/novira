// "Finish as a manga page": the picture open in the viewer is turned into a black-and-white page with screentones (the
// ComfyUI-MangaScreen pack's Manga Finish node). The dialog tries the values on the picture, shows it beside the original,
// and saves the page as a new gallery picture. The original is never changed, and nothing is done while a picture is drawn.
import { ArrowClockwise, DownloadSimple, Eye, FloppyDisk, WarningCircle } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import type { ImageDTO } from '@/backend';
import { t, type MessageKey } from '@/i18n';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { packFolder } from '@/state/comfy/packCatalog';
import { MANGASCREEN_PACK, packMissing, usePackNeeds } from '@/state/comfy/packNeeds';
import { useMangaDialog } from '@/state/dialogs/manga';
import { useGallery } from '@/state/gallery';
import { MANGA_KEYS, MANGA_RANGE, useMangaFinish } from '@/state/mangaFinish';
import { toast } from '@/state/toasts';
import { showViewer } from '@/state/ui';
import { Button, Field, Modal, SliderNumber, Spinner, cx } from '@/ui';
import { runMangaPreview, saveMangaPage } from './mangaGraph';

/** Shown while the pack is missing, or installed but not yet loaded by ComfyUI. */
function MangaPackNeeds() {
  const need = usePackNeeds(MANGASCREEN_PACK);
  return (
    <div className="mgf__needs" data-testid="manga-pack-needs">
      <p>{t('gallery.manga.needsPack', { pack: need.name })}</p>
      {need.has ? (
        <Button size="sm" variant="solid" leftIcon={<ArrowClockwise size={12} />} isLoading={need.restarting} onClick={need.restart} data-testid="manga-pack-restart">
          {t('gallery.manga.restartEngine')}
        </Button>
      ) : (
        <Button size="sm" variant="solid" leftIcon={<DownloadSimple size={12} />} isLoading={need.busy} onClick={need.install} data-testid="manga-pack-install">
          {t('gallery.manga.installPack')}
        </Button>
      )}
      {need.error && <p className="mgf__error">{need.error}</p>}
    </div>
  );
}

export function MangaFinishDialog() {
  const imageName = useMangaDialog((s) => s.imageName);
  const close = useMangaDialog((s) => s.close);
  const image = useGallery((s) => (imageName ? s.images.find((i) => i.name === imageName) : undefined));
  const values = useMangaFinish((s) => s.values);
  const packs = useNodePacks((s) => s.packs);
  const need = usePackNeeds(MANGASCREEN_PACK);
  const missing = packMissing(MANGASCREEN_PACK, { packs });
  // Installed in this session and not loaded until ComfyUI restarts.
  const justInstalled = useNodePacks((s) => !!s.packs?.restartNeeded && Object.entries(s.jobs).some(([url, job]) => packFolder(url) === need.name && job.state === 'ready'));

  const [preview, setPreview] = useState<ImageDTO | null>(null);
  const [saved, setSaved] = useState<ImageDTO | null>(null);
  const [working, setWorking] = useState<'preview' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  // A fresh start for each picture; the pack list is read again (a pack may have been installed).
  useEffect(() => {
    abort.current?.abort();
    setPreview(null);
    setSaved(null);
    setError(null);
    if (imageName) void useNodePacks.getState().load();
  }, [imageName]);
  useEffect(() => () => abort.current?.abort(), []);

  const blocked = missing || justInstalled;
  const run = async (kind: 'preview' | 'save') => {
    if (!image || blocked) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setWorking(kind);
    setError(null);
    try {
      if (kind === 'preview') setPreview(await runMangaPreview(image.name, values, controller.signal));
      else {
        setSaved(await saveMangaPage(image, values, t('gallery.manga.title'), controller.signal));
        toast({ status: 'success', title: t('gallery.manga.saved') });
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (abort.current === controller) {
        abort.current = null;
        setWorking(null);
      }
    }
  };

  const open = () => {
    if (!saved) return;
    useGallery.getState().setSelection([saved.name]);
    showViewer();
    close();
  };

  const busy = working !== null;
  const ratio = image ? { aspectRatio: `${image.width} / ${image.height}` } : undefined;
  return (
    <Modal open={!!imageName} onOpenChange={(o) => !o && close()} size="xl" closeLabel={t('common.close')} title={t('gallery.manga.title')}>
      {!image ? null : (
        <div className="mgf" data-testid="manga-dialog">
          <div className="mgf__pair">
            <figure className="mgf__shot">
              <div className="mgf__stage" style={ratio}>
                <img className="mgf__img" src={image.url} alt={t('gallery.manga.before')} draggable={false} />
              </div>
              <figcaption>{t('gallery.manga.before')}</figcaption>
            </figure>
            <figure className="mgf__shot">
              <div className={cx('mgf__stage', working === 'preview' && 'is-busy')} style={ratio}>
                {preview ? <img className="mgf__img" src={preview.url} alt={t('gallery.manga.after')} draggable={false} data-testid="manga-try-result" /> : <span className="mgf__empty">{t('gallery.manga.afterEmpty')}</span>}
                {working === 'preview' && (
                  <span className="mgf__busy" aria-hidden>
                    <Spinner size={22} />
                  </span>
                )}
              </div>
              <figcaption>{t('gallery.manga.after')}</figcaption>
            </figure>
          </div>
          <aside className="mgf__side" data-testid="manga-settings">
            <p className="mgf__hint">{t('gallery.manga.info')}</p>
            {blocked && <MangaPackNeeds />}
            {MANGA_KEYS.map((key) => {
              const range = MANGA_RANGE[key];
              const label = t(`gallery.manga.${key}` as MessageKey);
              return (
                <Field key={key} label={label} info={t(`gallery.manga.${key}Info` as MessageKey)}>
                  <SliderNumber
                    value={values[key]}
                    onChange={(v) => useMangaFinish.getState().set({ [key]: key === 'screenLines' ? Math.round(v) : v })}
                    min={range.min}
                    max={range.max}
                    step={range.step}
                    precision={key === 'screenLines' ? 0 : 2}
                    marks={[...new Set([range.min, range.default, range.max])]}
                    disabled={busy}
                    aria-label={label}
                  />
                </Field>
              );
            })}
            <div className="mgf__row">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => useMangaFinish.getState().reset()} data-testid="manga-reset">
                {t('gallery.manga.reset')}
              </Button>
              <Button size="sm" variant="outline" disabled={blocked || busy} isLoading={working === 'preview'} onClick={() => void run('preview')} data-testid="manga-try-run">
                {preview ? t('gallery.manga.tryAgain') : t('gallery.manga.tryRun')}
              </Button>
              <Button size="sm" variant="solid" scheme="invoke" leftIcon={<FloppyDisk size={12} />} disabled={blocked || busy} isLoading={working === 'save'} onClick={() => void run('save')} data-testid="manga-save">
                {t('gallery.manga.save')}
              </Button>
              {busy && (
                <Button size="sm" variant="outline" onClick={() => abort.current?.abort()} data-testid="manga-cancel">
                  {t('common.cancel')}
                </Button>
              )}
            </div>
            <p className="mgf__hint">{t('gallery.manga.saveHint')}</p>
            {error && (
              <p className="mgf__error" role="alert" data-testid="manga-error">
                <WarningCircle size={14} /> {t('gallery.manga.failed')}: {error}
              </p>
            )}
            {saved && (
              <div className="mgf__row" data-testid="manga-done">
                <Button size="sm" leftIcon={<Eye size={12} />} onClick={open} data-testid="manga-open">
                  {t('gallery.manga.open')}
                </Button>
              </div>
            )}
          </aside>
        </div>
      )}
    </Modal>
  );
}
