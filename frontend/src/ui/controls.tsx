// Basic controls: buttons, inputs, switches, sliders, badges.
import * as RadixSlider from '@radix-ui/react-slider';
import {
  forwardRef,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { InfoMark } from './InfoMark';
import { Tooltip } from './Tooltip';

type Scheme = 'base' | 'accent' | 'invoke' | 'danger';
type Variant = 'solid' | 'outline' | 'ghost' | 'link';
type Size = 'xs' | 'sm' | 'md' | 'lg';

/** Button size of the viewer and canvas toolbars (32 px hit area, 18 px icons), the same in both. */
export const TOOLBAR_BUTTON_SIZE = 'md' satisfies Size;

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
export { cx };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  scheme?: Scheme;
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { scheme = 'base', variant = 'solid', size = 'sm', leftIcon, rightIcon, isLoading, fullWidth, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx('ui-btn', `ui-btn--${scheme}`, `ui-btn--${variant}`, `ui-btn--${size}`, fullWidth && 'ui-btn--full', className)}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading ? <Spinner size={12} /> : leftIcon}
      {children !== undefined && <span className="ui-btn__label">{children}</span>}
      {rightIcon}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name; also shown as tooltip. */
  label: string;
  icon: ReactNode;
  scheme?: Scheme;
  variant?: Variant;
  size?: Size;
  isActive?: boolean;
  tooltip?: ReactNode | false;
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, scheme = 'base', variant = 'ghost', size = 'sm', isActive, tooltip, tooltipSide = 'top', className, ...rest },
  ref,
) {
  const btn = (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={isActive}
      className={cx('ui-btn', 'ui-iconbtn', `ui-btn--${scheme}`, `ui-btn--${variant}`, `ui-btn--${size}`, isActive && 'is-active', className)}
      {...rest}
    >
      {icon}
    </button>
  );
  if (tooltip === false) return btn;
  return (
    <Tooltip content={tooltip ?? label} side={tooltipSide}>
      {btn}
    </Tooltip>
  );
});

export { Tooltip, TooltipProvider } from './Tooltip';

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { size?: never }>(function TextInput(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} type="text" className={cx('ui-input', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cx('ui-textarea', className)} {...rest} />;
});

export interface NumberInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Decimal places shown. */
  precision?: number;
  className?: string;
  'aria-label'?: string;
  disabled?: boolean;
}

/** Number field that commits on blur / Enter and clamps to range. */
export function NumberInput({ value, onChange, min = -Infinity, max = Infinity, step = 1, precision, className, disabled, ...aria }: NumberInputProps) {
  const fmt = (v: number) => (precision !== undefined ? v.toFixed(precision) : String(v));
  const [draft, setDraft] = useState(fmt(value));
  useEffect(() => setDraft(fmt(value)), [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = () => {
    // An empty field would read as 0 (`Number('')`); like text that is not a number, it puts the previous value back.
    const n = draft.trim() === '' ? NaN : Number(draft);
    if (Number.isFinite(n)) {
      const clamped = Math.min(max, Math.max(min, n));
      onChange(clamped);
      setDraft(fmt(clamped));
    } else setDraft(fmt(value));
  };
  return (
    <input
      type="number"
      className={cx('ui-input', 'ui-number', className)}
      value={draft}
      min={Number.isFinite(min) ? min : undefined}
      max={Number.isFinite(max) ? max : undefined}
      step={step}
      disabled={disabled}
      aria-label={aria['aria-label']}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        e.stopPropagation();
      }}
    />
  );
}

export interface SliderProps {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  marks?: number[];
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
}

