// A reference image thumbnail; drop a gallery image on it, click to edit its settings.
import { ImageSquare, Warning } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useModels } from '@/state/models';
import { useParams, type RefImage } from '@/state/params';
import { cx, ImageDropZone, Popover, PopoverContent, PopoverTrigger, Tooltip } from '@/ui';
import { RefImageSettings } from './RefImageSettings';
import { imageFromNames, uploadFirst } from './useImageDrop';

export function RefImageCard({ refImage, index }: { refImage: RefImage; index: number }) {
  const update = useParams((s) => s.updateRefImage);
  const hasModel = useModels((s) => s.models.some((m) => m.key === refImage.modelKey));
  const warnings: string[] = [];
  if (!refImage.imageName) warnings.push(t('params.refImage.warnNoImage'));
  if (!hasModel) warnings.push(t('params.refImage.warnNoModel'));
  const setImage = (img: { name: string; url: string } | undefined) => {
    if (img) update(refImage.id, { imageName: img.name, imageUrl: img.url });
  };
  return (
    <ImageDropZone
      className="pp-ref"
      label={t('params.refImage.dropShort')}
      onImages={(names) => setImage(imageFromNames(names))}
      onFiles={(files) => void uploadFirst(files).then(setImage)}
    >
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cx('pp-ref__thumb', !refImage.isEnabled && 'is-disabled', warnings.length > 0 && 'has-warning')}
            aria-label={t('params.refImage.title', { index: index + 1 })}
            data-testid="ref-image"
          >
            {refImage.imageUrl ? <img src={refImage.imageUrl} alt="" draggable={false} /> : <ImageSquare size={22} />}
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="pp-refpop">
          <RefImageSettings refImage={refImage} index={index} onImage={setImage} />
        </PopoverContent>
      </Popover>
      {warnings.length > 0 && (
        <Tooltip content={warnings.join('\n')}>
          <span className="pp-ref__warn" role="img" aria-label={warnings.join(' ')}>
            <Warning size={11} weight="fill" />
          </span>
        </Tooltip>
      )}
    </ImageDropZone>
  );
}
