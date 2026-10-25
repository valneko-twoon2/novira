// Previous / next arrows over the viewer, stepping through the current board's images.
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useBoardImages } from '@/features/gallery/useBoardImages';
import { t } from '@/i18n';
import { useGallery } from '@/state/gallery';

export function ViewerNav({ imageName }: { imageName: string | null }) {
  const list = useBoardImages();
  const idx = imageName ? list.findIndex((i) => i.name === imageName) : -1;
  if (idx < 0) return null;
  const go = (d: number) => {
    const next = list[idx + d];
    if (next) useGallery.getState().setSelection([next.name]);
  };
  return (
    <>
      {idx > 0 && (
        <button type="button" className="vnav vnav--prev" aria-label={t('gallery.viewer.prev')} title={t('gallery.viewer.prev')} onClick={() => go(-1)}>
          <CaretLeft weight="bold" />
        </button>
      )}
      {idx < list.length - 1 && (
        <button type="button" className="vnav vnav--next" aria-label={t('gallery.viewer.next')} title={t('gallery.viewer.next')} onClick={() => go(1)}>
          <CaretRight weight="bold" />
        </button>
      )}
    </>
  );
}
