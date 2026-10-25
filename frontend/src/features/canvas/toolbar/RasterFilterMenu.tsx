// The filter button of the toolbars: a popover that applies blur, grayscale or invert to the selected raster layer of the
// surrounding canvas store, as one undoable change of the layer's pixels.
import { SlidersHorizontal } from '@phosphor-icons/react';
import { useState } from 'react';
import { t } from '@/i18n';
import { isSlot } from '@/state/canvas';
import { useCanvasStore, useCanvasStoreApi } from '@/state/canvasStoreContext';
import { Button, IconButton, NumberInput, Popover, PopoverContent, PopoverTrigger, TOOLBAR_BUTTON_SIZE } from '@/ui';
import { applyRasterFilter } from '../actions';
import { clampBlurRadius, MAX_BLUR_RADIUS, MIN_BLUR_RADIUS, RASTER_FILTER_KINDS, type RasterFilter, type RasterFilterKind } from '../render/rasterFilter';
import '../canvas.css';

const LABEL = {
  blur: 'canvas.rasterFilter.blur',
  grayscale: 'canvas.rasterFilter.grayscale',
  invert: 'canvas.rasterFilter.invert',
} as const;

export function RasterFilterMenu() {
  const [kind, setKind] = useState<RasterFilterKind>('blur');
  const [radius, setRadius] = useState(4);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const store = useCanvasStoreApi();
  // A raster layer of the user that is not locked is chosen: the filter has something to act on.
  const usable = useCanvasStore((s) => {
    const e = s.entities.find((x) => x.id === s.selectedEntityId);
    return !!e && e.type === 'raster' && !isSlot(e) && !e.isLocked;
  });
  const apply = async () => {
    const filter: RasterFilter = kind === 'blur' ? { kind, radius: clampBlurRadius(radius) } : { kind };
    setBusy(true);
    try {
      if (await applyRasterFilter(store.getState().selectedEntityId, filter, store)) setOpen(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('canvas.toolbar.filter')} icon={<SlidersHorizontal />} disabled={!usable} data-testid="canvas-filter" />
      </PopoverTrigger>
      <PopoverContent className="canvas-width__pop" align="start">
        <span className="canvas-width__label">{t('canvas.rasterFilter.hint')}</span>
        <div className="canvas-width__presets" role="group" aria-label={t('canvas.toolbar.filter')}>
          {RASTER_FILTER_KINDS.map((k) => (
            <button key={k} type="button" className="canvas-chip" aria-pressed={k === kind} onClick={() => setKind(k)} data-testid={`canvas-filter-kind-${k}`}>
              {t(LABEL[k])}
            </button>
          ))}
        </div>
        {kind === 'blur' && (
          <div className="canvas-width">
            <span className="canvas-width__label">{t('canvas.rasterFilter.radius')}</span>
            <NumberInput value={radius} onChange={(v) => setRadius(clampBlurRadius(v))} min={MIN_BLUR_RADIUS} max={MAX_BLUR_RADIUS} className="canvas-width__input" aria-label={t('canvas.rasterFilter.radius')} />
          </div>
        )}
        <Button size="sm" scheme="accent" disabled={!usable || busy} onClick={() => void apply()} data-testid="canvas-filter-apply">
          {t('canvas.rasterFilter.apply')}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
