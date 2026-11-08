// The system colour picker as a control. While the picker is dragged the browser fires an `input` event for every pointer
// move, several per frame, and each one would redraw whatever the colour paints (the text canvas, a layer, a page). So the
// first change of a burst goes out at once and the rest are folded into one change per animation frame (the latest value).
import { useCallback, useEffect, useRef, useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  /** `#rrggbb`. */
  value: string;
  onChange: (hex: string) => void;
};

export function ColorInput({ value, onChange, onBlur, ...rest }: Props) {
  // What the swatch shows while a drag is ahead of the parent's value.
  const [live, setLive] = useState<string | null>(null);
  const pending = useRef<string | null>(null);
  const frame = useRef(0);
  const send = useRef(onChange);
  send.current = onChange;

  /** One frame of a burst: send the latest value if one arrived, and keep the window open while changes keep coming. */
  const tick = useCallback(() => {
    const hex = pending.current;
    pending.current = null;
    if (hex === null) {
      frame.current = 0;
      setLive(null);
      return;
    }
    send.current(hex);
    frame.current = requestAnimationFrame(tick);
  }, []);

  /** Sends what is waiting now (the picker closed, or the control went away). */
  const flush = useCallback(() => {
    const hex = pending.current;
    pending.current = null;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    if (hex !== null) send.current(hex);
    setLive(null);
  }, []);

  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      const hex = pending.current;
      pending.current = null;
      if (hex !== null) send.current(hex);
    },
    [],
  );

  return (
    <input
      {...rest}
      type="color"
      value={live ?? value}
      onChange={(e) => {
        const hex = e.target.value;
        setLive(hex);
        if (frame.current) {
          pending.current = hex;
          return;
        }
        send.current(hex);
        frame.current = requestAnimationFrame(tick);
      }}
      onBlur={(e) => {
        flush();
        onBlur?.(e);
      }}
    />
  );
}
