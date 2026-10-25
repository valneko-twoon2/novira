// Tracks an element's border box size with ResizeObserver. It watches the border box, so a scroll bar coming or going
// inside the element (the grid's rows growing after a resize) is no change and starts no second round of layout.
import { useLayoutEffect, useState, type RefObject } from 'react';

export function useElementSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (s.width === r.width && s.height === r.height ? s : { width: r.width, height: r.height }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el, { box: 'border-box' });
    return () => ro.disconnect();
  }, [ref]);
  return size;
}
