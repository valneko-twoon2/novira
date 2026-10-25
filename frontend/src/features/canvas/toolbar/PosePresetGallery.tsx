// The body of the ready-made poses dialog: groups and categories in a rail, the cards of the chosen category beside it.
// The cards are drawn in the shape of the current generation box, so a composition shows where the people stand in it.
import { useMemo, useState } from 'react';
import { t } from '@/i18n';
import { useCanvasStore, useCanvasStoreApi } from '@/state/canvasStoreContext';
import { cx } from '@/ui';
import { applyPosePreset } from '../actions';
import { placePreset, POSE_CATEGORIES, POSE_GROUPS } from '@/state/pose/posePresets';
import { PosePreview } from './PosePreview';

/** The box shapes the cards draw: a very tall or wide box would make the cards huge or flat. */
const ASPECT = { min: 0.6, max: 1.8 };

export function PosePresetGallery({ onApplied }: { onApplied: () => void }) {
  const [categoryId, setCategoryId] = useState(POSE_CATEGORIES[0]!.id);
  const category = POSE_CATEGORIES.find((c) => c.id === categoryId) ?? POSE_CATEGORIES[0]!;
  const bbox = useCanvasStore((s) => s.bbox);
  const store = useCanvasStoreApi();
  const aspect = Math.min(ASPECT.max, Math.max(ASPECT.min, bbox.width / Math.max(bbox.height, 1)));
  const [width, height] = [Math.round(aspect * 1000), 1000];
  const cards = useMemo(
    () => category.presets.map((p) => ({ preset: p, poses: placePreset(p, { x: 0, y: 0, width, height }, 4, p.people.map((_, i) => `${p.id}-${i}`)) })),
    [category, width, height],
  );
  return (
    <div className="pose-gallery">
      <nav className="pose-gallery__rail" aria-label={t('canvas.pose.presets')}>
        {POSE_GROUPS.map((g) => (
          <div key={g.id} className="pose-gallery__group">
            <div className="pose-gallery__heading">{t(g.label)}</div>
            {POSE_CATEGORIES.filter((c) => c.group === g.id).map((c) => (
              <button key={c.id} type="button" aria-pressed={c.id === category.id} className={cx('pose-gallery__category', c.id === category.id && 'is-active')} onClick={() => setCategoryId(c.id)} data-testid={`canvas-pose-category-${c.id}`}>
                <span className="pose-gallery__label">{t(c.label)}</span>
                <span className="pose-gallery__count">{c.presets.length}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
      <section className="pose-gallery__main" aria-label={t(category.label)}>
        <p className="pose-gallery__note">{t('canvas.pose.presetsNote')}</p>
        <ul className="pose-gallery__grid">
          {cards.map(({ preset, poses }) => (
            <li key={preset.id}>
              <button
                type="button"
                className="pose-card"
                onClick={() => {
                  if (applyPosePreset(preset.id, store)) onApplied();
                }}
                data-testid={`canvas-pose-preset-${preset.id}`}
              >
                <PosePreview poses={poses} width={width} height={height} />
                <span className="pose-card__name">{t(preset.label)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
