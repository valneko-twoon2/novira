// Thumbnails: the model's picture, or the icon when it has none (the browser mock stands a picture in for it).
// CoverImage shows a model's; with `zoomable`, clicking opens an enlarged view.
import { Cube } from '@phosphor-icons/react';
import { useState } from 'react';
import { type ModelConfig, standInCover } from '@/backend';
import { t } from '@/i18n';
import { Modal } from './overlays';

export function CoverImage({ model, className, zoomable }: { model: ModelConfig | undefined; className?: string; zoomable?: boolean }) {
  const [zoom, setZoom] = useState(false);
  const src = model ? (model.coverImageUrl ?? standInCover(model.key)) : null;
  return (
    <>
      <span
        className={className ?? 'pp-cover'}
        title={zoomable && src ? t('params.model.zoomHint') : undefined}
        role={zoomable && src ? 'button' : undefined}
        tabIndex={zoomable && src ? 0 : undefined}
        onClick={zoomable && src ? () => setZoom(true) : undefined}
        onKeyDown={
          zoomable && src
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
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
          <div className="pp-zoom">{src && <img className={model.coverMature ? 'is-mature' : undefined} src={src} alt={model.name} draggable={false} />}</div>
        </Modal>
      )}
    </>
  );
}
