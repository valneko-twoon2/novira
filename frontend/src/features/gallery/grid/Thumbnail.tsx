// One gallery thumbnail: selection ring, hover actions (star, delete), size badge, drag source.
import { MusicNotes, Play, Star, Trash } from '@phosphor-icons/react';
import { memo, type MouseEvent } from 'react';
import { perf, type ImageDTO } from '@/backend';
import { t } from '@/i18n';
import { setDragImages } from '@/state/dnd';
import { useGallery } from '@/state/gallery';
import { showViewer } from '@/state/ui';
import { cx } from '@/ui';
import { setStarred } from '../actions';
import { useScrub } from './ScrubPreview';
import { requestDeleteImages } from '../deleteRequest';

/** The start-up measurement's last moment (backend/perf.ts). */
const firstLoaded = () => perf.mark('first-thumbnail');

interface Props {
  image: ImageDTO;
  size: number;
  selected: boolean;
  isCompare: boolean;
  alwaysShowSize: boolean;
  onClick: (name: string, e: MouseEvent) => void;
}

export const Thumbnail = memo(function Thumbnail({ image, size, selected, isCompare, alwaysShowSize, onClick }: Props) {
  const scrub = useScrub(image);
  const stop = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };
  return (
    <div
      className={cx('gthumb', selected && 'is-selected', isCompare && 'is-compare')}
      style={{ width: size, height: size }}
      data-image-name={image.name}
      data-testid="gallery-thumb"
      draggable
      {...scrub.handlers}
      onDragStart={(e) => {
        const sel = useGallery.getState().selection;
        setDragImages(e, sel.includes(image.name) ? sel : [image.name]);
      }}
      onClick={(e) => onClick(image.name, e)}
      onDoubleClick={() => {
        useGallery.getState().setSelection([image.name]);
        showViewer();
      }}
    >
      <img src={image.thumbnailUrl} alt="" loading="lazy" draggable={false} onLoad={firstLoaded} />
      {scrub.overlay}
      {image.mediaType === 'video' && <Play weight="fill" className="gthumb__play" aria-hidden />}
      {image.mediaType === 'audio' && <MusicNotes weight="fill" className="gthumb__play" aria-hidden />}
      {image.starred && <Star weight="fill" className="gthumb__starred" aria-hidden />}
      {isCompare && <span className="gthumb__compare">{t('gallery.compare.badge')}</span>}
      <span className={cx('gthumb__size', alwaysShowSize && 'is-always')}>
        {image.width}×{image.height}
      </span>
      <div className="gthumb__actions">
        <button
          type="button"
          className={cx('gthumb__btn', image.starred && 'is-on')}
          aria-label={image.starred ? t('gallery.menu.unstar') : t('gallery.menu.star')}
          title={image.starred ? t('gallery.menu.unstar') : t('gallery.menu.star')}
          onClick={(e) => {
            stop(e);
            void setStarred([image.name], !image.starred);
          }}
          onDoubleClick={stop}
        >
          <Star weight={image.starred ? 'fill' : 'bold'} />
        </button>
        <button
          type="button"
          className="gthumb__btn gthumb__btn--danger"
          aria-label={t('gallery.menu.delete')}
          title={t('gallery.menu.delete')}
          onClick={(e) => {
            stop(e);
            requestDeleteImages([image.name]);
          }}
          onDoubleClick={stop}
        >
          <Trash weight="bold" />
        </button>
      </div>
    </div>
  );
});
