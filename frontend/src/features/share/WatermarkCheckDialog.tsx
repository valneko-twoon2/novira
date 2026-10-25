// "Check for a watermark": reads a picture's marks (novira's TrustMark watermark and the gallery picture it came
// from, C2PA content credentials, the IPTC AI label) and lists what was found. The desktop app asks for
// the file in a native dialog; a gallery picture is checked by name.
import { CheckCircle, FileImage, MinusCircle, WarningCircle } from '@phosphor-icons/react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { backend, hasNativeDialogs, type WatermarkCheck } from '@/backend';
import { getLocale, t } from '@/i18n';
import { useWatermarkCheckDialog } from '@/state/dialogs/watermark';
import { useGallery } from '@/state/gallery';
import { toast } from '@/state/toasts';
import { showViewer } from '@/state/ui';
import { Button, Modal } from '@/ui';

type Mark = 'yes' | 'no' | 'warn';

const ICON: Record<Mark, ReactNode> = {
  yes: <CheckCircle size={16} weight="fill" />,
  no: <MinusCircle size={16} />,
  warn: <WarningCircle size={16} weight="fill" />,
};

function Row({ label, mark, children, testId }: { label: string; mark: Mark; children: ReactNode; testId: string }) {
  return (
    <div className={`wm-check__row is-${mark}`} data-testid={testId}>
      <span className="wm-check__icon">{ICON[mark]}</span>
      <div className="wm-check__text">
        <span className="wm-check__label">{label}</span>
        <div className="wm-check__value">{children}</div>
      </div>
    </div>
  );
}

const exportDate = (ms: number) => new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));

/** The lines of a check's result. */
export function CheckResult({ check, onShowOriginal }: { check: WatermarkCheck; onShowOriginal: (name: string) => void }) {
  const watermark: [Mark, string] = !check.watermarkChecked
    ? ['warn', t('share.check.watermarkUnchecked')]
    : check.noviraMarker
      ? ['yes', t('share.check.watermarkNovira', { id: check.watermarkId ?? '' })]
      : check.watermarkFound
        ? ['yes', t('share.check.watermarkOther')]
        : ['no', t('share.check.watermarkNone')];
  const credentials: Mark = !check.credentialsPresent ? 'no' : check.credentialsValid ? 'yes' : 'warn';
  return (
    <div className="wm-check__result" data-testid="wm-check-result">
      <p className="wm-check__file">
        <FileImage size={14} /> {check.fileName}
      </p>
      <Row label={t('share.check.watermark')} mark={watermark[0]} testId="wm-check-watermark">
        {watermark[1]}
      </Row>
      {check.noviraMarker && (
        <Row label={t('share.check.original')} mark={check.originalInGallery ? 'yes' : 'no'} testId="wm-check-original">
          {check.originalName && check.originalInGallery ? (
            <>
              <span>{t('share.check.originalInGallery', { date: check.exportedAt ? exportDate(check.exportedAt) : '' })}</span>
              <Button size="xs" variant="outline" onClick={() => onShowOriginal(check.originalName!)} data-testid="wm-check-show-original">
                {t('share.check.showOriginal')}
              </Button>
            </>
          ) : check.originalName ? (
            t('share.check.originalDeleted')
          ) : (
            t('share.check.originalUnknown')
          )}
        </Row>
      )}
      <Row label={t('share.check.credentials')} mark={credentials} testId="wm-check-credentials">
        {!check.credentialsPresent ? (
          t('share.check.no')
        ) : (
          <>
            <span>{check.credentialsValid ? t('share.check.credentialsValid') : t('share.check.credentialsBroken')}</span>
            {check.credentialsAi && <span>{t('share.check.credentialsAi')}</span>}
            {check.credentialsSigner && <span>{t('share.check.signer', { name: check.credentialsSigner })}</span>}
            {check.credentialsThisApp && <span>{t('share.check.signerThisApp')}</span>}
            {!check.credentialsTrusted && <span className="wm-check__muted">{t('share.check.signerUntrusted')}</span>}
          </>
        )}
      </Row>
      <Row label={t('share.check.iptc')} mark={check.iptcAi ? 'yes' : 'no'} testId="wm-check-iptc">
        {check.iptcAi ? t('share.check.yes') : t('share.check.no')}
      </Row>
    </div>
  );
}

export function WatermarkCheckDialog() {
  const open = useWatermarkCheckDialog((s) => s.open);
  const name = useWatermarkCheckDialog((s) => s.name);
  const close = useWatermarkCheckDialog((s) => s.close);
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<WatermarkCheck | null>(null);

  const run = useCallback(async (ask: () => Promise<WatermarkCheck | null>) => {
    setBusy(true);
    try {
      const found = await ask();
      // null: the file dialog was cancelled; the last result stays.
      if (found) setCheck(found);
    } catch (e) {
      toast({ status: 'error', title: t('share.check.failed'), description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    setCheck(null);
    if (open && name) void run(() => backend.checkWatermarkImage(name));
  }, [open, name, run]);

  const showOriginal = (original: string) => {
    useGallery.getState().setSelection([original]);
    showViewer();
    close();
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && close()} size="md" closeLabel={t('common.close')} title={t('share.check.title')}>
      <div className="wm-check" data-testid="wm-check">
        {hasNativeDialogs() ? (
          <div className="wm-check__pick">
            <Button
              variant="outline"
              leftIcon={<FileImage size={14} />}
              isLoading={busy}
              disabled={busy}
              onClick={() => void run(() => backend.checkWatermarkFile())}
              data-testid="wm-check-pick"
            >
              {busy ? t('share.check.checking') : t('share.check.pick')}
            </Button>
          </div>
        ) : (
          // A file of this PC is picked in the desktop's dialog; here only the gallery picture the menu named is checked.
          <p className="share__note" data-testid="wm-check-desktop-only">
            {t('common.desktopOnly')}
          </p>
        )}
        {check && <CheckResult check={check} onShowOriginal={showOriginal} />}
        <p className="share__note">{t('share.check.note')}</p>
        <div className="share__footer">
          <Button variant="solid" onClick={close}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
