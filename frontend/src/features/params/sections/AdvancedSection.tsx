// "Advanced" accordion: VAE, VAE precision, CFG rescale, CLIP skip, seamless tiling.
import { t } from '@/i18n';
import { modelsOfType, useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { Field, Section, Select, SliderNumber, Switch } from '@/ui';
import { useMainModel } from '../model/useMainModel';

const DEFAULT_VAE = '__default__';

export function AdvancedSection() {
  const vaeKey = useParams((s) => s.vaeKey);
  const vaePrecision = useParams((s) => s.vaePrecision);
  const cfgRescale = useParams((s) => s.cfgRescale);
  const clipSkip = useParams((s) => s.clipSkip);
  const seamlessX = useParams((s) => s.seamlessX);
  const seamlessY = useParams((s) => s.seamlessY);
  const set = useParams((s) => s.set);
  const models = useModels((s) => s.models);
  const main = useMainModel();
  const vaes = modelsOfType(models, 'vae', main?.base);
  const vae = models.find((m) => m.key === vaeKey);
  const isFlux = main?.base === 'flux';
  const maxClipSkip = main?.base === 'sdxl' ? 24 : 12;

  const badges = [
    vae ? t('params.advanced.badgeVae', { name: vae.name }) : null,
    vaePrecision !== 'fp32' ? vaePrecision : null,
    cfgRescale > 0 ? t('params.advanced.badgeRescale', { value: cfgRescale }) : null,
    clipSkip > 0 ? t('params.advanced.badgeClipSkip', { value: clipSkip }) : null,
    seamlessX && seamlessY ? t('params.advanced.badgeSeamlessXY') : seamlessX ? t('params.advanced.badgeSeamlessX') : seamlessY ? t('params.advanced.badgeSeamlessY') : null,
  ];

  return (
    <Section title={t('params.advanced.title')} badges={badges} defaultOpen={false}>
      <Field label={t('params.advanced.vae')}>
        <Select
          value={vae ? vae.key : DEFAULT_VAE}
          onChange={(v) => set({ vaeKey: v === DEFAULT_VAE ? null : v })}
          aria-label={t('params.advanced.vae')}
          options={[{ value: DEFAULT_VAE, label: t('params.advanced.vaeDefault') }, ...vaes.map((m) => ({ value: m.key, label: m.name }))]}
        />
      </Field>
      <Field label={t('params.advanced.vaePrecision')}>
        <Select<'fp16' | 'fp32'>
          value={vaePrecision}
          onChange={(v) => set({ vaePrecision: v })}
          aria-label={t('params.advanced.vaePrecision')}
          options={[
            { value: 'fp16', label: 'FP16' },
            { value: 'fp32', label: 'FP32' },
          ]}
        />
      </Field>
      {!isFlux && (
        <Field label={t('params.advanced.cfgRescale')} info={t('params.advanced.cfgRescaleInfo')}>
          <SliderNumber
            value={cfgRescale}
            onChange={(v) => set({ cfgRescale: v })}
            min={0}
            max={0.99}
            step={0.01}
            precision={2}
            marks={[0, 0.5, 0.99]}
            aria-label={t('params.advanced.cfgRescale')}
          />
        </Field>
      )}
      {!isFlux && (
        <Field label={t('params.advanced.clipSkip')} info={t('params.advanced.clipSkipInfo')}>
          <SliderNumber
            value={Math.min(clipSkip, maxClipSkip)}
            onChange={(v) => set({ clipSkip: Math.round(v) })}
            min={0}
            max={maxClipSkip}
            step={1}
            marks={[0, maxClipSkip / 2, maxClipSkip]}
            aria-label={t('params.advanced.clipSkip')}
          />
        </Field>
      )}
      <Field label={t('params.advanced.seamless')} info={t('params.advanced.seamlessInfo')}>
        <label className="pp-inline-switch">
          <span>{t('params.advanced.seamlessX')}</span>
          <Switch checked={seamlessX} onChange={(v) => set({ seamlessX: v })} aria-label={t('params.advanced.seamlessX')} />
        </label>
        <label className="pp-inline-switch">
          <span>{t('params.advanced.seamlessY')}</span>
          <Switch checked={seamlessY} onChange={(v) => set({ seamlessY: v })} aria-label={t('params.advanced.seamlessY')} />
        </label>
      </Field>
    </Section>
  );
}
