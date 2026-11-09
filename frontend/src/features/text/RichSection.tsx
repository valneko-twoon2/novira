// "Generate with AI" in the left column, in the order and with the parts of the Generate screen: the seed row, the Generate bar
// with its queue controls and the model card (its picture and the same model picker, with "automatic" first) in the header;
// the folded details after the prompts. The candidates it makes are in the strip under the canvas (TextCandidates).
import { useMemo } from 'react';
import { randomSeed } from '@/backend';
import { InvokeControls } from '@/features/invoke/InvokeControls';
import { SeedControl } from '@/features/media/SeedControl';
import { t } from '@/i18n';
import { useModels, drawableModels } from '@/state/models';
import { useParams } from '@/state/params';
import { useRichForm } from '@/state/text/richForm';
import { CoverImage, Field, ModelPicker, Section, SliderNumber } from '@/ui';
import { richPlan } from './richRequest';

/** The header's seed row, Generate bar and model card. */
export function RichHeader() {
  const form = useRichForm((s) => s.form);
  const setForm = useRichForm((s) => s.setForm);
  const models = useModels((s) => s.models);
  const generateKey = useParams((s) => s.modelKey);
  const drawable = useMemo(() => drawableModels(models), [models]);
  const plan = useMemo(() => richPlan(models, form.modelKey, generateKey), [models, form.modelKey, generateKey]);
  return (
    <>
      <div className="pp-head__generate" data-testid="text-rich">
        <SeedControl
          seed={form.seed}
          random={form.randomSeed}
          onSeed={(seed) => setForm({ seed })}
          onRandom={(randomSeed) => setForm({ randomSeed })}
          onShuffle={() => setForm({ seed: randomSeed() })}
        />
        <InvokeControls tab="text" />
        {!plan.model && (
          <p className="pp-reason" data-testid="text-rich-nomodel">
            {t('text.rich.noModel')}
          </p>
        )}
      </div>
      <section className="pp-model" data-testid="text-rich-model-card">
        <div className="pp-model__row">
          {/* The picture is of the model that will paint: the chosen one, or the one "automatic" picks. */}
          <CoverImage model={plan.model ?? undefined} zoomable />
          <div className="pp-model__main">
            <ModelPicker
              models={drawable}
              value={form.modelKey && drawable.some((m) => m.key === form.modelKey) ? form.modelKey : null}
              onPick={(m) => setForm({ modelKey: m.key })}
              auto={{ label: t('text.rich.model.auto'), onPick: () => setForm({ modelKey: null }) }}
              placeholder={t('params.model.noModels')}
              disabled={!drawable.length}
              aria-label={t('text.rich.model')}
              testId="text-rich-model"
            />
          </div>
        </div>
      </section>
    </>
  );
}

export function RichDetails() {
  const form = useRichForm((s) => s.form);
  const setForm = useRichForm((s) => s.setForm);
  return (
    <Section title={t('text.rich.details')} defaultOpen={false}>
      <Field label={t('text.rich.strength')}>
        <SliderNumber value={form.strength} min={0} max={100} onChange={(strength) => setForm({ strength })} aria-label={t('text.rich.strength')} />
      </Field>
      <Field label={t('text.rich.spill')}>
        <SliderNumber value={form.spill} min={0} max={100} onChange={(spill) => setForm({ spill })} aria-label={t('text.rich.spill')} />
      </Field>
    </Section>
  );
}
