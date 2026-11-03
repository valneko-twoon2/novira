// Inpaint mask settings: redraw, erase or cut out the painted part, optional denoise limit and noise level, mask style and opacity.
import { Eraser, PaintBrush, Scissors } from '@phosphor-icons/react';
import { useState } from 'react';
import { t } from '@/i18n';
import { useCanvas, type InpaintEntity } from '@/state/canvas';
import { useCanvasStore, useCanvasStoreApi } from '@/state/canvasStoreContext';
import { Button, Field, SliderNumber, Switch, Textarea } from '@/ui';
import { cutOutMaskedPart, eraseMaskedPart, redrawMaskedPart } from '../../partFix';
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
  const store = useCanvasStoreApi();
  const [busy, setBusy] = useState<'redraw' | 'erase' | 'cut' | null>(null);
  const [instruction, setInstruction] = useState('');
  const id = entity.id;
  // A redraw is a canvas generation, whose result reaches only the Image tab's canvas.
  const canRedraw = store === useCanvas;
  const run = (what: 'redraw' | 'erase' | 'cut') => {
    setBusy(what);
    const job = what === 'redraw' ? redrawMaskedPart(id, instruction) : what === 'erase' ? eraseMaskedPart(id, store) : cutOutMaskedPart(id, store);
    void job.finally(() => setBusy(null));
  };
  return (
    <div className="canvas-settings">
      {canRedraw && (
        <Textarea
          value={instruction}
          placeholder={t('canvas.partFix.instructionPlaceholder')}
          aria-label={t('canvas.partFix.instruction')}
          rows={2}
          onChange={(e) => setInstruction(e.target.value)}
          data-testid="canvas-mask-instruction"
        />
      )}
      <div className="canvas-settings__actions">
        {canRedraw && (
          <Button size="sm" leftIcon={<PaintBrush size={14} />} isLoading={busy === 'redraw'} disabled={busy !== null} onClick={() => run('redraw')} data-testid="canvas-mask-redraw">
            {t('canvas.partFix.redraw')}
          </Button>
        )}
        <Button size="sm" leftIcon={<Eraser size={14} />} isLoading={busy === 'erase'} disabled={busy !== null} onClick={() => run('erase')} data-testid="canvas-mask-erase">
          {t('canvas.partFix.erase')}
        </Button>
        <Button size="sm" leftIcon={<Scissors size={14} />} isLoading={busy === 'cut'} disabled={busy !== null} onClick={() => run('cut')} data-testid="canvas-mask-cutout">
          {t('canvas.partFix.cutOutAction')}
        </Button>
      </div>
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
