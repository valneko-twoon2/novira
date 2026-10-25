import { Check, DownloadSimple } from '@phosphor-icons/react';
import type { CSSProperties } from 'react';
import type { CivitaiFile, CivitaiModel } from '@/backend';
import { t } from '@/i18n';
import { Button } from '@/ui';
import { downloadFile, fileSource, useDownloadState } from './download';

export function DownloadButton({ model, file, size = 'sm', fullWidth = true }: { model: CivitaiModel; file: CivitaiFile; size?: 'sm' | 'md'; fullWidth?: boolean }) {
  const state = useDownloadState(fileSource(model, file), file.name);
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
