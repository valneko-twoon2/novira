// The bar on the top edge of the assistant's message box: drag it up to make the box taller, down to make it shorter, or
// focus it and use the arrow keys. The height is kept with the window's size.
import { useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { t } from '@/i18n';
import { AGENT_INPUT_HEIGHT, useAgent } from '@/state/agent';

/** How far one arrow key press moves the edge, in pixels. */
const KEY_STEP = 16;

export function InputGrip() {
  const height = useAgent((s) => s.inputHeight);
  const setHeight = useAgent((s) => s.setInputHeight);
  const drag = useRef<{ y: number; height: number } | null>(null);
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { y: e.clientY, height };
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current) setHeight(drag.current.height + drag.current.y - e.clientY);
  };
  const up = () => {
    drag.current = null;
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowUp' ? KEY_STEP : e.key === 'ArrowDown' ? -KEY_STEP : 0;
    if (!step) return;
    e.preventDefault();
    setHeight(height + step);
  };
  return (
    <div
      className="agent-win__input-grip"
      role="separator"
      aria-orientation="horizontal"
      aria-label={t('agent.inputResize')}
      aria-valuemin={AGENT_INPUT_HEIGHT.min}
      aria-valuemax={AGENT_INPUT_HEIGHT.max}
      aria-valuenow={height}
      tabIndex={0}
      title={t('agent.inputResize')}
      data-testid="agent-input-grip"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
    />
  );
}
