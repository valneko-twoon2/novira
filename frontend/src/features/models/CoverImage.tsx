// Model cover: the model's picture; an icon for non-visual models and for a model without a picture.
import { Cube, Package, TextT } from '@phosphor-icons/react';
import { type ModelConfig, standInCover } from '@/backend';
import { cx } from '@/ui';
import { coverKind } from './modelCategories';

/** `index` picks one of the model's pictures (`coverImageUrls`); the cover, the first, is shown when it is out of range. */
export function CoverImage({ model, className, index = 0 }: { model: ModelConfig; className?: string; index?: number }) {
  const kind = coverKind(model.type);
  const Icon = model.type === 'vae' ? Cube : model.type === 'clip_embed' || model.type === 't5_encoder' ? TextT : Package;
  const src = model.coverImageUrls?.[index] ?? model.coverImageUrl ?? standInCover(model.key);
  return (
    <div className={cx('mm-cover', `mm-cover--${kind}`, className)} aria-hidden>
      {kind === 'icon' || !src ? <Icon size={28} weight="light" /> : <img className={cx('mm-cover__img', model.coverMature && 'is-mature')} src={src} alt="" loading="lazy" draggable={false} />}
    </div>
  );
}
