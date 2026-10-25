// Brush / eraser / mosaic width: number box with a slider popover (shown for those tools); the mosaic also has its block size.
import { CaretDown } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { useCanvasStore } from '@/state/canvasStoreContext';
import { IconButton, NumberInput, Popover, PopoverContent, PopoverTrigger, Slider, TOOLBAR_BUTTON_SIZE } from '@/ui';

const PRESETS = [5, 10, 25, 50, 100, 200, 400];

export function BrushWidth() {
  const tool = useCanvasStore((s) => s.tool);
  const brush = useCanvasStore((s) => s.brushWidth);
  const eraser = useCanvasStore((s) => s.eraserWidth);
  const setBrush = useCanvasStore((s) => s.setBrushWidth);
  const setEraser = useCanvasStore((s) => s.setEraserWidth);
  const mosaic = useCanvasStore((s) => s.mosaicWidth);
  const setMosaic = useCanvasStore((s) => s.setMosaicWidth);
  const block = useCanvasStore((s) => s.mosaicBlock);
  const setBlock = useCanvasStore((s) => s.setMosaicBlock);
  if (tool !== 'brush' && tool !== 'eraser' && tool !== 'mosaic') return null;
  const value = tool === 'brush' ? brush : tool === 'mosaic' ? mosaic : eraser;
  const set = tool === 'brush' ? setBrush : tool === 'mosaic' ? setMosaic : setEraser;
  const label = tool === 'brush' ? t('canvas.toolbar.brushWidth') : tool === 'mosaic' ? t('canvas.toolbar.mosaicWidth') : t('canvas.toolbar.eraserWidth');
  return (
    <div className="canvas-width">
      <span className="canvas-width__label">{label}</span>
      <NumberInput value={value} onChange={set} min={1} max={600} className="canvas-width__input" aria-label={label} />
      <Popover>
        <PopoverTrigger asChild>
          <IconButton size={TOOLBAR_BUTTON_SIZE} label={t('canvas.toolbar.widthPresets')} icon={<CaretDown />} />
        </PopoverTrigger>
        <PopoverContent className="canvas-width__pop" align="start">
          <Slider value={value} onChange={set} min={1} max={600} aria-label={label} />
          <div className="canvas-width__presets">
            {PRESETS.map((p) => (
              <button key={p} type="button" className="canvas-chip" aria-pressed={p === value} onClick={() => set(p)}>
                {p}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {tool === 'mosaic' && (
        <>
          <span className="canvas-width__label">{t('canvas.toolbar.mosaicBlock')}</span>
          <NumberInput value={block} onChange={setBlock} min={2} max={128} className="canvas-width__input" aria-label={t('canvas.toolbar.mosaicBlock')} data-testid="canvas-mosaic-block" />
        </>
      )}
    </div>
  );
}
