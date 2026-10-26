// "Generation" accordion: main model, LoRAs, scheduler, steps, CFG scale.
import type { SchedulerName } from '@/backend';
import { fixedSampling, SCHEDULERS, samplingLabel } from '@/backend';
import { t, tCount } from '@/i18n';
import { BASE_LABELS } from '@/state/models';
import { useParams } from '@/state/params';
import { Field, Section, Select, SliderNumber } from '@/ui';
import { schedulerLabel } from '../labels';
import { LoraPicker } from '../model/LoraPicker';
import { RecommendedHint } from '../model/RecommendedHint';
import { useMainModel } from '../model/useMainModel';

export function GenerationSection({ showLoras = true }: { showLoras?: boolean }) {
  const main = useMainModel();
  const loraCount = useParams((s) => s.loras.filter((l) => l.isEnabled).length);
  const badges = [main ? BASE_LABELS[main.base] : null, loraCount ? tCount('params.lora.badge', loraCount) : null];
  return (
    <Section title={t('params.generation.title')} badges={badges} defaultOpen>
      {showLoras && <LoraPicker />}
      <SchedulerStepsCfg />
    </Section>
  );
}

function SchedulerStepsCfg() {
  const main = useMainModel();
  const scheduler = useParams((s) => s.scheduler);
  const steps = useParams((s) => s.steps);
  const cfg = useParams((s) => s.cfgScale);
  const set = useParams((s) => s.set);
  // A model of the newer families always runs its family's own sampler and scheduler: show those instead of a choice.
  const fixed = main ? fixedSampling(main) : undefined;
  return (
    <>
      {fixed && main ? (
        <Field label={t('params.generation.scheduler')} info={t('params.generation.schedulerInfo')}>
          <span className="pp-fixed" data-testid="sampling-fixed">
            {samplingLabel(fixed)}
          </span>
        </Field>
      ) : (
        <>
          <Field label={t('params.generation.scheduler')} info={t('params.generation.schedulerInfo')}>
            <Select<SchedulerName>
              value={scheduler}
              onChange={(v) => set({ scheduler: v })}
              aria-label={t('params.generation.scheduler')}
              options={SCHEDULERS.map((s) => ({ value: s, label: schedulerLabel(s, main?.base) }))}
            />
          </Field>
          <RecommendedHint k="scheduler" />
        </>
      )}
      <Field label={t('params.generation.steps')} info={t('params.generation.stepsInfo')}>
        <SliderNumber
          value={steps}
          onChange={(v) => set({ steps: Math.round(v) })}
          min={1}
          max={100}
          numberMax={500}
          step={1}
          marks={[1, 50, 100]}
          aria-label={t('params.generation.steps')}
        />
      </Field>
      <RecommendedHint k="steps" />
      <Field label={t('params.generation.cfg')} info={t('params.generation.cfgInfo')}>
        <SliderNumber
          value={cfg}
          onChange={(v) => set({ cfgScale: v })}
          min={1}
          max={20}
          numberMax={200}
          step={0.5}
          precision={1}
          marks={[1, 10, 20]}
          aria-label={t('params.generation.cfg')}
        />
      </Field>
      <RecommendedHint k="cfg" />
    </>
  );
}
