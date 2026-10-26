// Settings → Backup: create a backup of the user's data and restore one. The desktop app asks for the file
// in a native dialog; restoring asks for confirmation here, then the app restarts to apply it.
import { Archive, ArrowCounterClockwise, Warning } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { backend, hasNativeDialogs, type BackupInfo, type BackupProgress } from '@/backend';
import { getLocale, t } from '@/i18n';
import { toast } from '@/state/toasts';
import { collectUiState } from '@/state/uiState';
import { Button, Modal, ProgressBar } from '@/ui';
import { Row, SectionBlock } from './settingsLayout';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The date a backup was made, in the UI language. */
export function backupDate(createdAt: number): string {
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(createdAt));
}

function RestoreConfirm({ info, onCancel, onConfirm, busy }: { info: BackupInfo; onCancel: () => void; onConfirm: () => void; busy: boolean }) {
  return (
    <Modal open onOpenChange={(o) => !o && onCancel()} title={t('share.backup.confirmTitle')} size="sm" closeLabel={t('common.close')}>
      <div className="st-restore" data-testid="restore-confirm">
        <p className="st-restore__made">{t('share.backup.made', { date: backupDate(info.createdAt) })}</p>
        <p className="st-restore__contents">{t('share.backup.contents', { images: info.images, boards: info.boards, workflows: info.workflows })}</p>
        <p className="st-restore__warning">
          <Warning size={16} weight="fill" />
          <span>{t('share.backup.warning')}</span>
        </p>
        <p className="st-row__help">{t('share.backup.keysNote')}</p>
        <div className="st-restore__footer">
          <Button variant="outline" onClick={onCancel} data-testid="restore-confirm-cancel">
            {t('common.cancel')}
          </Button>
          <Button scheme="danger" isLoading={busy} onClick={onConfirm} data-testid="restore-confirm-run">
            {t('share.backup.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function BackupSection() {
  const mock = backend.kind === 'mock';
  const [busy, setBusy] = useState<'create' | 'restore' | 'confirm' | null>(null);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [pending, setPending] = useState<BackupInfo | null>(null);

  useEffect(
    () =>
      backend.subscribe((e) => {
        if (e.type === 'backup') setProgress(e.progress);
      }),
    [],
  );

  const create = async () => {
    setBusy('create');
    try {
      const summary = await backend.createBackup(collectUiState(localStorage));
      if (summary) toast({ status: 'success', title: t('share.backup.created', { file: summary.fileName }) });
    } catch (e) {
      toast({ status: 'error', title: t('share.backup.createFailed'), description: errorText(e) });
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const chooseBackup = async () => {
    setBusy('restore');
    try {
      const info = await backend.openBackup();
      if (info) setPending(info);
    } catch (e) {
      toast({ status: 'error', title: t('share.backup.openFailed'), description: errorText(e) });
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const cancel = () => {
    setPending(null);
    backend.discardRestore().catch(() => undefined);
  };

  const confirm = async () => {
    setBusy('confirm');
    try {
      // The desktop app restarts from here and applies the backup before it opens its data.
      await backend.confirmRestore();
      if (mock) {
        toast({ status: 'info', title: t('share.backup.mockRestore') });
        setPending(null);
      }
    } catch (e) {
      toast({ status: 'error', title: t('share.backup.restoreFailed'), description: errorText(e) });
    } finally {
      setBusy(null);
    }
  };

  const running = busy === 'create' || busy === 'restore';
  // The backup file is picked in the desktop's own dialog; a page on the browser server has none.
  const available = hasNativeDialogs();
  return (
    <SectionBlock title={t('share.backup.section')}>
      <div className="st-group" data-testid="settings-backup">
        <Row label={t('share.backup.createLabel')} help={t('share.backup.createHelp')}>
          <Button size="sm" leftIcon={<Archive size={14} />} isLoading={busy === 'create'} disabled={running || !available} onClick={() => void create()} data-testid="backup-create">
            {t('share.backup.create')}
          </Button>
        </Row>
        <Row label={t('share.backup.restoreLabel')} help={t('share.backup.restoreHelp')} note={t('share.backup.keysNote')}>
          <Button size="sm" leftIcon={<ArrowCounterClockwise size={14} />} isLoading={busy === 'restore'} disabled={running || !available} onClick={() => void chooseBackup()} data-testid="backup-restore">
            {t('share.backup.restore')}
          </Button>
        </Row>
        {!available && (
          <p className="st-row__help st-backup__note" data-testid="backup-desktop-only">
            {t('common.desktopOnly')}
          </p>
        )}
        {progress && running && (
          <div className="st-progress" data-testid="backup-progress">
            <span>{t(progress.phase === 'create' ? 'share.backup.progressCreate' : 'share.backup.progressRestore', { done: progress.done, total: progress.total })}</span>
            <ProgressBar value={progress.total ? progress.done / progress.total : 0} />
          </div>
        )}
        {mock && <p className="st-row__help st-backup__note">{t('share.backup.mockNote')}</p>}
      </div>
      {pending && <RestoreConfirm info={pending} busy={busy === 'confirm'} onCancel={cancel} onConfirm={() => void confirm()} />}
    </SectionBlock>
  );
}
