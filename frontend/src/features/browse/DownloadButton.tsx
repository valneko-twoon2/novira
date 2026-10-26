import { Check, DownloadSimple, Lock } from '@phosphor-icons/react';
import type { CSSProperties } from 'react';
import type { CivitaiFile, CivitaiModel, CivitaiVersion } from '@/backend';
import { t } from '@/i18n';
import { Button, Tooltip } from '@/ui';
import { downloadFile, fileSource, useDownloadState } from './download';
import { paidReason } from './paid';

export function DownloadButton({ model, file, version, size = 'sm', fullWidth = true }: { model: CivitaiModel; file: CivitaiFile; version?: CivitaiVersion; size?: 'sm' | 'md'; fullWidth?: boolean }) {
  const state = useDownloadState(fileSource(model, file), file.name);
  // A paid version is never downloaded from here: the key cannot tell whether it was bought.
  const reason = paidReason(version ?? model.versions[0]);
  if (state.kind === 'installed') {
    return (
      <Button size={size} fullWidth={fullWidth} disabled leftIcon={<Check size={13} weight="bold" />} className="browse-dl is-installed">
        {t('browse.card.installed')}
      </Button>
    );
  }
  if (state.kind === 'queued') {
    const pct = Math.round(state.progress * 100);
    return (
      <Button size={size} fullWidth={fullWidth} disabled className="browse-dl is-busy" style={{ '--browse-progress': `${pct}%` } as CSSProperties}>
        {t('browse.card.installing', { percent: pct })}
      </Button>
    );
  }
  if (reason) {
    return (
      <Tooltip content={reason}>
        <Button size={size} fullWidth={fullWidth} disabled leftIcon={<Lock size={13} weight="bold" />} className="browse-dl is-paid" data-testid="browse-paid-locked">
          {t('browse.paid.locked')}
        </Button>
      </Tooltip>
    );
  }
  return (
    <Button
      scheme="accent"
      size={size}
      fullWidth={fullWidth}
      className="browse-dl"
      leftIcon={<DownloadSimple size={13} weight="bold" />}
      onClick={(e) => {
        e.stopPropagation();
        void downloadFile(model, file);
      }}
    >
      {t('browse.card.download')}
    </Button>
  );
}
