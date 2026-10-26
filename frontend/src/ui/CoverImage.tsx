// Thumbnails: the model's picture, or the icon when it has none (the browser mock stands a picture in for it).
// CoverImage shows a model's; with `zoomable`, clicking opens an enlarged view.
import { CaretLeft, CaretRight, Cube } from '@phosphor-icons/react';
import { useState } from 'react';
import { type ModelConfig, standInCover } from '@/backend';
import { t } from '@/i18n';
import { Modal } from './overlays';

export function CoverImage({ model, className, zoomable }: { model: ModelConfig | undefined; className?: string; zoomable?: boolean }) {
  const [zoom, setZoom] = useState(false);
  const [index, setIndex] = useState(0);
  const src = model ? (model.coverImageUrl ?? standInCover(model.key)) : null;
  // The model's pictures (a model may have several); one without a list shows its cover alone.
  const urls = model?.coverImageUrls?.length ? model.coverImageUrls : src ? [src] : [];
  const shown = urls[index] ?? src;
  const step = (d: number) => setIndex((i) => (i + d + urls.length) % urls.length);
  return (
    <>
      <span
        className={className ?? 'pp-cover'}
        title={zoomable && src ? t('params.model.zoomHint') : undefined}
        role={zoomable && src ? 'button' : undefined}
        tabIndex={zoomable && src ? 0 : undefined}
        onClick={zoomable && src ? () => (setIndex(0), setZoom(true)) : undefined}
        onKeyDown={
          zoomable && src
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIndex(0);
                  setZoom(true);
                }
              }
            : undefined
        }
      >
        {src ? <img className={model?.coverMature ? 'is-mature' : undefined} src={src} alt="" draggable={false} /> : <Cube size={22} />}
      </span>
      {zoomable && model && (
        <Modal open={zoom} onOpenChange={setZoom} size="lg" closeLabel={t('common.close')} title={model.name}>
          <div
            className="pp-zoom"
            data-testid="cover-zoom"
            onKeyDown={(e) => {
              if (urls.length < 2) return;
              if (e.key === 'ArrowLeft') step(-1);
              if (e.key === 'ArrowRight') step(1);
            }}
          >
            {shown && <img className={model.coverMature ? 'is-mature' : undefined} src={shown} alt={model.name} draggable={false} />}
            {urls.length > 1 && (
              <>
                <button type="button" className="pp-zoom__arrow is-prev" aria-label={t('models.detail.prevImage')} data-testid="cover-zoom-prev" onClick={() => step(-1)}>
                  <CaretLeft size={16} weight="bold" />
                </button>
                <button type="button" className="pp-zoom__arrow is-next" aria-label={t('models.detail.nextImage')} data-testid="cover-zoom-next" onClick={() => step(1)}>
                  <CaretRight size={16} weight="bold" />
                </button>
                <span className="pp-zoom__count" data-testid="cover-zoom-count">
                  {t('models.detail.imageCount', { index: index + 1, count: urls.length })}
                </span>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
