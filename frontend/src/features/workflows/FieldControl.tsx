// Input control for a node field, shared by the node body and the left panel form.
import { X } from '@phosphor-icons/react';
import { backend, type SchedulerName } from '@/backend';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';
import { modelsOfType, useModels } from '@/state/models';
import { useWorkflows } from '@/state/workflows/workflows';
import { IconButton, ImageDropZone, ModelPicker, NumberInput, Select, SliderNumber, Switch, TextInput, Textarea, type SelectOption } from '@/ui';
import { MODEL_FIELDS } from './fieldTypes';
import { imageName } from './invokeBuilder';
import type { InputTemplate } from './templates';

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

export function FieldControl({ nodeId, input, value, label }: { nodeId: string; input: InputTemplate; value: unknown; label: string }) {
  const setValue = useWorkflows((s) => s.setFieldValue);
  const onChange = (v: unknown) => setValue(nodeId, input.name, v);
  return (
    <div className="wf-control nodrag nowheel">
      <ControlFor input={input} value={value} label={label} onChange={onChange} />
    </div>
  );
}

function ControlFor({ input, value, label, onChange }: { input: InputTemplate; value: unknown; label: string; onChange: (v: unknown) => void }) {
  const models = useModels((s) => s.models);
  const boards = useGallery((s) => s.boards);
  const modelField = MODEL_FIELDS[input.type];
  if (modelField) {
    // The same chooser as the Generate tab: search, thumbnails and the base each model belongs to.
    const list = modelsOfType(models, modelField.modelType, input.base);
    const key = typeof value === 'string' && list.some((m) => m.key === value) ? value : null;
    return (
      <ModelPicker
        models={list}
        value={key}
        onPick={(m) => onChange(m.key)}
        placeholder={list.length ? t('workflows.field.selectModel') : t('workflows.field.noModels')}
        aria-label={label}
      />
    );
  }
  // The other field types are links between nodes, not values typed in a box.
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- they all show no control (default)
  switch (input.type) {
    case 'integer':
    case 'float': {
      const n = typeof value === 'number' ? value : Number(input.default ?? 0);
      const precision = input.type === 'integer' ? 0 : 2;
      if (input.ui === 'slider' && input.min !== undefined && input.max !== undefined)
        return <SliderNumber value={n} onChange={onChange} min={input.min} max={input.max} step={input.step} precision={precision} aria-label={label} />;
      return <NumberInput value={n} onChange={onChange} min={input.min} max={input.max} step={input.step} precision={precision} aria-label={label} />;
    }
    case 'string': {
      const s = typeof value === 'string' ? value : '';
      if (input.ui === 'textarea') return <Textarea value={s} rows={3} onChange={(e) => onChange(e.target.value)} aria-label={label} className="wf-textarea" />;
      return <TextInput value={s} onChange={(e) => onChange(e.target.value)} aria-label={label} />;
    }
    case 'boolean':
      return <Switch checked={value === true} onChange={onChange} aria-label={label} />;
    case 'enum':
      return (
        <Select value={typeof value === 'string' ? value : null} onChange={onChange} options={(input.options ?? []).map((o) => ({ value: o, label: o }))} aria-label={label} />
      );
    case 'SchedulerField':
      return (
        <Select
          value={typeof value === 'string' ? value : null}
          onChange={onChange}
          options={(input.options ?? []).map((o) => ({ value: o, label: SCHEDULER_LABELS[o as SchedulerName] ?? o }))}
          aria-label={label}
        />
      );
    case 'BoardField': {
      const options: SelectOption[] = [
        { value: 'auto', label: t('workflows.field.boardAuto') },
        { value: 'none', label: t('workflows.field.boardNone') },
        ...boards.filter((b) => !b.archived).map((b) => ({ value: b.id, label: b.name })),
      ];
      return <Select value={typeof value === 'string' ? value : 'auto'} onChange={onChange} options={options} aria-label={label} />;
    }
    case 'ImageField':
      return <ImageControl value={value} onChange={onChange} />;
    default:
      return null;
  }
}

function ImageControl({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const name = imageName(value);
  const image = useGallery((s) => (name ? s.images.find((i) => i.name === name) : undefined));
  const addImage = useGallery((s) => s.addImage);
  const onFiles = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    const dto = await backend.uploadImage(f, { boardId: null, category: 'user' });
    addImage(dto);
    onChange(dto.name);
  };
  return (
    <ImageDropZone onImages={(names) => onChange(names[0] ?? null)} onFiles={(files) => void onFiles(files)} label={t('workflows.field.dropImage')} className="wf-image">
      {image ? (
        <div className="wf-image__preview">
          <img src={image.thumbnailUrl} alt={image.name} draggable={false} />
          <span className="wf-image__size">
            {image.width}×{image.height}
          </span>
          <IconButton className="wf-image__clear" label={t('workflows.field.clearImage')} icon={<X size={12} />} size="xs" variant="solid" onClick={() => onChange(null)} />
        </div>
      ) : (
        <div className="wf-image__empty">{t('workflows.field.dropImageHint')}</div>
      )}
    </ImageDropZone>
  );
}
