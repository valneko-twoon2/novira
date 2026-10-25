// "Default Settings" for main models. Each setting can be switched off (InvokeAI keeps it unset then).
import { useState, type ReactNode } from 'react';
import { backend, SCHEDULERS, type ModelConfig, type SchedulerName } from '@/backend';
import { t } from '@/i18n';
import { modelsOfType, useModels } from '@/state/models';
import { toast } from '@/state/toasts';
import { Button, Select, SliderNumber, Switch } from '@/ui';

type Defaults = NonNullable<ModelConfig['defaultSettings']> & { vae?: string | null; vaePrecision?: 'fp16' | 'fp32' };
type Key = 'vae' | 'vaePrecision' | 'scheduler' | 'steps' | 'cfgScale' | 'width' | 'height';

const SCHEDULER_LABELS: Record<SchedulerName, string> = {
  euler: 'Euler',
  euler_a: 'Euler Ancestral',
  euler_k: 'Euler Karras',
  dpmpp_2m: 'DPM++ 2M',
  dpmpp_2m_k: 'DPM++ 2M Karras',
  dpmpp_2m_sde_k: 'DPM++ 2M SDE Karras',
  dpmpp_sde_k: 'DPM++ SDE Karras',
  heun: 'Heun',
  lms: 'LMS',
  ddim: 'DDIM',
  unipc: 'UniPC',
  lcm: 'LCM',
  tcd: 'TCD',
};

const FALLBACK = { vae: 'default', vaePrecision: 'fp32' as const, scheduler: 'euler' as SchedulerName, steps: 30, cfgScale: 7, width: 1024, height: 1024 };

export function DefaultSettingsForm({ model }: { model: ModelConfig }) {
  const initial = (model.defaultSettings ?? {}) as Defaults;
  const [enabled, setEnabled] = useState<Record<Key, boolean>>({
    vae: initial.vae !== undefined,
    vaePrecision: initial.vaePrecision !== undefined,
    scheduler: initial.scheduler !== undefined,
    steps: initial.steps !== undefined,
    cfgScale: initial.cfgScale !== undefined,
    width: initial.width !== undefined,
    height: initial.height !== undefined,
  });
  const [values, setValues] = useState({
    vae: initial.vae ?? FALLBACK.vae,
    vaePrecision: initial.vaePrecision ?? FALLBACK.vaePrecision,
    scheduler: initial.scheduler ?? FALLBACK.scheduler,
    steps: initial.steps ?? FALLBACK.steps,
    cfgScale: initial.cfgScale ?? FALLBACK.cfgScale,
    width: initial.width ?? (model.base === 'sd-1' ? 512 : FALLBACK.width),
    height: initial.height ?? (model.base === 'sd-1' ? 512 : FALLBACK.height),
  });
  const [busy, setBusy] = useState(false);
  const allModels = useModels((s) => s.models);
  const vaes = modelsOfType(allModels, 'vae', model.base);

  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) => setValues((prev) => ({ ...prev, [k]: v }));
  const toggle = (k: Key, v: boolean) => setEnabled((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    const next: Defaults = {};
    if (enabled.vae) next.vae = values.vae === 'default' ? null : values.vae;
    if (enabled.vaePrecision) next.vaePrecision = values.vaePrecision;
    if (enabled.scheduler) next.scheduler = values.scheduler;
    if (enabled.steps) next.steps = values.steps;
    if (enabled.cfgScale) next.cfgScale = values.cfgScale;
    if (enabled.width) next.width = values.width;
    if (enabled.height) next.height = values.height;
    setBusy(true);
    try {
      const updated = await backend.updateModel(model.key, { defaultSettings: next });
      useModels.getState().upsertModel(updated);
      toast({ status: 'success', title: t('models.toast.defaultsSaved'), description: model.name });
    } catch (err) {
      toast({ status: 'error', title: t('models.toast.updateFailed'), description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const row = (k: Key, label: string, control: ReactNode) => (
    <div className="mm-default">
      <div className="mm-default__label">
        <span>{label}</span>
        <Switch checked={enabled[k]} onChange={(v) => toggle(k, v)} aria-label={label} />
      </div>
      <div className="mm-default__control">{control}</div>
    </div>
  );

  return (
    <section className="mm-card" data-testid="mm-default-settings">
      <div className="mm-card__header">
        <h3 className="mm-subtitle">{t('models.defaults.title')}</h3>
        <Button size="xs" scheme="accent" isLoading={busy} onClick={() => void save()}>
          {t('common.save')}
        </Button>
      </div>
      <div className="mm-defaults">
        {row(
          'vae',
          t('models.defaults.vae'),
          <Select
            value={values.vae}
            disabled={!enabled.vae}
            onChange={(v) => set('vae', v)}
            options={[{ value: 'default', label: t('models.defaults.vaeDefault') }, ...vaes.map((v) => ({ value: v.key, label: v.name }))]}
            aria-label={t('models.defaults.vae')}
          />,
        )}
        {row(
          'vaePrecision',
          t('models.defaults.vaePrecision'),
          <Select
            value={values.vaePrecision}
            disabled={!enabled.vaePrecision}
            onChange={(v) => set('vaePrecision', v)}
            options={[
              { value: 'fp16', label: 'FP16' },
              { value: 'fp32', label: 'FP32' },
            ]}
            aria-label={t('models.defaults.vaePrecision')}
          />,
        )}
        {row(
          'scheduler',
          t('models.defaults.scheduler'),
          <Select
            value={values.scheduler}
            disabled={!enabled.scheduler}
            onChange={(v) => set('scheduler', v)}
            options={SCHEDULERS.map((s) => ({ value: s, label: SCHEDULER_LABELS[s] }))}
            aria-label={t('models.defaults.scheduler')}
          />,
        )}
        {row('steps', t('models.defaults.steps'), <SliderNumber value={values.steps} onChange={(v) => set('steps', v)} min={1} max={100} disabled={!enabled.steps} aria-label={t('models.defaults.steps')} />)}
        {row(
          'cfgScale',
          t('models.defaults.cfgScale'),
          <SliderNumber value={values.cfgScale} onChange={(v) => set('cfgScale', v)} min={1} max={20} step={0.5} precision={1} disabled={!enabled.cfgScale} aria-label={t('models.defaults.cfgScale')} />,
        )}
        {row('width', t('common.width'), <SliderNumber value={values.width} onChange={(v) => set('width', v)} min={64} max={2048} step={8} disabled={!enabled.width} aria-label={t('common.width')} />)}
        {row('height', t('common.height'), <SliderNumber value={values.height} onChange={(v) => set('height', v)} min={64} max={2048} step={8} disabled={!enabled.height} aria-label={t('common.height')} />)}
      </div>
    </section>
  );
}
