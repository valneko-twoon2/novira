// "AI で仕上げる": paints the letters of the selected text layer with an image-to-image run. The look, the model and the
// strength are set here; the candidates are listed under the button and one is the layer's fill.
import { ArrowCounterClockwise, MagicWand, Stop } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { t, type MessageKey } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { useModels, drawableModels } from '@/state/models';
import { useParams } from '@/state/params';
import { RICH_COUNT, useRichForm } from '@/state/text/richForm';
import { RICH_LOOK_IDS, type RichLookId } from '@/state/text/richLooks';
import { richIsCurrent, type TextLayer } from '@/state/text/textModel';
import { Button, Field, NumberInput, Select, SliderNumber, Textarea } from '@/ui';
import { richPlan } from './richRequest';
import { cancelRich, clearRich, pickRichCandidate, runRich, useRichRun } from './richRun';

const LOOK_LABELS: Record<RichLookId, MessageKey> = {
  gold: 'text.rich.look.gold',
  fire: 'text.rich.look.fire',
  ice: 'text.rich.look.ice',
  neon: 'text.rich.look.neon',
  stone: 'text.rich.look.stone',
  candy: 'text.rich.look.candy',
  chrome: 'text.rich.look.chrome',
};

const AUTO = 'auto';

export function RichSection({ layer }: { layer: TextLayer }) {
  const form = useRichForm((s) => s.form);
  const setForm = useRichForm((s) => s.setForm);
  const models = useModels((s) => s.models);
  const generateKey = useParams((s) => s.modelKey);
  const run = useRichRun((s) => s.running[layer.id]);
  const images = useGallery((s) => s.images);
  const drawable = useMemo(() => drawableModels(models), [models]);
  const plan = useMemo(() => richPlan(models, form.modelKey, generateKey), [models, form.modelKey, generateKey]);
  const empty = layer.text.trim() === '';
  const stale = layer.rich !== undefined && !richIsCurrent(layer);
  const urlOf = (name: string) => images.find((i) => i.name === name)?.url;

  return (
    <section className="tx-section" data-testid="text-rich">
      <h3 className="tx-section__title">{t('text.rich.title')}</h3>
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
      <Field label={t('text.rich.model')}>
        <Select
          value={form.modelKey && drawable.some((m) => m.key === form.modelKey) ? form.modelKey : AUTO}
          onChange={(v) => setForm({ modelKey: v === AUTO ? null : v })}
          options={[{ value: AUTO, label: t('text.rich.model.auto') }, ...drawable.map((m) => ({ value: m.key, label: m.name }))]}
          aria-label={t('text.rich.model')}
        />
      </Field>
      <Field label={t('text.rich.strength')}>
        <SliderNumber value={form.strength} min={0} max={100} onChange={(strength) => setForm({ strength })} aria-label={t('text.rich.strength')} />
      </Field>
      <Field label={t('text.rich.spill')}>
        <SliderNumber value={form.spill} min={0} max={100} onChange={(spill) => setForm({ spill })} aria-label={t('text.rich.spill')} />
      </Field>
      <Field label={t('text.rich.count')}>
        <NumberInput value={form.count} min={RICH_COUNT.min} max={RICH_COUNT.max} onChange={(count) => setForm({ count })} aria-label={t('text.rich.count')} />
      </Field>
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
      <div className="tx-add__row">
        <Button
          variant="solid"
          scheme="invoke"
          leftIcon={<MagicWand weight="bold" />}
          isLoading={run !== undefined}
          disabled={!plan.model || empty || run !== undefined}
          onClick={() => void runRich(layer.id)}
          data-testid="text-rich-run"
        >
          {t('text.rich.run')}
        </Button>
        {run && (
          <Button leftIcon={<Stop weight="bold" />} onClick={() => cancelRich(layer.id)} data-testid="text-rich-cancel">
            {t('text.rich.cancel')}
          </Button>
        )}
      </div>
      {layer.rich && (
        <>
          <div className="tx-rich__cands" role="group" aria-label={t('text.rich.candidates')}>
            {layer.rich.candidates.map((name) => {
              const url = urlOf(name);
              return (
                <button
                  key={name}
                  type="button"
                  className="tx-rich__cand"
                  aria-pressed={layer.rich?.imageName === name}
                  onClick={() => pickRichCandidate(layer.id, name)}
                  data-testid="text-rich-candidate"
                >
                  {url && <img src={url} alt="" draggable={false} />}
                </button>
              );
            })}
          </div>
          {stale && (
            <div className="tx-add__row" data-testid="text-rich-stale">
              <p className="tx-note">{t('text.rich.stale')}</p>
              <Button size="sm" leftIcon={<ArrowCounterClockwise />} disabled={!plan.model || empty || run !== undefined} onClick={() => void runRich(layer.id)} data-testid="text-rich-redo">
                {t('text.rich.redo')}
              </Button>
            </div>
          )}
          <Button size="sm" onClick={() => clearRich(layer.id)} data-testid="text-rich-clear">
            {t('text.rich.clear')}
          </Button>
        </>
      )}
    </section>
  );
}
