// Inpaint mask settings: optional denoise limit and noise level, mask style and opacity.
import { t } from '@/i18n';
import { type InpaintEntity } from '@/state/canvas';
import { useCanvasStore } from '@/state/canvasStoreContext';
import { Field, SliderNumber, Switch } from '@/ui';
import { MaskStyleFields } from './MaskStyleFields';
import { OpacityField } from './OpacityField';

function OptionalSlider({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <Field label={label}>
      <div className="canvas-settings__optional">
        <Switch checked={value !== null} onChange={(on) => onChange(on ? 1 : null)} aria-label={label} />
        {value !== null && <SliderNumber value={value} onChange={onChange} min={0} max={1} step={0.01} precision={2} aria-label={label} />}
      </div>
    </Field>
  );
}

export function InpaintSettings({ entity }: { entity: InpaintEntity }) {
  const update = useCanvasStore((s) => s.updateEntity);
  const id = entity.id;
  return (
    <div className="canvas-settings">
      <OptionalSlider
        label={t('canvas.mask.denoiseLimit')}
        value={entity.denoiseLimit}
        onChange={(denoiseLimit) => update(id, { denoiseLimit }, { history: `dl:${id}` })}
      />
      <OptionalSlider
        label={t('canvas.mask.noiseLevel')}
        value={entity.noiseLevel}
        onChange={(noiseLevel) => update(id, { noiseLevel }, { history: `nl:${id}` })}
      />
      <MaskStyleFields entity={entity} />
      <OpacityField entity={entity} />
    </div>
  );
}
