// A colour swatch that opens the system colour picker, with an optional opacity.
import { ColorInput, Slider } from '@/ui';
import { formatColor, parseColor } from './color';

export function ColorField({
  value,
  onChange,
  label,
  withOpacity = false,
}: {
  value: string;
  onChange: (css: string) => void;
  label: string;
  /** Adds an opacity slider (the value then becomes `rgba(...)` when translucent). */
  withOpacity?: boolean;
}) {
  const { hex, alpha } = parseColor(value);
  return (
    <div className="tx-color">
      <ColorInput className="tx-color__swatch" value={hex} aria-label={label} onChange={(next) => onChange(formatColor({ hex: next, alpha }))} />
      {withOpacity && (
        <Slider value={Math.round(alpha * 100)} min={0} max={100} onChange={(v) => onChange(formatColor({ hex, alpha: v / 100 }))} aria-label={label} />
      )}
    </div>
  );
}
