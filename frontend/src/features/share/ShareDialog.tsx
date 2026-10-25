// "Export for sharing": clean copies of gallery pictures in a chosen format and size, optionally marked as
// made by AI (watermark, IPTC label, content credentials). The desktop app asks for the folder in a native
// dialog; the browser downloads the files.
import { FolderOpen } from '@phosphor-icons/react';
import { useMemo, useState, type ReactNode } from 'react';
import { backend, type ExportResult, type WatermarkStatus } from '@/backend';
import { t, tCount } from '@/i18n';
import { useShareDialog } from '@/state/dialogs/share';
import { useGallery } from '@/state/gallery';
import { toast } from '@/state/toasts';
import { Button, Modal, NumberInput, Select, SliderNumber, Switch } from '@/ui';
import {
  DEFAULT_FORM,
  FORMATS,
  FORMAT_LABELS,
  MAX_SIDE,
  MIN_SIDE,
  SIZE_CHOICES,
  hasQuality,
  infoIsLost,
  splitMedia,
  toExportOptions,
  type ShareForm,
  type SizeChoice,
} from './shareOptions';
import { downloadPercent, useWatermarkStatus } from './useWatermarkStatus';

/** The form as last used, so the next export starts from the same choices (not kept across restarts). */
let lastForm: ShareForm = DEFAULT_FORM;

const sizeLabel = (size: SizeChoice) =>
  size === 'original' ? t('share.size.original') : size === 'custom' ? t('share.size.custom') : t('share.size.px', { size });

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="share__field">
      <div className="share__label">
        <span>{label}</span>
        {help && <small>{help}</small>}
      </div>
      <div className="share__control">{children}</div>
    </div>
  );
}

/** Where the watermark's files are, under the switch: preparing, missing or failed (with a retry), or the limits. */
function WatermarkState({ status, retry }: { status: WatermarkStatus | null; retry: () => void }) {
  if (!status) return null;
  if (status.state === 'ready') return <p className="share__note">{t('share.watermarkNote')}</p>;
  if (status.state === 'downloading') {
    return (
      <p className="share__note" data-testid="share-watermark-state">
        {t('share.watermarkPreparing', { percent: downloadPercent(status) })}
      </p>
    );
  }
  return (
    <div className="share__watermark-state" data-testid="share-watermark-state">
      <p className="share__note share__note--warn">
        {status.state === 'failed' ? t('share.watermarkFailed', { message: status.message }) : t('share.watermarkMissing')}
      </p>
      <Button size="xs" variant="outline" onClick={retry} data-testid="share-watermark-retry">
        {t('share.watermarkRetry')}
      </Button>
    </div>
  );
}

function Done({ result, onClose }: { result: ExportResult; onClose: () => void }) {
  return (
    <div className="share" data-testid="share-done">
      <p className="share__done">{tCount('share.done', result.count)}</p>
      <p className="share__note">{result.folder ? t('share.doneIn', { folder: result.folder }) : t('share.downloaded')}</p>
      {result.watermarked > 0 && <p className="share__note">{tCount('share.doneWatermarked', result.watermarked)}</p>}
      {result.skipped > 0 && <p className="share__note">{tCount('share.skippedMedia', result.skipped)}</p>}
      <div className="share__footer">
        {result.folder && (
          <Button variant="outline" leftIcon={<FolderOpen size={14} />} onClick={() => backend.revealExportFolder().catch(() => undefined)} data-testid="share-open-folder">
            {t('share.openFolder')}
          </Button>
        )}
        <Button variant="solid" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </div>
  );
}

