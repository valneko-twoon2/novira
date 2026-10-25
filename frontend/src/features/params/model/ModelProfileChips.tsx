// Recommended values of the selected model as chips, with a mismatch hint and an "apply recommended" button.
import { CheckCircle, Warning } from '@phosphor-icons/react';
import { samplingLabel, type ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { useParams } from '@/state/params';
import { toast } from '@/state/toasts';
import { Button, Popover, PopoverContent, PopoverTrigger } from '@/ui';
import { SCHEDULER_LABELS } from '../labels';
import { modelProfile, profileMismatches, type ProfileKey } from './modelProfile';
import { applyRecommended } from './selectMainModel';

export function ModelProfilePopover({ model }: { model: ModelConfig }) {
  const steps = useParams((s) => s.steps);
  const cfgScale = useParams((s) => s.cfgScale);
  const scheduler = useParams((s) => s.scheduler);
  const width = useParams((s) => s.width);
  const height = useParams((s) => s.height);
  const p = modelProfile(model);
  const bad = profileMismatches(p, { steps, cfgScale, scheduler, width, height });
  const chip = (key: ProfileKey, text: string) => (
    <span key={key} className={bad.includes(key) ? 'pp-pchip is-off' : 'pp-pchip'}>
      {text}
    </span>
  );
  const hint: Record<ProfileKey, string> = {
    steps:
      steps < p.stepsRange[0]
        ? t('params.profile.mismatch.stepsLow', { value: p.steps, min: p.stepsRange[0] })
        : t('params.profile.mismatch.stepsHigh', { value: p.steps, max: p.stepsRange[1] }),
    cfg: t('params.profile.mismatch.cfg', { value: p.cfgScale }),
    scheduler: t('params.profile.mismatch.scheduler', { value: SCHEDULER_LABELS[p.scheduler] }),
    size: t('params.profile.mismatch.size', { value: `${p.width}×${p.height}` }),
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="xs"
          variant="ghost"
          scheme={bad.length ? 'accent' : 'base'}
          leftIcon={bad.length ? <Warning weight="fill" /> : <CheckCircle weight="fill" />}
          title={bad.length ? hint[bad[0] as ProfileKey] : t('params.profile.matches')}
          data-testid="model-profile-trigger"
        >
          {t('params.profile.title')}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="pp-profilepop">
    <div className="pp-profile" data-testid="model-profile">
      <div className="pp-profile__top">
        <b>{t('params.profile.title')}</b>
        {bad.length === 0 ? (
          <span className="pp-profile__ok" title={t('params.profile.matches')}>
            <CheckCircle size={14} weight="fill" />
            {t('params.profile.matches')}
          </span>
        ) : (
          <Button
            size="xs"
            scheme="accent"
            variant="outline"
            data-testid="apply-recommended"
            onClick={() => {
              applyRecommended(model);
              toast({ status: 'success', title: t('params.profile.applied') });
            }}
          >
            {t('params.profile.apply')}
          </Button>
        )}
      </div>
      <div className="pp-chips">
        {chip('steps', t('params.profile.steps', { value: p.steps }))}
        {chip('cfg', t('params.profile.cfg', { value: p.cfgScale }))}
        {chip('scheduler', p.fixedSampling ? samplingLabel(p.fixedSampling) : SCHEDULER_LABELS[p.scheduler])}
        {chip('size', `${p.width}×${p.height}`)}
        {p.quality && (
          <span className="pp-pchip pp-pchip--tags" title={p.quality}>
            {t('params.profile.qualityTags')}
          </span>
        )}
      </div>
      {bad.length > 0 && (
        <ul className="pp-profile__hints">
          {bad.map((k) => (
            <li key={k}>{hint[k]}</li>
          ))}
        </ul>
      )}
    </div>
      </PopoverContent>
    </Popover>
  );
}
