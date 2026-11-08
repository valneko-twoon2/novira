// "Generate with AI" in the left column, in the order and with the parts of the Generate screen: the seed, the run button with the
// count, the model card (its picture and the same model picker, with "automatic" first), the look and words, then the folded details. The candidates it makes are in the strip under the canvas (TextCandidates).
import { Lightning, Stop } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { randomSeed } from '@/backend';
import { SeedControl } from '@/features/media/SeedControl';
import { t, type MessageKey } from '@/i18n';
import { useModels, drawableModels } from '@/state/models';
import { useParams } from '@/state/params';
import { RICH_COUNT, useRichForm } from '@/state/text/richForm';
import { RICH_LOOK_IDS, type RichLookId } from '@/state/text/richLooks';
import type { TextLayer } from '@/state/text/textModel';
import { Button, CoverImage, Field, IconButton, ModelPicker, NumberInput, Section, SliderNumber, Textarea } from '@/ui';
import { richPlan } from './richRequest';
import { cancelRich, runRich, useRichRun } from './richRun';

const LOOK_LABELS: Record<RichLookId, MessageKey> = {
  gold: 'text.rich.look.gold',
  fire: 'text.rich.look.fire',
  ice: 'text.rich.look.ice',
  neon: 'text.rich.look.neon',
  stone: 'text.rich.look.stone',
  candy: 'text.rich.look.candy',
  chrome: 'text.rich.look.chrome',
};

/** `layer` is the selected text layer, or null when something else (or nothing) is selected: the form stays, the run waits. */
export function RichSection({ layer }: { layer: TextLayer | null }) {
  const form = useRichForm((s) => s.form);
  const setForm = useRichForm((s) => s.setForm);
  const models = useModels((s) => s.models);
  const generateKey = useParams((s) => s.modelKey);
  const run = useRichRun((s) => (layer ? s.running[layer.id] : undefined));
  const drawable = useMemo(() => drawableModels(models), [models]);
  const plan = useMemo(() => richPlan(models, form.modelKey, generateKey), [models, form.modelKey, generateKey]);
  const empty = !layer || layer.text.trim() === '';
  const running = run !== undefined;

  return (
    <div className="tx-rich" data-testid="text-rich">
      <SeedControl
        seed={form.seed}
        random={form.randomSeed}
        onSeed={(seed) => setForm({ seed })}
        onRandom={(randomSeed) => setForm({ randomSeed })}
        onShuffle={() => setForm({ seed: randomSeed() })}
      />
      <div className="tx-run">
        <Button
          variant="solid"
          scheme="invoke"
          size="lg"
          leftIcon={<Lightning weight="fill" />}
          isLoading={running}
          disabled={!plan.model || empty || running}
          onClick={() => layer && void runRich(layer.id)}
          data-testid="text-rich-run"
        >
          {t('params.invoke.invoke')}
        </Button>
        <div className="tx-run__count">
          <span aria-hidden>×</span>
          <NumberInput value={form.count} min={RICH_COUNT.min} max={RICH_COUNT.max} onChange={(count) => setForm({ count })} aria-label={t('text.rich.count')} />
        </div>
        <IconButton label={t('text.rich.cancel')} icon={<Stop weight="bold" />} size="md" disabled={!running} onClick={() => layer && cancelRich(layer.id)} data-testid="text-rich-cancel" />
      </div>
      {!layer && <p className="tx-note">{t('text.rich.select')}</p>}
      {!plan.model ? (
        <p className="tx-note" data-testid="text-rich-nomodel">
          {t('text.rich.noModel')}
        </p>
      ) : (
        !plan.control && (
          <p className="tx-note" data-testid="text-rich-nocontrol">
            {t('text.rich.noControl')}
          </p>
        )
      )}
      <section className="tx-model" data-testid="text-rich-model-card">
        {/* The picture is of the model that will paint: the chosen one, or the one "automatic" picks. */}
        <CoverImage model={plan.model ?? undefined} zoomable />
        <div className="tx-model__main">
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
      </section>
      <div className="tx-rich__prompt">
        <div className="tx-add__row" role="group" aria-label={t('text.rich.look')}>
          {RICH_LOOK_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className="tx-chip"
              aria-pressed={form.look === id}
              onClick={() => setForm({ look: form.look === id ? null : id })}
              data-testid={`text-rich-look-${id}`}
            >
              {t(LOOK_LABELS[id])}
            </button>
          ))}
        </div>
        <Textarea
          className="tx-text"
          value={form.words}
          rows={2}
          placeholder={t('text.rich.words.placeholder')}
          aria-label={t('text.rich.words')}
          onChange={(e) => setForm({ words: e.target.value })}
          data-testid="text-rich-words"
        />
      </div>
      <Section title={t('text.rich.details')} defaultOpen={false}>
        <Field label={t('text.rich.strength')}>
          <SliderNumber value={form.strength} min={0} max={100} onChange={(strength) => setForm({ strength })} aria-label={t('text.rich.strength')} />
        </Field>
        <Field label={t('text.rich.spill')}>
          <SliderNumber value={form.spill} min={0} max={100} onChange={(spill) => setForm({ spill })} aria-label={t('text.rich.spill')} />
        </Field>
      </Section>
    </div>
  );
}