export function Slider({ value, onChange, min, max, step = 1, marks, disabled, className, ...aria }: SliderProps) {
  return (
    <div className={cx('ui-slider-wrap', className)}>
      <RadixSlider.Root
        className="ui-slider"
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(v) => onChange(v[0] ?? value)}
        aria-label={aria['aria-label']}
      >
        <RadixSlider.Track className="ui-slider__track">
          <RadixSlider.Range className="ui-slider__range" />
        </RadixSlider.Track>
        <RadixSlider.Thumb className="ui-slider__thumb" aria-label={aria['aria-label']} />
      </RadixSlider.Root>
      {marks && (
        <div className="ui-slider__marks">
          {marks.map((m) => {
            const pos = (m - min) / (max - min);
            // Keep the end labels inside the slider instead of centering them on the edge.
            const shift = pos <= 0 ? '0' : pos >= 1 ? '-100%' : '-50%';
            return (
              <span key={m} style={{ left: `${pos * 100}%`, transform: `translateX(${shift})` }}>
                {m}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Slider with a number box next to it — the standard InvokeAI parameter control. */
export function SliderNumber(props: SliderProps & { precision?: number; numberMin?: number; numberMax?: number }) {
  const { precision, numberMin, numberMax, ...slider } = props;
  return (
    <div className="ui-slidernum">
      <Slider {...slider} />
      <NumberInput
        value={props.value}
        onChange={props.onChange}
        min={numberMin ?? props.min}
        max={numberMax ?? props.max}
        step={props.step}
        precision={precision}
        disabled={props.disabled}
        aria-label={props['aria-label']}
      />
    </div>
  );
}

export function Switch({ checked, onChange, disabled, 'aria-label': ariaLabel }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; 'aria-label'?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cx('ui-switch', checked && 'is-on')}
      onClick={() => onChange(!checked)}
    >
      <span className="ui-switch__thumb" />
    </button>
  );
}

export function Checkbox({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx('ui-checkbox', disabled && 'is-disabled')}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="ui-checkbox__box" aria-hidden />
      {label && <span>{label}</span>}
    </label>
  );
}

/** Label + control row used throughout the parameter panels. `info` shows on hovering the label; with `mark` a visible "i" beside the label shows it. */
export function Field({ label, children, info, mark, orientation = 'horizontal', className }: { label: ReactNode; children: ReactNode; info?: ReactNode; mark?: boolean; orientation?: 'horizontal' | 'vertical'; className?: string }) {
  return (
    <div className={cx('ui-field', `ui-field--${orientation}`, className)}>
      {mark && typeof info === 'string' && info !== '' ? (
        <span className="ui-field__label">
          {label}
          <InfoMark info={info} />
        </span>
      ) : (
        <Tooltip content={info}>
          <span className="ui-field__label">{label}</span>
        </Tooltip>
      )}
      <div className="ui-field__control">{children}</div>
    </div>
  );
}

export function Badge({ children, scheme = 'base', className }: { children: ReactNode; scheme?: Scheme | 'success' | 'warning'; className?: string }) {
  return <span className={cx('ui-badge', `ui-badge--${scheme}`, className)}>{children}</span>;
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <span className="ui-spinner" style={{ width: size, height: size }} aria-hidden />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="ui-kbd">{children}</kbd>;
}

export function Divider({ vertical }: { vertical?: boolean }) {
  return <div className={cx('ui-divider', vertical && 'ui-divider--v')} />;
}

export function EmptyState({ icon, title, description, children }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="ui-empty">
      {icon && <div className="ui-empty__icon">{icon}</div>}
      <div className="ui-empty__title">{title}</div>
      {description && <div className="ui-empty__desc">{description}</div>}
      {children}
    </div>
  );
}

export function ProgressBar({ value, indeterminate, className, label }: { value: number; indeterminate?: boolean; className?: string; label?: string }) {
  const fraction = Math.max(0, Math.min(1, value));
  return (
    <div className={cx('ui-progress', indeterminate && 'is-indeterminate', className)} role="progressbar" aria-label={label} aria-valuenow={indeterminate ? undefined : Math.round(fraction * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="ui-progress__bar" style={{ width: indeterminate ? undefined : `${fraction * 100}%` }} />
    </div>
  );
}
