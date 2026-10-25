// Control layer settings: model, weight, begin/end, control mode, filter preview and transparency effect.
import { useEffect } from 'react';
import { t } from '@/i18n';
import { FILTER_TYPES, type ControlEntity, type ControlMode, type FilterType } from '@/state/canvas';
import { useCanvasStore, useCanvasStoreApi } from '@/state/canvasStoreContext';
import { findModel } from '@/state/models';
import { Button, Field, Select, SliderNumber, Switch } from '@/ui';
import { applyFilterPreview, processFilter } from '../../actions';
import { CONTROL_MODE_LABEL, FILTER_LABEL } from '../../names';
import { useCompatibleModels } from '../useCompatibleModels';
import { OpacityField } from './OpacityField';

const CONTROL_TYPES = ['controlnet', 't2i_adapter', 'model_patch'] as const;
const MODES: ControlMode[] = ['balanced', 'more_prompt', 'more_control'];

export function ControlSettings({ entity }: { entity: ControlEntity }) {
  const update = useCanvasStore((s) => s.updateEntity);
  const preview = useCanvasStore((s) => s.filterPreviews[entity.id]);
  const autoProcess = useCanvasStore((s) => s.settings.autoProcess);
  const setPreview = useCanvasStore((s) => s.setFilterPreview);
  const store = useCanvasStoreApi();
  const { options } = useCompatibleModels([...CONTROL_TYPES]);
  const isControlNet = findModel(entity.modelKey)?.type !== 't2i_adapter';
  const id = entity.id;

  useEffect(() => {
    if (autoProcess && entity.filter !== 'none') void processFilter(id, store);
    if (entity.filter === 'none') setPreview(id, null);
  }, [entity.filter, entity.objects, autoProcess, id, setPreview, store]);

  return (
    <div className="canvas-settings">
      <Field label={t('common.model')}>
        <Select
          value={entity.modelKey}
          options={options}
          placeholder={options.length ? t('canvas.control.selectModel') : t('canvas.control.noModels')}
          onChange={(modelKey) => update(id, { modelKey })}
          aria-label={t('common.model')}
        />
      </Field>
      <Field label={t('canvas.control.weight')}>
        <SliderNumber
          value={entity.weight}
          onChange={(weight) => update(id, { weight }, { history: `weight:${id}` })}
          min={0}
          max={2}
          step={0.01}
          precision={2}
          aria-label={t('canvas.control.weight')}
        />
      </Field>
      <Field label={t('canvas.control.begin')}>
        <SliderNumber
          value={entity.beginEnd[0]}
          onChange={(v) => update(id, { beginEnd: [Math.min(v, entity.beginEnd[1]), entity.beginEnd[1]] }, { history: `be:${id}` })}
          min={0}
          max={1}
          step={0.01}
          precision={2}
          aria-label={t('canvas.control.begin')}
        />
      </Field>
      <Field label={t('canvas.control.end')}>
        <SliderNumber
          value={entity.beginEnd[1]}
          onChange={(v) => update(id, { beginEnd: [entity.beginEnd[0], Math.max(v, entity.beginEnd[0])] }, { history: `be:${id}` })}
          min={0}
          max={1}
          step={0.01}
          precision={2}
          aria-label={t('canvas.control.end')}
        />
      </Field>
      {isControlNet && (
        <Field label={t('canvas.control.controlMode')}>
          <Select
            value={entity.controlMode}
            options={MODES.map((m) => ({ value: m, label: t(CONTROL_MODE_LABEL[m]) }))}
            onChange={(controlMode) => update(id, { controlMode })}
            aria-label={t('canvas.control.controlMode')}
          />
        </Field>
      )}
      <Field label={t('canvas.control.filter')}>
        <Select<FilterType>
          value={entity.filter}
          options={FILTER_TYPES.map((f) => ({ value: f, label: t(FILTER_LABEL[f]) }))}
          onChange={(filter) => update(id, { filter })}
          aria-label={t('canvas.control.filter')}
        />
      </Field>
      {entity.filter !== 'none' && (
        <div className="canvas-settings__buttons">
          <Button size="xs" onClick={() => void processFilter(id, store)}>
            {t('canvas.control.process')}
          </Button>
          <Button size="xs" scheme="accent" disabled={!preview} onClick={() => applyFilterPreview(id, store)}>
            {t('common.apply')}
          </Button>
          <Button size="xs" variant="ghost" disabled={!preview} onClick={() => setPreview(id, null)}>
            {t('common.cancel')}
          </Button>
        </div>
      )}
      <Field label={t('canvas.control.transparencyEffect')}>
        <Switch
          checked={entity.withTransparencyEffect}
          onChange={(v) => update(id, { withTransparencyEffect: v })}
          aria-label={t('canvas.control.transparencyEffect')}
        />
      </Field>
      <OpacityField entity={entity} />
    </div>
  );
}
