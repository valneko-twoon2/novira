// "Redo with a chosen strength": the picture is drawn again from itself (image-to-image), and a slider says how far the
// result may move away from it. Low keeps the picture almost as it is, high redraws it freely.
import { useState } from 'react';
import { t } from '@/i18n';
import { SUBTLE_STRENGTH, STRENGTH_RANGE, deriveFrom } from '@/state/derive';
import { useDeriveDialog } from '@/state/dialogs/derive';
import { useGallery } from '@/state/gallery';
import { Button, Modal, Select, SliderNumber } from '@/ui';

const COUNTS = [1, 2, 4, 8];

export function DeriveDialog() {
  const imageName = useDeriveDialog((s) => s.imageName);
  const close = useDeriveDialog((s) => s.close);
  const image = useGallery((s) => (imageName ? s.images.find((i) => i.name === imageName) : undefined));
  // The choice is kept while the dialog is closed, so the next picture starts from the same strength.
  const [strength, setStrength] = useState(SUBTLE_STRENGTH);
  const [count, setCount] = useState(1);

  const create = () => {
    if (!image) return;
    void deriveFrom(image, 'subtle', count, strength);
    close();
  };

  return (
    <Modal open={!!imageName} onOpenChange={(o) => !o && close()} size="md" closeLabel={t('common.close')} title={t('gallery.derive.dialog.title')}>
      {!image ? null : (
        <div className="dvdlg" data-testid="derive-dialog">
          <img className="dvdlg__image" src={image.url} alt="" draggable={false} />
          <div className="dvdlg__field">
            <span>{t('gallery.derive.dialog.strength')}</span>
            <SliderNumber value={strength} onChange={setStrength} min={STRENGTH_RANGE.min} max={STRENGTH_RANGE.max} step={STRENGTH_RANGE.step} precision={2} aria-label={t('gallery.derive.dialog.strength')} />
            <div className="dvdlg__scale" aria-hidden>
              <span>{t('gallery.derive.dialog.close')}</span>
              <span>{t('gallery.derive.dialog.free')}</span>
            </div>
          </div>
          <label className="dvdlg__field">
            <span>{t('gallery.derive.dialog.count')}</span>
            <Select value={String(count)} onChange={(v) => setCount(Number(v))} options={COUNTS.map((n) => ({ value: String(n), label: String(n) }))} aria-label={t('gallery.derive.dialog.count')} />
          </label>
          <div className="dvdlg__actions">
            <Button variant="solid" scheme="invoke" onClick={create} data-testid="derive-create">
              {t('gallery.derive.dialog.create')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
