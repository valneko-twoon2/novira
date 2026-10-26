// "Image to image" accordion of the Generate tab: a picture to draw over and how much of it is drawn again. Placing a
// picture sets the size to the trained size nearest its shape; the size can be changed by hand afterwards.
import { ImageSquare, X } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useParams } from '@/state/params';
import { Field, IconButton, ImageDropZone, Section, SliderNumber } from '@/ui';
import { optimalDimension } from '../labels';
import { useMainModel } from '../model/useMainModel';
import { imageFromNames, uploadFirst } from '../refImages/useImageDrop';

export function I2iSection() {
  const image = useParams((s) => s.initImage);
  const strength = useParams((s) => s.strength);
  const set = useParams((s) => s.set);
  const base = optimalDimension(useMainModel()?.base);
  const place = (img: typeof image | undefined) => {
    if (img) useParams.getState().setInitImage(img, base);
  };
  const badges = image ? [strength.toFixed(2)] : [];
  return (
    <Section title={t('params.i2i.title')} badges={badges} defaultOpen={!!image} openOn={image?.name}>
      <div className="pp-i2i" data-testid="i2i-section">
        <ImageDropZone className="pp-upimg" label={t('params.i2i.dropOverlay')} onImages={(names) => place(imageFromNames(names))} onFiles={(files) => void uploadFirst(files).then(place)}>
          {image ? (
            <div className="pp-upimg__filled" data-testid="i2i-image">
              <img src={image.thumbnailUrl} alt="" draggable={false} />
              <span className="pp-upimg__size">
                {image.width}×{image.height}
              </span>
              <IconButton className="pp-upimg__clear" size="xs" variant="solid" label={t('params.i2i.clear')} icon={<X />} onClick={() => useParams.getState().setInitImage(null, base)} data-testid="i2i-clear" />
            </div>
          ) : (
            <div className="pp-upimg__empty">
              <ImageSquare size={28} />
              <span>{t('params.i2i.dropHint')}</span>
            </div>
          )}
        </ImageDropZone>
        <Field label={t('params.image.strength')} info={t('params.image.strengthInfo')}>
          <SliderNumber value={strength} onChange={(v) => set({ strength: v })} min={0} max={1} step={0.01} precision={2} marks={[0, 0.5, 1]} disabled={!image} aria-label={t('params.image.strength')} />
        </Field>
      </div>
    </Section>
  );
}
