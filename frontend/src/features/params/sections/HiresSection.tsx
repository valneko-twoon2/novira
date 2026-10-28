// "High-resolution fix" accordion of the Generate tab: draw small, enlarge, and draw the details again in one job.
import { Warning } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useInvokeWarnings } from '@/state/invoke';
import { modelsOfType, useModels } from '@/state/models';
import { HIRES_RANGE, hiresSize, useParams } from '@/state/params';
import { Field, Section, Select, SliderNumber, Switch } from '@/ui';

const SMOOTH = '__smooth__';

export function HiresSection() {
  const h = useParams((s) => s.hires);
  const width = useParams((s) => s.width);
  const height = useParams((s) => s.height);
  const setHires = useParams((s) => s.setHires);
  const models = useModels((s) => s.models);
  const warnings = useInvokeWarnings('generate');
  const upscalers = modelsOfType(models, 'spandrel_image_to_image');
  const chosen = upscalers.some((m) => m.key === h.upscaleModelKey) ? h.upscaleModelKey! : SMOOTH;
  const out = hiresSize(width, height, h.scale);
  const badges = h.enabled ? [`×${h.scale}`, `${out.width}×${out.height}`] : [];

  return (
    <Section title={t('params.hires.title')} badges={badges} defaultOpen={h.enabled}>
      <div data-testid="hires-section" className="pp-hires">
        <Field label={t('params.hires.enable')} info={t('params.hires.info')}>
          <Switch checked={h.enabled} onChange={(v) => setHires({ enabled: v })} aria-label={t('params.hires.enable')} />
        </Field>
        <Field label={t('params.hires.scale')} info={t('params.hires.scaleInfo')}>
          <SliderNumber
            value={h.scale}
            onChange={(v) => setHires({ scale: v })}
            min={HIRES_RANGE.scale.min}
            max={HIRES_RANGE.scale.max}
            step={HIRES_RANGE.scale.step}
            precision={2}
            marks={[HIRES_RANGE.scale.min, HIRES_RANGE.scale.default, HIRES_RANGE.scale.max]}
            disabled={!h.enabled}
            aria-label={t('params.hires.scale')}
          />
        </Field>
        <Field label={t('params.hires.strength')} info={t('params.hires.strengthInfo')}>
          <SliderNumber
            value={h.strength}
            onChange={(v) => setHires({ strength: v })}
            min={HIRES_RANGE.strength.min}
            max={HIRES_RANGE.strength.max}
            step={HIRES_RANGE.strength.step}
            precision={2}
            marks={[HIRES_RANGE.strength.min, HIRES_RANGE.strength.default, HIRES_RANGE.strength.max]}
            disabled={!h.enabled}
            aria-label={t('params.hires.strength')}
          />
        </Field>
        <Field label={t('params.hires.method')} info={t('params.hires.methodInfo')}>
          <Select
            value={chosen}
            onChange={(v) => setHires({ upscaleModelKey: v === SMOOTH ? null : v })}
            disabled={!h.enabled}
            aria-label={t('params.hires.method')}
            options={[{ value: SMOOTH, label: t('params.hires.methodSmooth') }, ...upscalers.map((m) => ({ value: m.key, label: m.name }))]}
          />
        </Field>
        <Field label={t('params.hires.steps')} info={t('params.hires.stepsInfo')}>
          <SliderNumber
            value={h.steps}
            onChange={(v) => setHires({ steps: Math.round(v) })}
            min={HIRES_RANGE.steps.min}
            max={HIRES_RANGE.steps.max}
            step={1}
            marks={[0, 50, 100]}
            disabled={!h.enabled}
            aria-label={t('params.hires.steps')}
          />
        </Field>
        {h.enabled && (
          <p className="pp-hint" data-testid="hires-output">
            {h.steps === 0 ? t('params.hires.outputSameSteps', { width: out.width, height: out.height }) : t('params.hires.output', { width: out.width, height: out.height, steps: h.steps })}
          </p>
        )}
        {h.enabled &&
          warnings.map((w) => (
            <div key={w} className="pp-inline-warning" role="status">
              <Warning size={14} weight="fill" />
              <span>{w}</span>
            </div>
          ))}
      </div>
    </Section>
  );
}