export function ShareDialog() {
  const names = useShareDialog((s) => s.names);
  const close = useShareDialog((s) => s.close);
  const all = useGallery((s) => s.images);
  const { pictures, others } = useMemo(() => splitMedia(names ? all.filter((i) => names.includes(i.name)) : []), [names, all]);
  const [form, setFormState] = useState<ShareForm>(lastForm);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const { status: watermark, retry } = useWatermarkStatus(!!names && form.watermark);
  const watermarkBlocked = form.watermark && watermark?.state !== 'ready';

  const setForm = (patch: Partial<ShareForm>) =>
    setFormState((f) => {
      lastForm = { ...f, ...patch };
      return lastForm;
    });
  const finish = () => {
    setResult(null);
    close();
  };

  const run = async () => {
    if (!pictures.length) return;
    setBusy(true);
    try {
      const done = await backend.exportImages(
        pictures.map((p) => p.name),
        toExportOptions(form),
      );
      // null: the folder dialog was cancelled; the form stays open.
      if (done) setResult({ ...done, skipped: done.skipped + others.length });
    } catch (e) {
      toast({ status: 'error', title: t('share.failed'), description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!names} onOpenChange={(open) => !open && finish()} size="md" closeLabel={t('common.close')} title={t('share.title')}>
      {result ? (
        <Done result={result} onClose={finish} />
      ) : (
        <div className="share" data-testid="share">
          <p className="share__count">{pictures.length ? tCount('share.count', pictures.length) : t('share.noPictures')}</p>
          {pictures.length > 0 && (
            <div className="share__thumbs">
              {pictures.slice(0, 12).map((p) => (
                <img key={p.name} src={p.thumbnailUrl} alt="" draggable={false} />
              ))}
            </div>
          )}
          {others.length > 0 && <p className="share__note">{tCount('share.skippedMedia', others.length)}</p>}

          <Field label={t('share.format')}>
            <div className="share__formats" role="radiogroup" aria-label={t('share.format')}>
              {FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={form.format === f}
                  className={form.format === f ? 'share__format is-on' : 'share__format'}
                  onClick={() => setForm({ format: f })}
                  data-testid={`share-format-${f}`}
                >
                  {FORMAT_LABELS[f]}
                </button>
              ))}
            </div>
          </Field>
          {hasQuality(form.format) && (
            <Field label={t('share.quality')} help={t('share.jpegWhite')}>
              <div className="share__slider">
                <SliderNumber value={form.quality} onChange={(v) => setForm({ quality: v })} min={1} max={100} step={1} aria-label={t('share.quality')} />
              </div>
            </Field>
          )}
          {form.format === 'webp' && <p className="share__note">{t('share.webpLossless')}</p>}

          <Field label={t('share.size')} help={t('share.size.help')}>
            <div className="share__size" data-testid="share-size">
              <Select
                value={form.size}
                onChange={(v) => setForm({ size: v })}
                options={SIZE_CHOICES.map((s) => ({ value: s, label: sizeLabel(s) }))}
                aria-label={t('share.size')}
              />
              {form.size === 'custom' && (
                <NumberInput value={form.customSide} onChange={(v) => setForm({ customSide: v })} min={MIN_SIDE} max={MAX_SIDE} step={64} aria-label={t('share.size.customLabel')} />
              )}
            </div>
          </Field>

          <Field label={t('share.removeInfo')} help={t('share.removeInfoHelp')}>
            <Switch checked={form.removeInfo} onChange={(v) => setForm({ removeInfo: v })} aria-label={t('share.removeInfo')} />
          </Field>
          {infoIsLost(form) && <p className="share__note share__note--warn">{t('share.keepInfoPngOnly')}</p>}

          <Field label={t('share.watermark')} help={t('share.watermarkHelp')}>
            <Switch checked={form.watermark} onChange={(v) => setForm({ watermark: v })} aria-label={t('share.watermark')} />
          </Field>
          {form.watermark && <WatermarkState status={watermark} retry={retry} />}

          <div className="share__footer">
            <Button variant="outline" onClick={finish}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="solid"
              scheme="invoke"
              disabled={!pictures.length || busy || watermarkBlocked}
              isLoading={busy}
              onClick={() => void run()}
              data-testid="share-run"
            >
              {t('share.run')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
