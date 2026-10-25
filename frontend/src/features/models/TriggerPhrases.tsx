// Trigger phrases as removable chips; every change is saved right away (as in InvokeAI).
import { X } from '@phosphor-icons/react';
import { useState } from 'react';
import { backend, type ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { toast } from '@/state/toasts';
import { Button, TextInput } from '@/ui';

export function TriggerPhrases({ model }: { model: ModelConfig }) {
  const phrases = model.triggerPhrases ?? [];
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const duplicate = phrases.includes(draft.trim());

  const save = async (next: string[]) => {
    setBusy(true);
    try {
      const updated = await backend.updateModel(model.key, { triggerPhrases: next });
      useModels.getState().upsertModel(updated);
    } catch (err) {
      toast({ status: 'error', title: t('models.toast.updateFailed'), description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const p = draft.trim();
    if (!p || duplicate) return;
    await save([...phrases, p]);
    setDraft('');
  };

  return (
    <section className="mm-card" data-testid="mm-trigger-phrases">
      <h3 className="mm-subtitle">{t('models.triggers.title')}</h3>
      <form
        className="mm-form__row"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <TextInput value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('models.triggers.placeholder')} aria-label={t('models.triggers.placeholder')} />
        <Button type="submit" size="sm" disabled={!draft.trim() || duplicate} isLoading={busy}>
          {t('common.add')}
        </Button>
      </form>
      {duplicate && <div className="mm-error">{t('models.triggers.duplicate')}</div>}
      <div className="mm-chips">
        {phrases.length === 0 && <span className="mm-faint">{t('models.triggers.empty')}</span>}
        {phrases.map((p) => (
          <span key={p} className="mm-chip">
            {p}
            <button type="button" className="mm-chip__remove" aria-label={t('common.remove')} onClick={() => void save(phrases.filter((x) => x !== p))}>
              <X size={10} weight="bold" />
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}
