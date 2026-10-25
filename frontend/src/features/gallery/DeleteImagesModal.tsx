// Confirmation dialog for deleting images, with a "don't ask again" option.
import { useState } from 'react';
import { t, tCount } from '@/i18n';
import { useSettings } from '@/state/settings';
import { Button, Checkbox, Modal } from '@/ui';
import { deleteImagesNow } from './actions';
import { useDeleteRequest } from './deleteRequest';

export function DeleteImagesModal() {
  const pending = useDeleteRequest((s) => s.pending);
  const close = useDeleteRequest((s) => s.close);
  const [dontAsk, setDontAsk] = useState(false);
  const confirm = () => {
    if (!pending) return;
    if (dontAsk) useSettings.getState().set({ confirmOnDelete: false });
    void deleteImagesNow(pending);
    close();
  };
  return (
    <Modal
      open={pending !== null}
      onOpenChange={(o) => !o && close()}
      title={t('gallery.delete.title')}
      size="sm"
      closeLabel={t('common.close')}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button scheme="danger" onClick={confirm} autoFocus data-testid="confirm-delete-images">
            {t('common.delete')}
          </Button>
        </>
      }
    >
      <div className="gal-confirm">
        <p>{tCount('gallery.delete.message', pending?.length ?? 0)}</p>
        <p className="gal-confirm__hint">{t('gallery.delete.hint')}</p>
        <Checkbox checked={dontAsk} onChange={setDontAsk} label={t('common.dontAskAgain')} />
      </div>
    </Modal>
  );
}
