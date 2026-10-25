// The pictures of the selected model, one at a time with arrows between them; a model with one picture shows just that.
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useState } from 'react';
import type { ModelConfig } from '@/backend';
import { t } from '@/i18n';
import { CoverImage } from './CoverImage';

export function ModelGallery({ model }: { model: ModelConfig }) {
  const [index, setIndex] = useState(0);
  const count = model.coverImageUrls?.length ?? 1;
  const step = (d: number) => setIndex((i) => (i + d + count) % count);
  return (
    <div className="mm-gallery" data-testid="mm-gallery">
      <CoverImage model={model} index={index} className="mm-detail__cover" />
      {count > 1 && (
        <>
          <button type="button" className="mm-gallery__arrow is-prev" aria-label={t('models.detail.prevImage')} data-testid="mm-gallery-prev" onClick={() => step(-1)}>
            <CaretLeft size={14} weight="bold" />
          </button>
          <button type="button" className="mm-gallery__arrow is-next" aria-label={t('models.detail.nextImage')} data-testid="mm-gallery-next" onClick={() => step(1)}>
            <CaretRight size={14} weight="bold" />
          </button>
          <span className="mm-gallery__count" data-testid="mm-gallery-count">
            {t('models.detail.imageCount', { index: index + 1, count })}
          </span>
        </>
      )}
    </div>
  );
}
