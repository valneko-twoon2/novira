// A launchpad card: icon, title, optional description. Optionally a drop target for gallery images.
import type { ReactNode } from 'react';
import type { ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { cx, ImageDropZone } from '@/ui';
import { imageFromNames, uploadFirst } from '@/features/params/refImages/useImageDrop';

interface CardProps {
  icon: ReactNode;
  title: string;
  description?: string;
  onClick?: () => void;
  /** Accepts gallery images / files dropped on the card. */
  onImage?: (image: ImageDTO) => void;
  testId?: string;
}

export function LaunchpadCard({ icon, title, description, onClick, onImage, testId }: CardProps) {
  const body = (
    <button type="button" className={cx('lp-card', onImage && 'lp-card--drop')} onClick={onClick} data-testid={testId}>
      <span className="lp-card__icon">{icon}</span>
      <span className="lp-card__text">
        <span className="lp-card__title">{title}</span>
        {description && <span className="lp-card__desc">{description}</span>}
        {onImage && <span className="lp-card__drop">{t('params.launchpad.dropHere')}</span>}
      </span>
    </button>
  );
  if (!onImage) return body;
  const accept = (img: ImageDTO | undefined) => {
    if (img) onImage(img);
  };
  return (
    <ImageDropZone
      className="lp-dropwrap"
      label={t('params.launchpad.dropOverlay')}
      onImages={(names) => accept(imageFromNames(names))}
      onFiles={(files) => void uploadFirst(files).then(accept)}
    >
      {body}
    </ImageDropZone>
  );
}

export function LaunchpadPage({ title, children, tips }: { title: string; children: ReactNode; tips?: ReactNode }) {
  return (
    <div className="lp" data-testid="launchpad">
      <div className="lp__inner">
        <header className="lp__header">
          <h1 className="lp__title">{title}</h1>
        </header>
        <div className="lp__cards">{children}</div>
        {tips && <div className="lp__tips">{tips}</div>}
      </div>
    </div>
  );
}

export function Tip({ children }: { children: ReactNode }) {
  return <div className="lp-tip">{children}</div>;
}
