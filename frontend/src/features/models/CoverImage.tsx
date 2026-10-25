// Model cover: the model's picture; an icon for non-visual models and for a model without a picture.
import { Cube, Package, TextT } from '@phosphor-icons/react';
import { type ModelConfig, standInCover } from '@/backend';
import { cx } from '@/ui';
import { coverKind } from './modelCategories';

export function CoverImage({ model, className }: { model: ModelConfig; className?: string }) {
  const kind = coverKind(model.type);
  const Icon = model.type === 'vae' ? Cube : model.type === 'clip_embed' || model.type === 't5_encoder' ? TextT : Package;
  const src = model.coverImageUrl ?? standInCover(model.key);
  return (
    <div className={cx('mm-cover', `mm-cover--${kind}`, className)} aria-hidden>
      {kind === 'icon' || !src ? <Icon size={28} weight="light" /> : <img className={cx('mm-cover__img', model.coverMature && 'is-mature')} src={src} alt="" loading="lazy" draggable={false} />}
    </div>
  );
}
