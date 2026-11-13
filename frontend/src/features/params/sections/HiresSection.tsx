// "High-resolution fix" accordion of the Generate tab: draw small, enlarge, and draw the details again in one job, or
// only enlarge (an upscale model keeps the picture as it was drawn, and it is quicker).
import { Warning } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useInvokeWarnings } from '@/state/invoke';
import { modelsOfType, useModels } from '@/state/models';
import { HIRES_RANGE, hiresRedraws, hiresSize, useParams } from '@/state/params';
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
  const redraw = hiresRedraws(h);
  const out = hiresSize(width, height, h.scale);
  const badges = h.enabled ? [`×${h.scale}`, `${out.width}×${out.height}`] : [];
  // Enlarging only may go further than a redraw, which breaks up when the size is far beyond the model's.
  const maxScale = redraw ? HIRES_RANGE.scale.max : HIRES_RANGE.scaleUpscaleMax;
  const setMode = (v: string) => {
    const mode = v === 'upscale' ? 'upscale' : 'redraw';
    setHires(mode === 'redraw' && h.scale > HIRES_RANGE.scale.max ? { mode, scale: HIRES_RANGE.scale.max } : { mode });
  };

  return (
    <Section title={t('params.hires.title')} badges={badges} defaultOpen={h.enabled}>
      <div data-testid="hires-section" className="pp-hires">
        <Field label={t('params.hires.enable')} info={t('params.hires.info')}>
          <Switch checked={h.enabled} onChange={(v) => setHires({ enabled: v })} aria-label={t('params.hires.enable')} />
        </Field>
        <Field label={t('params.hires.mode')} info={t('params.hires.modeInfo')}>
          <Select
            value={redraw ? 'redraw' : 'upscale'}
            onChange={setMode}
            disabled={!h.enabled}
            aria-label={t('params.hires.mode')}
            options={[
              { value: 'redraw', label: t('params.hires.modeRedraw') },
              { value: 'upscale', label: t('params.hires.modeUpscale') },
            ]}
          />
        </Field>
        <Field label={t('params.hires.scale')} info={t('params.hires.scaleInfo')}>
          <SliderNumber
            value={h.scale}
            onChange={(v) => setHires({ scale: v })}
            min={HIRES_RANGE.scale.min}
            max={maxScale}
            step={HIRES_RANGE.scale.step}
            precision={2}
            marks={[HIRES_RANGE.scale.min, HIRES_RANGE.scale.default, maxScale]}
            disabled={!h.enabled}
            aria-label={t('params.hires.scale')}
          />
        </Field>
        {redraw && (
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
        )}
        <Field label={t('params.hires.method')} info={t('params.hires.methodInfo')}>
          <Select
            value={chosen}
            onChange={(v) => setHires({ upscaleModelKey: v === SMOOTH ? null : v })}
            disabled={!h.enabled}
            aria-label={t('params.hires.method')}
            options={[{ value: SMOOTH, label: t('params.hires.methodSmooth') }, ...upscalers.map((m) => ({ value: m.key, label: m.name }))]}
          />
        </Field>
        {redraw && (
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
