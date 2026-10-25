// Click and keyboard selection rules of the gallery grid (InvokeAI: click, Ctrl/Cmd toggle, Shift range, Alt compare).
import { useGallery } from '@/state/gallery';

/** Image the next Shift range starts from. */
let anchor: string | null = null;

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

function range(list: string[], from: string, to: string): string[] | null {
  const a = list.indexOf(from);
  const b = list.indexOf(to);
  if (a < 0 || b < 0) return null;
  const slice = a <= b ? list.slice(a, b + 1) : list.slice(b, a + 1).reverse();
  return slice;
}

export function clickImage(name: string, e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }, list: string[]) {
  const g = useGallery.getState();
  if (e.altKey) {
    if (g.viewerImageName && g.viewerImageName !== name) g.setCompareImage(name);
    else g.setSelection([name]);
    return;
  }
  if (e.shiftKey && anchor) {
    const r = range(list, anchor, name);
    if (r) {
      g.setSelection(r);
      return;
    }
  }
  if (isMac ? e.metaKey : e.ctrlKey) {
    const sel = g.selection.includes(name) ? g.selection.filter((n) => n !== name) : [...g.selection, name];
    g.setSelection(sel);
    anchor = name;
    return;
  }
  g.setSelection([name]);
  anchor = name;
}

/**
 * Move the selection by `step` positions, or to the index `step` returns for the current one;
 * with `extend` grow the range from the anchor.
 */
export function moveSelection(list: string[], step: number | ((index: number) => number), extend: boolean): number | null {
  if (!list.length) return null;
  const g = useGallery.getState();
  const current = g.selection[g.selection.length - 1] ?? g.viewerImageName;
  const idx = current ? list.indexOf(current) : -1;
  const next = idx < 0 ? 0 : Math.max(0, Math.min(list.length - 1, typeof step === 'number' ? idx + step : step(idx)));
  const name = list[next]!;
  if (extend) {
    const r = range(list, anchor ?? current ?? name, name);
    g.setSelection(r ?? [name]);
  } else {
    g.setSelection([name]);
    anchor = name;
  }
  return next;
}
