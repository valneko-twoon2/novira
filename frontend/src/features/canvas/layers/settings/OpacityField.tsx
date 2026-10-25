// Opacity slider shared by every entity type.
import { t } from '@/i18n';
import { type CanvasEntity } from '@/state/canvas';
import { useCanvasStore } from '@/state/canvasStoreContext';
import { Field, SliderNumber } from '@/ui';

export function OpacityField({ entity }: { entity: CanvasEntity }) {
  const update = useCanvasStore((s) => s.updateEntity);
  return (
    <Field label={t('canvas.entity.opacity')}>
      <SliderNumber
        value={Math.round(entity.opacity * 100)}
        onChange={(v) => update(entity.id, { opacity: v / 100 }, { history: `opacity:${entity.id}` })}
        min={0}
        max={100}
        aria-label={t('canvas.entity.opacity')}
      />
    </Field>
  );
}
