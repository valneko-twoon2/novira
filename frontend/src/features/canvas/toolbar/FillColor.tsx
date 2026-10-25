// Fill color swatch with a picker popover: color input, alpha, hex and preset swatches.
import { t } from '@/i18n';
import { useCanvasStore } from '@/state/canvasStoreContext';
import { Popover, PopoverContent, PopoverTrigger, SliderNumber, TextInput, Tooltip } from '@/ui';
import { rgbaCss } from '@/ui/canvasDraw/rgbaCss';
import { fromHex, PRESET_COLORS, toHex } from '../color';

export function FillColor() {
  const color = useCanvasStore((s) => s.fillColor);
  const setColor = useCanvasStore((s) => s.setFillColor);
  return (
    <Popover>
      <Tooltip content={t('canvas.toolbar.fillColor')}>
        <PopoverTrigger asChild>
          <button type="button" className="canvas-swatch canvas-swatch--trigger" aria-label={t('canvas.toolbar.fillColor')} data-testid="canvas-fill-color">
            <span className="canvas-swatch__color" style={{ background: rgbaCss(color) }} />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="canvas-color" align="start">
        <div className="canvas-color__row">
          <input
            type="color"
            className="canvas-color__input"
            value={toHex(color)}
            aria-label={t('canvas.toolbar.fillColor')}
            onChange={(e) => setColor(fromHex(e.target.value, color.a))}
          />
          <TextInput
            className="canvas-color__hex"
            defaultValue={toHex(color)}
            key={toHex(color)}
            aria-label={t('canvas.color.hex')}
            onBlur={(e) => /^#?[0-9a-f]{6}$/i.test(e.target.value) && setColor(fromHex(e.target.value, color.a))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              e.stopPropagation();
            }}
          />
        </div>
        <div className="canvas-color__alpha">
          <span>{t('canvas.color.alpha')}</span>
          <SliderNumber value={Math.round(color.a * 100)} onChange={(v) => setColor({ ...color, a: v / 100 })} min={0} max={100} aria-label={t('canvas.color.alpha')} />
        </div>
        <div className="canvas-color__presets">
          {PRESET_COLORS.map((c) => (
            <button
              key={toHex(c)}
              type="button"
              className="canvas-swatch"
              aria-label={toHex(c)}
              aria-pressed={toHex(c) === toHex(color)}
              onClick={() => setColor({ ...c, a: color.a })}
            >
              <span className="canvas-swatch__color" style={{ background: rgbaCss(c) }} />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
