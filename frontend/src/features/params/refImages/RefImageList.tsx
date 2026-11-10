// Global reference images row shown under the prompts (Generate and Canvas tabs). Dropping a picture on the row (not on
// a card) adds it as a new reference image.
import { Plus } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { defaultRefModelKey } from '@/state/models';
import { useParams } from '@/state/params';
import { IconButton, ImageDropZone, Section } from '@/ui';
import { CharacterRow } from '../characters/CharacterRow';
import { RefImageCard } from './RefImageCard';
import { RefImagePackNeeds } from './RefImagePackNeeds';
import { imageFromNames, uploadFirst } from './useImageDrop';

export function RefImageList() {
  const refs = useParams((s) => s.refImages);
  const add = (img: { name: string; url: string } | undefined) => {
    if (img) addDefaultRefImage({ imageName: img.name, imageUrl: img.url });
  };
  return (
    <ImageDropZone
      className="pp-refs"
      label={t('params.refImage.dropNew')}
      onImages={(names) => add(imageFromNames(names))}
      onFiles={(files) => void uploadFirst(files).then(add)}
    >
      {/* A picture dropped on the folded section, or a character that brings pictures, opens it. */}
      <Section title={t('params.refImage.sectionLabel')} badges={refs.length ? [String(refs.length)] : undefined} openOn={refs.length}>
        <div className="pp-refs__body">
          <CharacterRow />
          {refs.map((r, i) => (
            <RefImageCard key={r.id} refImage={r} index={i} />
          ))}
          <IconButton
            className="pp-refs__add"
            variant="outline"
            label={t('params.refImage.add')}
            icon={<Plus />}
            data-testid="add-ref-image"
            onClick={() => addDefaultRefImage()}
          />
          <RefImagePackNeeds />
        </div>
      </Section>
    </ImageDropZone>
  );
}

/** Adds a reference image with the first IP-Adapter compatible with the main model. */
export function addDefaultRefImage(image?: { imageName: string; imageUrl: string }): string {
  const p = useParams.getState();
  return p.addRefImage({ modelKey: defaultRefModelKey(p.modelKey), ...image });
}
