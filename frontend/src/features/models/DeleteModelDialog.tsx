// Confirmation before deleting a model from disk.
import { useState } from 'react';
import { backend, type ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { toast } from '@/state/toasts';
import { Button, Modal } from '@/ui';

export function DeleteModelDialog({ model, onClose }: { model: ModelConfig | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (!model) return;
    setBusy(true);
    try {
      await backend.deleteModel(model.key);
      useModels.getState().removeModel(model.key);
      toast({ status: 'success', title: t('models.toast.deleted'), description: model.name });
      onClose();
    } catch (err) {
      toast({ status: 'error', title: t('models.toast.deleteFailed'), description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={model !== null}
      onOpenChange={(open) => !open && onClose()}
      title={t('models.deleteTitle')}
      size="sm"
      closeLabel={t('common.close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button scheme="danger" onClick={() => void confirm()} isLoading={busy} data-testid="mm-delete-confirm">
            {t('common.delete')}
          </Button>
        </>
      }
    >
      <p className="mm-dialog__text">{t('models.deleteConfirm', { name: model?.name ?? '' })}</p>
      <p className="mm-dialog__warn">{t('models.deleteWarning')}</p>
    </Modal>
  );
}
