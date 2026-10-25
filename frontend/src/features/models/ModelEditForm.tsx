// Edit mode for a model: name, description, base and type.
import { useState } from 'react';
import { backend, type BaseModel, type ModelConfig, type ModelType } from '@/backend';
import { t } from '@/i18n';
import { BASE_LABELS, useModels } from '@/state/models';
import { toast } from '@/state/toasts';
import { Button, Field, Select, TextInput, Textarea } from '@/ui';
import { BASE_MODELS, MODEL_TYPES, TYPE_KEYS } from './modelLabels';

export function ModelEditForm({ model, onDone }: { model: ModelConfig; onDone: () => void }) {
  const [name, setName] = useState(model.name);
  const [description, setDescription] = useState(model.description);
  const [base, setBase] = useState<BaseModel>(model.base);
  const [type, setType] = useState<ModelType>(model.type);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const updated = await backend.updateModel(model.key, { name: name.trim() || model.name, description, base, type });
      useModels.getState().upsertModel(updated);
      toast({ status: 'success', title: t('models.toast.updated'), description: updated.name });
      onDone();
    } catch (err) {
      toast({ status: 'error', title: t('models.toast.updateFailed'), description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mm-card mm-edit" data-testid="mm-edit-form">
      <h3 className="mm-subtitle">{t('models.edit.title')}</h3>
      <Field label={t('common.name')} orientation="vertical">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={t('common.description')} orientation="vertical">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </Field>
      <div className="mm-edit__row">
        <Field label={t('models.details.base')} orientation="vertical">
          <Select value={base} onChange={setBase} options={BASE_MODELS.map((b) => ({ value: b, label: BASE_LABELS[b] }))} aria-label={t('models.details.base')} />
        </Field>
        <Field label={t('models.details.type')} orientation="vertical">
          <Select value={type} onChange={setType} options={MODEL_TYPES.map((mt) => ({ value: mt, label: t(TYPE_KEYS[mt]) }))} aria-label={t('models.details.type')} />
        </Field>
      </div>
      <div className="mm-edit__actions">
        <Button variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button scheme="accent" isLoading={busy} onClick={() => void save()} data-testid="mm-edit-save">
          {t('common.save')}
        </Button>
      </div>
    </section>
  );
}
