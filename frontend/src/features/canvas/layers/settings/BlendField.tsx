// How a raster layer's colours meet the layers under it (normal, multiply, screen), shown next to its opacity.
import { t } from '@/i18n';
import { RASTER_BLENDS, type RasterBlend, type RasterEntity } from '@/state/canvas';
import { useCanvasStore } from '@/state/canvasStoreContext';
import { Field, Select } from '@/ui';
import { BLEND_LABEL } from '../../names';

export function BlendField({ entity }: { entity: RasterEntity }) {
  const update = useCanvasStore((s) => s.updateEntity);
  return (
    <Field label={t('canvas.entity.blend')}>
      <Select<RasterBlend>
        value={entity.blend ?? 'normal'}
        options={RASTER_BLENDS.map((b) => ({ value: b, label: t(BLEND_LABEL[b]) }))}
        onChange={(blend) => update(entity.id, { blend })}
        aria-label={t('canvas.entity.blend')}
      />
    </Field>
  );
}
