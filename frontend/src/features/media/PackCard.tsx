// The card that offers a kind of media's extra models for download (video, music, voice, logo) and shows the progress.
import { Eraser, FilmSlate, Lightning, MicrophoneStage, MusicNotes, Sparkle } from '@phosphor-icons/react';
import { useEffect, type ReactNode } from 'react';
import { backend, type PackKind } from '@/backend';
import { t } from '@/i18n';
import { useHardware } from '@/state/hardware';
import { formatGb, usePacks } from '@/state/media/packs';
import { Badge, Button, ProgressBar } from '@/ui';
import { FIT_SCHEME } from './ModelChoice';
import { fitOf, PACK_NEEDS } from './modelFit';
import './media.css';

const ICONS: Record<PackKind, ReactNode> = {
  video: <FilmSlate size={20} />,
  turbo: <Lightning size={20} />,
  music: <MusicNotes size={20} />,
  voice: <MicrophoneStage size={20} />,
  inpaint: <Eraser size={20} />,
  logo: <Sparkle size={20} />,
};

/** Nothing once the pack is installed. */
export function PackCard({ kind }: { kind: PackKind }) {
  const pack = usePacks((s) => s.packs[kind]);
  const vram = useHardware((s) => s.info?.vramBytes);
  useEffect(() => {
    if (pack.state === 'missing') void useHardware.getState().load();
  }, [pack.state]);
  if (pack.state === 'ready') return null;
  const fit = vram === undefined ? null : fitOf(vram, PACK_NEEDS[kind]);
  const busy = pack.state === 'downloading' || pack.state === 'installing';
  return (
    <section className="pk" data-testid={`${kind}-pack`}>
      {ICONS[kind]}
      <div className="pk__body">
        <strong>
          {t(`pack.title.${kind}`)}
          {pack.state === 'missing' && fit && fit !== 'unknown' && (
            <>
              {' '}
              <Badge scheme={FIT_SCHEME[fit]}>{t(`media.choice.fit.${fit}`)}</Badge>
            </>
          )}
        </strong>
        {pack.state === 'missing' && <p>{t(`pack.missing.${kind}`, { size: formatGb(pack.totalBytes) })}</p>}
        {pack.state === 'downloading' && (
          <>
            <p>{t('pack.downloading', { index: pack.index, count: pack.count, done: formatGb(pack.bytes), total: formatGb(pack.totalBytes) })}</p>
            <ProgressBar value={pack.totalBytes ? pack.bytes / pack.totalBytes : 0} />
          </>
        )}
        {pack.state === 'installing' && (
          <>
            <p>{t('pack.installing')}</p>
            <ProgressBar value={0} indeterminate />
          </>
        )}
        {pack.state === 'error' && <p className="pk__error">{pack.message}</p>}
      </div>
      {busy ? (
        <Button size="sm" variant="outline" onClick={() => void backend.cancelPack(kind)}>
          {t('common.cancel')}
        </Button>
      ) : (
        <Button size="sm" variant="solid" scheme="invoke" onClick={() => void backend.installPack(kind)} data-testid={`${kind}-pack-install`}>
          {t(pack.state === 'error' ? 'pack.retry' : 'pack.install')}
        </Button>
      )}
    </section>
  );
}
