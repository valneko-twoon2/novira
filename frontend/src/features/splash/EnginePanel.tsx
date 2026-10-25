// The engine card of the start-up screen: what is happening now, the three steps, and for the download the share done,
// the size, the speed and the time left.
import { Check, Cpu } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { formatRemaining } from '@/state/media/packs';
import type { EngineStatus } from '@/backend';
import { cx, ProgressBar, Spinner } from '@/ui';

export const ENGINE_STEPS = ['downloading', 'extracting', 'starting'] as const;
export type EngineStep = (typeof ENGINE_STEPS)[number];

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${Math.round(mb)} MB`;
}

export { formatRemaining };

/** Bytes per second over the last few seconds of a download, or null until there is enough to say. */
export function useTransferRate(bytes: number, active: boolean): number | null {
  const samples = useRef<{ at: number; bytes: number }[]>([]);
  const [rate, setRate] = useState<number | null>(null);
  useEffect(() => {
    if (!active) {
      samples.current = [];
      setRate(null);
      return;
    }
    const now = Date.now();
    const list = samples.current;
    list.push({ at: now, bytes });
    while (list.length > 2 && now - list[0]!.at > 6000) list.shift();
    const first = list[0]!;
    const span = (now - first.at) / 1000;
    setRate(span >= 1.5 && bytes > first.bytes ? (bytes - first.bytes) / span : null);
  }, [bytes, active]);
  return rate;
}

/** The one card every start-up message is shown in: a badge, what is going on, and the details below. */
export function StartupCard({ icon, heading, sub, tone, testId, children }: { icon: ReactNode; heading: string; sub?: string; tone?: 'error'; testId: string; children?: ReactNode }) {
  return (
    <div className={cx('ep', tone === 'error' && 'is-error')} role={tone === 'error' ? 'alert' : 'status'} data-testid={testId}>
      <div className="ep__head">
        <span className="ep__badge">{icon}</span>
        <div className="ep__heading">
          <div className="ep__title">{heading}</div>
          {sub && <div className="ep__sub">{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Start-up work with no steps to show (waiting for the app to load, or for the engine to answer). */
export function WaitCard({ heading, sub }: { heading: string; sub: string }) {
  return (
    <StartupCard icon={<Cpu size={22} weight="duotone" />} heading={heading} sub={sub} testId="splash-wait">
      <div className="ep__progress">
        <ProgressBar value={0} indeterminate className="ep__bar" />
      </div>
    </StartupCard>
  );
}

export function EnginePanel({ status }: { status: Extract<EngineStatus, { state: 'downloading' | 'extracting' | 'starting' }> }) {
  const stepIndex = ENGINE_STEPS.indexOf(status.state);
  const downloading = status.state === 'downloading';
  const total = downloading ? status.totalBytes : 0;
  const done = downloading ? status.bytes : 0;
  const rate = useTransferRate(done, downloading);
  const fraction = total > 0 ? Math.min(1, done / total) : 0;
  const remaining = rate && total > done ? (total - done) / rate : null;
  return (
    <StartupCard icon={<Cpu size={22} weight="duotone" />} heading={t('splash.engine.heading')} sub={t(`splash.engine.sub.${status.state}`)} testId="splash-engine">
      <ol className="ep__steps">
        {ENGINE_STEPS.map((step, i) => (
          <li key={step} className={cx('ep__step', i < stepIndex && 'is-done', i === stepIndex && 'is-active')}>
            <span className="ep__dot">{i < stepIndex ? <Check size={12} weight="bold" /> : i === stepIndex ? <Spinner size={12} /> : i + 1}</span>
            <span className="ep__label">{t(`splash.step.${step}`)}</span>
          </li>
        ))}
      </ol>

      <div className="ep__progress">
        <div className="ep__row">
          <span className="ep__percent">{downloading && total > 0 ? `${Math.round(fraction * 100)}%` : ''}</span>
          <span className="ep__size">{downloading && total > 0 ? t('engine.sizeProgress', { done: formatBytes(done), total: formatBytes(total) }) : ''}</span>
        </div>
        <ProgressBar value={fraction} indeterminate={!downloading || total === 0} className="ep__bar" />
        {downloading && (rate || remaining) && (
          <div className="ep__row ep__row--meta">
            <span>{rate ? t('splash.engine.rate', { rate: formatBytes(rate) }) : ''}</span>
            <span>{remaining ? t('splash.engine.eta', { time: formatRemaining(remaining) }) : ''}</span>
          </div>
        )}
      </div>

      {downloading && <p className="ep__note">{t('engine.firstRunNote')}</p>}
    </StartupCard>
  );
}
