import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useState, type MouseEvent } from 'react';
import type { CivitaiModel } from '@/backend';
import { t } from '@/i18n';
import { Cover } from './Cover';

export function CoverCarousel({ model }: { model: CivitaiModel }) {
  const [index, setIndex] = useState(0);
  const count = model.imageCount;
  const step = (d: number) => (e: MouseEvent) => {
    e.stopPropagation();
    setIndex((i) => (i + d + count) % count);
  };
  return (
    <div className="browse-carousel">
      <Cover model={model} index={index} play="hover" />
      {count > 1 && (
        <>
          <button type="button" className="browse-carousel__arrow is-prev" aria-label={t('browse.card.prevImage')} onClick={step(-1)}>
            <CaretLeft size={14} weight="bold" />
          </button>
          <button type="button" className="browse-carousel__arrow is-next" aria-label={t('browse.card.nextImage')} onClick={step(1)}>
            <CaretRight size={14} weight="bold" />
          </button>
          <div className="browse-carousel__dots" aria-hidden="true">
            {Array.from({ length: count }, (_, i) => (
              <span key={i} className={i === index ? 'is-on' : ''} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
