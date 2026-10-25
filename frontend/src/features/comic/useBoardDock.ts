// The element the balloon editor is laid over: the board panel at the right of the workspace, so the editor stays off the page.
// Null when that panel is closed or too narrow to hold it (and in a screen that has none); the editor then sits in the page view.
import { useEffect, useState } from 'react';

const SELECTOR = '.workspace__right';
/** The narrowest the board may be for the editor to fit over it. */
export const MIN_DOCK_WIDTH = 260;

export function useBoardDock(): HTMLElement | null {
  const [dock, setDock] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(SELECTOR);
    if (!el) {
      setDock(null);
      return;
    }
    const measure = () => setDock(el.getBoundingClientRect().width >= MIN_DOCK_WIDTH ? el : null);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  return dock;
}
