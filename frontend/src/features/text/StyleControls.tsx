// Controls for the text style shared by text layers and bubbles: font, fill, outlines, shadow, spacing, writing direction.
import { t } from '@/i18n';
import { useTextEditor } from '@/state/text/textEditor';
import type { Outline, Shadow, TextStyle } from '@/state/text/textModel';
import { Checkbox, Field, FontPicker, NumberInput, Select, SliderNumber } from '@/ui';
import { ColorField } from './ColorField';
import { fontOf, snapWeight } from '@/state/fonts';

const WEIGHT_LABEL: Record<number, string> = { 100: '100', 200: '200', 300: '300', 400: '400', 500: '500', 600: '600', 700: '700', 800: '800', 900: '900' };

function Seg<V extends string>({ value, onChange, options, label }: { value: V; onChange: (v: V) => void; options: { value: V; label: string }[]; label: string }) {
  return (
    <div className="tx-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} className={value === o.value ? 'is-on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StyleControls({ layerId, style, bend }: { layerId: string; style: TextStyle; /** Present only for text layers. */ bend?: number }) {
  const { updateStyle, update } = useTextEditor.getState();
  const set = (patch: Partial<TextStyle>, key: string) => updateStyle(layerId, patch, { key: `${layerId}:${key}` });
  const defaultOutline = (color: string, k: number): Outline => ({ color, width: Math.max(1, Math.round(style.fontSize * k)) });
  const defaultShadow: Shadow = { color: 'rgba(0, 0, 0, 0.45)', blur: Math.round(style.fontSize / 16), offsetX: Math.round(style.fontSize / 16), offsetY: Math.round(style.fontSize / 12) };
  const font = fontOf(style.fontFamily);

  return (
    <div className="tx-controls">
      <Field label={t('text.font')}>
        <FontPicker
          value={style.fontFamily}
          onChange={(family) => family && set({ fontFamily: family, fontWeight: snapWeight(family, style.fontWeight) }, 'font')}
          label={t('text.font')}
          testId="text-font"
        />
      </Field>
      <Field label={t('text.weight')}>
        <Select
          value={String(snapWeight(style.fontFamily, style.fontWeight))}
          onChange={(w) => set({ fontWeight: Number(w) }, 'weight')}
          options={font.weights.map((w) => ({ value: String(w), label: WEIGHT_LABEL[w] ?? String(w) }))}
          disabled={font.weights.length < 2}
          aria-label={t('text.weight')}
        />
      </Field>
      <Field label={t('text.size')}>
        <SliderNumber value={style.fontSize} min={8} max={600} onChange={(v) => set({ fontSize: v }, 'size')} numberMax={2000} aria-label={t('text.size')} />
      </Field>
      <Field label={t('text.fill')}>
        <div className="tx-inline">
          <Seg
            value={style.fill.kind}
            label={t('text.fill')}
            options={[
              { value: 'solid', label: t('text.fill.solid') },
              { value: 'gradient', label: t('text.fill.gradient') },
            ]}
            onChange={(kind) => {
              const color = style.fill.kind === 'solid' ? style.fill.color : style.fill.top;
              set({ fill: kind === 'solid' ? { kind: 'solid', color } : { kind: 'gradient', top: color, bottom: '#c88a14' } }, 'fillkind');
            }}
          />
          {style.fill.kind === 'solid' ? (
            <ColorField value={style.fill.color} label={t('text.color')} onChange={(color) => set({ fill: { kind: 'solid', color } }, 'fill')} />
          ) : (
            <>
              <ColorField value={style.fill.top} label={t('text.fill.top')} onChange={(top) => set({ fill: { kind: 'gradient', top, bottom: style.fill.kind === 'gradient' ? style.fill.bottom : top } }, 'fill')} />
              <ColorField value={style.fill.bottom} label={t('text.fill.bottom')} onChange={(bottom) => set({ fill: { kind: 'gradient', top: style.fill.kind === 'gradient' ? style.fill.top : bottom, bottom } }, 'fill')} />
            </>
          )}
        </div>
      </Field>
      <OutlineRow
        label={t('text.stroke')}
        value={style.stroke}
        onChange={(stroke) => set({ stroke }, 'stroke')}
        create={() => defaultOutline('#111111', 0.07)}
      />
      <OutlineRow
        label={t('text.outline')}
        value={style.outline}
        onChange={(outline) => set({ outline }, 'outline')}
        create={() => defaultOutline('#ffffff', 0.06)}
      />
      <div className="tx-group">
        <Checkbox checked={style.shadow !== null} label={t('text.shadow')} onChange={(on) => set({ shadow: on ? defaultShadow : null }, 'shadow')} />
        {style.shadow && (
          <div className="tx-sub">
            <Field label={t('text.color')}>
              <ColorField value={style.shadow.color} withOpacity label={t('text.shadow.color')} onChange={(color) => set({ shadow: { ...style.shadow!, color } }, 'shadow-color')} />
            </Field>
            <Field label={t('text.shadow.blur')}>
              <SliderNumber value={style.shadow.blur} min={0} max={80} onChange={(blur) => set({ shadow: { ...style.shadow!, blur } }, 'shadow-blur')} numberMax={400} aria-label={t('text.shadow.blur')} />
            </Field>
            <Field label={t('text.shadow.offset')}>
              <div className="tx-inline">
                <NumberInput value={style.shadow.offsetX} min={-400} max={400} onChange={(offsetX) => set({ shadow: { ...style.shadow!, offsetX } }, 'shadow-x')} aria-label={t('text.shadow.offsetX')} />
                <NumberInput value={style.shadow.offsetY} min={-400} max={400} onChange={(offsetY) => set({ shadow: { ...style.shadow!, offsetY } }, 'shadow-y')} aria-label={t('text.shadow.offsetY')} />
              </div>
            </Field>
          </div>
        )}
      </div>
      <Field label={t('text.letterSpacing')}>
        <SliderNumber value={style.letterSpacing} min={-20} max={80} onChange={(v) => set({ letterSpacing: v }, 'spacing')} numberMin={-200} numberMax={400} aria-label={t('text.letterSpacing')} />
      </Field>
      <Field label={t('text.lineHeight')}>
        <SliderNumber value={style.lineHeight} min={0.8} max={2.4} step={0.05} precision={2} onChange={(v) => set({ lineHeight: v }, 'line')} aria-label={t('text.lineHeight')} />
      </Field>
      <Field label={t('text.align')}>
        <Seg
          value={style.align}
          label={t('text.align')}
          options={[
            { value: 'left', label: t(style.vertical ? 'text.align.top' : 'text.align.left') },
            { value: 'center', label: t('text.align.center') },
            { value: 'right', label: t(style.vertical ? 'text.align.bottom' : 'text.align.right') },
          ]}
          onChange={(align) => set({ align }, 'align')}
        />
      </Field>
      <Checkbox checked={style.vertical} label={t('text.vertical')} onChange={(vertical) => set({ vertical }, 'vertical')} />
      {bend !== undefined && (
        <Field label={t('text.bend')}>
          <SliderNumber
            value={bend}
            min={-100}
            max={100}
            disabled={style.vertical}
            onChange={(v) => update(layerId, { bend: v }, { key: `${layerId}:bend` })}
            aria-label={t('text.bend')}
          />
        </Field>
      )}
    </div>
  );
}

function OutlineRow({ label, value, onChange, create }: { label: string; value: Outline | null; onChange: (v: Outline | null) => void; create: () => Outline }) {
  return (
    <div className="tx-group">
      <Checkbox checked={value !== null} label={label} onChange={(on) => onChange(on ? create() : null)} />
      {value && (
        <div className="tx-sub">
          <Field label={t('text.color')}>
            <ColorField value={value.color} label={label} onChange={(color) => onChange({ ...value, color })} />
          </Field>
          <Field label={t('text.thickness')}>
            <SliderNumber value={value.width} min={1} max={60} onChange={(width) => onChange({ ...value, width })} numberMax={400} aria-label={label} />
          </Field>
        </div>
      )}
    </div>
  );
}
