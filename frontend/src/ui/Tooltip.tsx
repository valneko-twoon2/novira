// Tooltips: the name or hint of a control, shown after a short hover and at once on keyboard focus. A screen holds a few
// hundred of them, so a closed tooltip is only a few event handlers on its control; the bubble exists while it is open.
// (Radix's tooltip mounted a popper, a portal and a presence per control, and rendered each one twice when it attached,
// which was a fifth of the time of a screen switch.) It behaves as Radix's did: `data-state` on the control, a delay of
// 400 ms that is skipped for 300 ms after another tooltip closed, closed by a press, a click, Escape, leaving or a scroll.
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';

type Side = 'top' | 'right' | 'bottom' | 'left';

const OPEN_DELAY_MS = 400;
const SKIP_DELAY_MS = 300;
const OFFSET_PX = 6;
const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

/** When a tooltip last closed: moving on to the next control within SKIP_DELAY_MS shows its tooltip at once. */
let lastClosedAt = Number.NEGATIVE_INFINITY;

/** Kept so the screens and tests that wrap their tree in it need no change; the tooltips need no shared state. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: Side }) {
  if (content === null || content === undefined || content === '' || !isValidElement(children)) return <>{children}</>;
  return (
    <TooltipTrigger content={content} side={side}>
      {children as ReactElement<TriggerProps>}
    </TooltipTrigger>
  );
}

/** What the tooltip adds to its control's props. */
interface TriggerProps {
  ref?: Ref<HTMLElement>;
  'data-state'?: string;
  'aria-describedby'?: string;
  onPointerMove?: (e: PointerEvent<HTMLElement>) => void;
  onPointerLeave?: (e: PointerEvent<HTMLElement>) => void;
  onPointerDown?: (e: PointerEvent<HTMLElement>) => void;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  onFocus?: (e: FocusEvent<HTMLElement>) => void;
  onBlur?: (e: FocusEvent<HTMLElement>) => void;
}

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

/** The control's own handler first, then the tooltip's (as Radix's Slot composes them). */
function both<E>(own: ((e: E) => void) | undefined, mine: (e: E) => void) {
  return (e: E) => {
    own?.(e);
    mine(e);
  };
}

function TooltipTrigger({ content, side, children }: { content: ReactNode; side: Side; children: ReactElement<TriggerProps> }) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const anchor = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** A press focuses the control too; that focus does not open the tooltip. */
  const pressing = useRef(false);
  const id = useId();

  const cancel = () => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
  };
  const show = () => {
    cancel();
    openRef.current = true;
    setOpen(true);
  };
  const hide = useCallback(() => {
    cancel();
    if (openRef.current) lastClosedAt = performance.now();
    openRef.current = false;
    setOpen(false);
  }, []);
  useEffect(() => cancel, []);

  // While open: Escape and a scroll of what holds the control close it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    const onScroll = (e: Event) => e.target instanceof Node && e.target.contains(anchor.current) && hide();
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, [open, hide]);

  const own = children.props;
  const childRef = own.ref;
  const ref = useCallback(
    (node: HTMLElement | null) => {
      anchor.current = node;
      setRef(childRef, node);
    },
    [childRef],
  );

  const trigger = cloneElement(children, {
    ref,
    // The control's own state (a menu or popover trigger) wins, as with Radix.
    'data-state': own['data-state'] ?? (open ? 'delayed-open' : 'closed'),
    'aria-describedby': own['aria-describedby'] ?? (open ? id : undefined),
    onPointerMove: both(own.onPointerMove, (e) => {
      if (e.pointerType === 'touch' || openRef.current || timer.current !== undefined || pressing.current) return;
      const since = performance.now() - lastClosedAt;
      if (since >= 0 && since < SKIP_DELAY_MS) show();
      else timer.current = setTimeout(show, OPEN_DELAY_MS);
    }),
    onPointerLeave: both(own.onPointerLeave, hide),
    onPointerDown: both(own.onPointerDown, () => {
      pressing.current = true;
      document.addEventListener('pointerup', () => (pressing.current = false), { once: true });
      hide();
    }),
    onClick: both(own.onClick, hide),
    onFocus: both(own.onFocus, () => {
      if (!pressing.current) show();
    }),
    onBlur: both(own.onBlur, hide),
  });

  return (
    <>
      {trigger}
      {open && (
        <Bubble id={id} anchor={anchor} side={side}>
          {content}
        </Bubble>
      )}
    </>
  );
}

/** The open tooltip, placed beside its control on `side`, or on the other side when that side has no room, inside the window. */
function Bubble({ id, anchor, side, children }: { id: string; anchor: { current: HTMLElement | null }; side: Side; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    const at = anchor.current;
    if (!el || !at) return;
    const a = at.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const room: Record<Side, boolean> = {
      top: a.top - OFFSET_PX - h >= 0,
      bottom: a.bottom + OFFSET_PX + h <= innerHeight,
      left: a.left - OFFSET_PX - w >= 0,
      right: a.right + OFFSET_PX + w <= innerWidth,
    };
    const placed = room[side] || !room[OPPOSITE[side]] ? side : OPPOSITE[side];
    const vertical = placed === 'top' || placed === 'bottom';
    let x = vertical ? a.left + a.width / 2 - w / 2 : placed === 'left' ? a.left - OFFSET_PX - w : a.right + OFFSET_PX;
    let y = vertical ? (placed === 'top' ? a.top - OFFSET_PX - h : a.bottom + OFFSET_PX) : a.top + a.height / 2 - h / 2;
    x = Math.min(Math.max(x, 0), Math.max(innerWidth - w, 0));
    y = Math.min(Math.max(y, 0), Math.max(innerHeight - h, 0));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.visibility = '';
    el.dataset.side = placed;
  });
  return createPortal(
    <div ref={box} id={id} role="tooltip" className="ui-tooltip" style={{ position: 'fixed', left: 0, top: 0, visibility: 'hidden', pointerEvents: 'none' }}>
      {children}
    </div>,
    document.body,
  );
}
