// Drop zone for the image to upscale: thumbnail, size and a clear button.
import { ImageSquare, X } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useParams } from '@/state/params';
import { IconButton, ImageDropZone } from '@/ui';
import { imageFromNames, uploadFirst } from '../refImages/useImageDrop';

export function UpscaleInitialImage() {
  const image = useParams((s) => s.upscale.initialImage);
  const setUpscale = useParams((s) => s.setUpscale);
  const setImage = (img: typeof image | undefined) => {
    if (img) setUpscale({ initialImage: img });
  };
  return (
    <ImageDropZone
      className="pp-upimg"
      label={t('params.upscale.dropOverlay')}
      onImages={(names) => setImage(imageFromNames(names))}
      onFiles={(files) => void uploadFirst(files).then(setImage)}
    >
      {image ? (
        <div className="pp-upimg__filled" data-testid="upscale-initial-image">
          <img src={image.thumbnailUrl} alt="" draggable={false} />
          <span className="pp-upimg__size">
            {image.width}×{image.height}
          </span>
          <IconButton
            className="pp-upimg__clear"
            size="xs"
            variant="solid"
            label={t('params.upscale.clearImage')}
            icon={<X />}
            onClick={() => setUpscale({ initialImage: null })}
          />
        </div>
      ) : (
        <div className="pp-upimg__empty">
          <ImageSquare size={28} />
          <span>{t('params.upscale.dropHint')}</span>
        </div>
      )}
    </ImageDropZone>
  );
}
