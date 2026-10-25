// Mask color and fill pattern, shared by inpaint masks and regional guidance.
import { t } from '@/i18n';
import { MASK_FILLS, type MaskEntity, type MaskFill } from '@/state/canvas';
import { useCanvasStore } from '@/state/canvasStoreContext';
import { Field, Select } from '@/ui';
import { fromHex, toHex } from '../../color';
import { FILL_LABEL } from '../../names';

export function MaskStyleFields({ entity }: { entity: MaskEntity }) {
  const update = useCanvasStore((s) => s.updateEntity);
  return (
    <>
      <Field label={t('canvas.mask.color')}>
        <input
          type="color"
          className="canvas-color__input canvas-color__input--sm"
          value={toHex(entity.color)}
          aria-label={t('canvas.mask.color')}
          onChange={(e) => update(entity.id, { color: fromHex(e.target.value) }, { history: `color:${entity.id}` })}
        />
      </Field>
      <Field label={t('canvas.mask.fillStyle')}>
        <Select<MaskFill>
          value={entity.fill}
          options={MASK_FILLS.map((f) => ({ value: f, label: t(FILL_LABEL[f]) }))}
          onChange={(fill) => update(entity.id, { fill })}
          aria-label={t('canvas.mask.fillStyle')}
        />
      </Field>
    </>
  );
}
