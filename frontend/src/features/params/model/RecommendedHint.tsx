// Small "recommended value" line under a parameter: shows the model's recommended value and applies it on click.
import { Check } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useParams } from '@/state/params';
import { schedulerLabel } from '../labels';
import { modelProfile } from './modelProfile';
import { useMainModel } from './useMainModel';

export type RecommendedKey = 'steps' | 'cfg' | 'scheduler' | 'width' | 'height';

export function RecommendedHint({ k }: { k: RecommendedKey }) {
  const main = useMainModel();
  const current = useParams((s) => ({ steps: s.steps, cfg: s.cfgScale, scheduler: s.scheduler, width: s.width, height: s.height })[k]);
  const set = useParams((s) => s.set);
  if (!main) return null;
  const p = modelProfile(main);
  const rec = { steps: p.steps, cfg: p.cfgScale, scheduler: p.scheduler, width: p.width, height: p.height }[k];
  const range = k === 'steps' ? p.stepsRange : k === 'cfg' ? p.cfgRange : null;
  const matches = range
    ? (current as number) >= range[0] - 0.01 && (current as number) <= range[1] + 0.01
    : typeof rec === 'number'
      ? Math.abs((current as number) - rec) < 0.01
      : current === rec;
  const text = k === 'scheduler' ? schedulerLabel(p.scheduler, main.base) : range ? t('params.profile.range', { min: range[0], max: range[1], value: rec as number }) : String(rec);
  const apply = () => {
    if (k === 'steps') set({ steps: p.steps });
    else if (k === 'cfg') set({ cfgScale: p.cfgScale });
    else if (k === 'scheduler') set({ scheduler: p.scheduler });
    else if (k === 'width') set({ width: p.width, aspectRatio: 'free' });
    else set({ height: p.height, aspectRatio: 'free' });
  };
  return (
    <div className="pp-rec" data-matches={matches}>
      {matches ? (
        <span className="pp-rec__ok" title={t('params.profile.matches')}>
          <Check size={11} weight="bold" /> {t('params.profile.title')} {text}
        </span>
      ) : (
        <button type="button" className="pp-rec__apply" title={t('params.profile.applyOne')} onClick={apply}>
          {t('params.profile.title')} <b>{text}</b>
        </button>
      )}
    </div>
  );
}
