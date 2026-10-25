// LoRA picker and the list of added LoRA cards (enable, weight, remove).
import { Trash } from '@phosphor-icons/react';
import type { LoRAParam } from '@/backend';
import { t } from '@/i18n';
import { BASE_LABELS, modelsOfType, useModels } from '@/state/models';
import { useParams } from '@/state/params';
import { CoverImage, cx, Field, IconButton, ModelPicker, Popover, PopoverContent, PopoverTrigger, SliderNumber, Switch } from '@/ui';
import { useMainModel } from './useMainModel';

export function LoraPicker() {
  const models = useModels((s) => s.models);
  const loras = useParams((s) => s.loras);
  const addLora = useParams((s) => s.addLora);
  const base = useMainModel()?.base;
  const available = modelsOfType(models, 'lora', base).filter((m) => !loras.some((l) => l.key === m.key));
  return (
    <>
      <Field label={t('params.lora.label')}>
        <ModelPicker
          models={available}
          value={null}
          onPick={(m) => addLora(m.key)}
          placeholder={available.length ? t('params.lora.add') : t('params.lora.noneAvailable')}
          disabled={!available.length}
          aria-label={t('params.lora.add')}
          testId="lora-picker"
        />
      </Field>
      {loras.length > 0 && (
        <div className="pp-loras">
          {loras.map((l) => (
            <LoraCard key={l.key} lora={l} />
          ))}
        </div>
      )}
    </>
  );
}

function LoraCard({ lora }: { lora: LoRAParam }) {
  const model = useModels((s) => s.models.find((m) => m.key === lora.key));
  const base = useMainModel()?.base;
  const update = useParams((s) => s.updateLora);
  const remove = useParams((s) => s.removeLora);
  const incompatible = !!model && !!base && model.base !== base && model.base !== 'any';
  return (
    <div className={cx('pp-lora', !lora.isEnabled && 'is-disabled', incompatible && 'is-invalid')} data-testid="lora-card">
      <div className="pp-lora__head">
        <CoverImage model={model} className="pp-cover pp-cover--option" zoomable />
        <span className="pp-lora__name">{model?.name ?? lora.key}</span>
        {model && <span className="ui-badge ui-badge--base">{BASE_LABELS[model.base]}</span>}
        <span className="pp-spacer" />
        <Switch checked={lora.isEnabled} onChange={(v) => update(lora.key, { isEnabled: v })} aria-label={t('params.lora.enabled')} />
        <IconButton size="xs" label={t('params.lora.remove')} icon={<Trash />} onClick={() => remove(lora.key)} />
      </div>
      <SliderNumber
        value={lora.weight}
        onChange={(v) => update(lora.key, { weight: v })}
        min={-1}
        max={2}
        step={0.01}
        precision={2}
        marks={[-1, 0, 1, 2]}
        disabled={!lora.isEnabled}
        aria-label={t('params.lora.weight')}
      />
      {model?.triggerPhrases && model.triggerPhrases.length > 0 && <TriggerButton phrases={model.triggerPhrases} />}
    </div>
  );
}

/** Appends phrases to the positive prompt, skipping the ones it already holds as a whole item. */
function addToPrompt(phrases: string[]) {
  const s = useParams.getState();
  const have = s.positivePrompt.split(',').map((x) => x.trim());
  const add = phrases.filter((p) => !have.includes(p.trim()));
  if (!add.length) return;
  s.set({ positivePrompt: s.positivePrompt.trim() ? `${s.positivePrompt}, ${add.join(', ')}` : add.join(', ') });
}

// A LoRA may carry long trigger lists, so they sit in a popover instead of the card.
function TriggerButton({ phrases }: { phrases: string[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="pp-lora__trigger-btn" data-testid="lora-triggers">
          {t('params.lora.triggersCount', { count: phrases.length })}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="pp-lora__trigger-pop">
        <div className="pp-lora__trigger-hint">{t('params.lora.triggersHint')}</div>
        <div className="pp-lora__trigger-list">
          {phrases.map((p) => (
            <button key={p} type="button" className="pp-lora__trigger" title={t('params.lora.insertTrigger')} onClick={() => addToPrompt([p])}>
              {p}
            </button>
          ))}
        </div>
        {phrases.length > 1 && (
          <button type="button" className="pp-lora__trigger-all" onClick={() => addToPrompt(phrases)}>
            {t('params.lora.triggerAll')}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
