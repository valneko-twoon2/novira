// One axis of the comparison grid: which setting varies, and the values it takes.
import { t } from '@/i18n';
import { AXIS_KINDS, type AxisKind } from '@/state/xyplot';
import { Checkbox, Select, Textarea, TextInput } from '@/ui';

export interface AxisInput {
  kind: AxisKind | null;
  /** The text of a number or prompt axis. */
  text: string;
  /** The picked values of a scheduler or model axis. */
  choices: string[];
}

export interface ChoiceOption {
  value: string;
  label: string;
}

const NONE = 'none';

export function AxisEditor({
  title,
  testId,
  input,
  onChange,
  options,
  error,
  disabled,
}: {
  title: string;
  testId: string;
  input: AxisInput;
  onChange: (next: AxisInput) => void;
  /** What a scheduler or model axis can pick from. */
  options: { scheduler: ChoiceOption[]; model: ChoiceOption[] };
  error: string | null;
  disabled?: boolean;
}) {
  const kind = input.kind;
  const choiceList = kind === 'scheduler' || kind === 'model' ? options[kind] : null;
  const toggle = (value: string, on: boolean) => onChange({ ...input, choices: on ? [...input.choices, value] : input.choices.filter((c) => c !== value) });
  return (
    <fieldset className="xyp__axis" data-testid={testId} disabled={disabled}>
      <legend>{title}</legend>
      <Select
        value={kind ?? NONE}
        onChange={(v) => onChange({ ...input, kind: v === NONE ? null : (v as AxisKind), choices: [] })}
        options={[{ value: NONE, label: t('xyplot.axis.none') }, ...AXIS_KINDS.map((k) => ({ value: k, label: t(`xyplot.axis.${k}`) }))]}
        aria-label={title}
      />
      {kind === 'prompt' && <Textarea value={input.text} onChange={(e) => onChange({ ...input, text: e.target.value })} rows={3} aria-label={t('xyplot.promptValues')} data-testid={`${testId}-values`} />}
      {kind && kind !== 'prompt' && !choiceList && (
        <label className="xyp__values">
          <span>{t('xyplot.values')}</span>
          <TextInput value={input.text} onChange={(e) => onChange({ ...input, text: e.target.value })} data-testid={`${testId}-values`} />
        </label>
      )}
      {choiceList && (
        <div className="xyp__choices" role="group" aria-label={t('xyplot.choices')} data-testid={`${testId}-choices`}>
          {choiceList.length ? choiceList.map((o) => <Checkbox key={o.value} checked={input.choices.includes(o.value)} onChange={(on) => toggle(o.value, on)} label={o.label} />) : <span className="xyp__hint">{t('xyplot.noModels')}</span>}
        </div>
      )}
      {kind === 'strength' && <span className="xyp__hint">{t('xyplot.strengthNote')}</span>}
      {error && (
        <span className="xyp__error" role="alert">
          {error}
        </span>
      )}
    </fieldset>
  );
}
