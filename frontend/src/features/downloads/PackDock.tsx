// A small dock that shows the downloads of extra models and extension packs wherever the user is, the way the
// download list of the model browser does: a name, what it is doing, a progress bar, cancel while it runs.
import { ArrowClockwise, Check, PuzzlePiece, Warning, X } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { backend } from '@/backend';
import { t, type MessageKey } from '@/i18n';
import { packFolder } from '@/state/comfy/packCatalog';
import { useNodePacks } from '@/state/comfy/nodePacks';
import { isActive, remainingSeconds, useDownloads, type PackDownload } from '@/state/downloads';
import { formatPackSize, formatRemaining } from '@/state/media/packs';
import { useUi } from '@/state/ui';
import { Button, IconButton, ProgressBar } from '@/ui';
import './downloads.css';

const STEP_KEYS: Record<string, MessageKey> = {
  unpack: 'media.downloads.step.unpack',
  requirements: 'media.downloads.step.requirements',
  'install.py': 'media.downloads.step.setup',
  libraries: 'media.downloads.step.libraries',
  libs: 'media.downloads.step.libraries',
};

const nameOf = (d: PackDownload) => (d.kind === 'model' ? t(`pack.title.${d.pack}`) : packFolder(d.url));

function cancel(d: PackDownload) {
  if (d.kind === 'model') void backend.cancelPack(d.pack);
  else void useNodePacks.getState().cancel(d.url);
}

/** The current time, ticking once a second while `active`, so elapsed times keep counting between reports. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/** How long it takes: the time left when the size and the speed are known, else how long it has been going. */
function timeText(d: PackDownload, now: number): string | null {
  const left = remainingSeconds(d);
  if (left !== null) return t('splash.engine.eta', { time: formatRemaining(left) });
  const elapsed = d.since ? (now - d.since) / 1000 : 0;
  return elapsed >= 5 ? t('media.downloads.elapsed', { time: formatRemaining(elapsed) }) : null;
}

function Line({ d, now }: { d: PackDownload; now: number }) {
  const s = d.status;
  const time = timeText(d, now);
  if (s.state === 'downloading') {
    const sizes = { done: formatPackSize(s.bytes), total: formatPackSize(s.totalBytes) };
    // Several files make one pack: say which file this is, then the bytes of the file in progress.
    const text = s.totalBytes ? (s.count > 1 ? t('pack.downloading', { index: s.index, count: s.count, ...sizes }) : t('media.downloads.bytes', sizes)) : t('media.downloads.starting');
    return (
      <>
        <div className="dl-dock__state">{text}</div>
        {time && (
          <div className="dl-dock__state" data-testid="pack-dock-time">
            {time}
          </div>
        )}
        <ProgressBar value={s.totalBytes ? s.bytes / s.totalBytes : 0} indeterminate={!s.totalBytes} />
      </>
    );
  }
  if (s.state === 'installing') {
    return (
      <>
        <div className="dl-dock__state">{t(STEP_KEYS[s.step] ?? 'media.downloads.step.other')}</div>
        {time && (
          <div className="dl-dock__state" data-testid="pack-dock-time">
            {time}
          </div>
        )}
        <ProgressBar value={0} indeterminate />
      </>
    );
  }
  if (s.state === 'error') {
    return (
      <div className="dl-dock__state is-err" title={s.message}>
        {s.message}
      </div>
    );
  }
  return <div className="dl-dock__state">{t('media.downloads.done')}</div>;
}

export function PackDock() {
  const entries = useDownloads((s) => s.entries);
  const dismiss = useDownloads((s) => s.dismiss);
  const clear = useDownloads((s) => s.clearFinished);
  const restartNeeded = useNodePacks((s) => s.packs?.restartNeeded ?? false);
  const restarting = useNodePacks((s) => s.restarting);
  const restart = useNodePacks((s) => s.restart);
  const setTab = useUi((s) => s.setTab);
  const now = useNow(entries.some((e) => isActive(e.status)));
  if (entries.length === 0) return null;
  const hasFinished = entries.some((e) => !isActive(e.status));
  const needsRestart = restartNeeded && entries.some((e) => e.kind === 'node' && e.status.state === 'ready');
  return (
    <div className="dl-dock" data-testid="pack-dock" aria-live="polite">
      <div className="dl-dock__head">
        <span>{t('media.downloads.title')}</span>
        <span className="dl-dock__actions">
          {entries.some((e) => e.kind === 'node') && (
            <Button size="xs" variant="ghost" leftIcon={<PuzzlePiece size={12} />} onClick={() => setTab('extensions')} data-testid="pack-dock-manage">
              {t('media.downloads.manage')}
            </Button>
          )}
          {hasFinished && (
            <Button size="xs" variant="ghost" onClick={clear}>
              {t('browse.dock.clear')}
            </Button>
          )}
        </span>
      </div>
      <ul>
        {entries.map((d) => (
          <li key={d.key} data-testid="pack-dock-item" data-state={d.status.state}>
            <div className="dl-dock__row">
              <span className="dl-dock__name" title={nameOf(d)}>
                {nameOf(d)}
              </span>
              {d.status.state === 'ready' && <Check size={13} weight="bold" className="is-ok" />}
              {d.status.state === 'error' && <Warning size={13} className="is-err" />}
              {isActive(d.status) ? (
                <IconButton size="xs" label={t('browse.dock.cancel')} icon={<X size={11} />} onClick={() => cancel(d)} />
              ) : (
                <IconButton size="xs" label={t('common.close')} icon={<X size={11} />} onClick={() => dismiss(d.key)} />
              )}
            </div>
            <Line d={d} now={now} />
          </li>
        ))}
      </ul>
      {needsRestart && (
        <Button size="xs" variant="solid" leftIcon={<ArrowClockwise size={12} />} isLoading={restarting} onClick={() => void restart()} data-testid="pack-dock-restart">
          {t('media.downloads.restart')}
        </Button>
      )}
    </div>
  );
}
