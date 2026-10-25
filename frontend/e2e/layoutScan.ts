// The page side of the layout scan: measures the boxes of what the page shows now (layoutRules.ts decides what is a fault).
// It reads the real layout, so it needs no knowledge of which screen is open.
import type { Page } from '@playwright/test';
import { layoutFaults, type LayoutFault, type LayoutSnapshot } from './layoutRules';

/** What counts as a control: something people press, type into or pick from. */
const CONTROLS = [
  'button',
  'select',
  'textarea',
  'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"])',
  '[role="combobox"]',
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
].join(', ');

/** Measures the page. Runs in the browser, so it uses nothing from outside its own body. */
function measure({ controls }: { controls: string }): LayoutSnapshot {
  const ids = new Map<Element, number>();
  const nodes: LayoutSnapshot['nodes'] = [];
  const describe = (el: Element) => {
    const id = el.getAttribute('data-testid');
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${id ? `[${id}]` : ''}`;
  };
  const px = (v: string) => parseFloat(v) || 0;
  const transparent = (c: string) => c === 'transparent' || /^rgba\(.*,\s*0\)$/.test(c) || /\/\s*0\)$/.test(c);
  const ownText = (el: Element) => {
    let text = '';
    for (const n of el.childNodes) if (n.nodeType === Node.TEXT_NODE) text += n.textContent ?? '';
    return text.replace(/\s+/g, ' ').trim();
  };
  const floats = (cs: CSSStyleDeclaration) => cs.position === 'fixed' || cs.position === 'absolute';
  // A sticky bar stays put over the rows scrolled under it, so it is a surface of its own, as a floating box is.
  const surface = (cs: CSSStyleDeclaration) => floats(cs) || cs.position === 'sticky';
  const box = (r: DOMRect) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });

  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg, canvas, [aria-hidden="true"], .sr-only, [data-layout-ignore]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'contents' || px(cs.opacity) === 0) continue;
    const control = el.matches(controls);
    const text = ownText(el);
    const sides = ['Top', 'Right', 'Bottom', 'Left'] as const;
    const borders = sides.filter((s) => px(cs.getPropertyValue(`border-${s.toLowerCase()}-width`)) > 0 && cs.getPropertyValue(`border-${s.toLowerCase()}-style`) !== 'none' && !transparent(cs.getPropertyValue(`border-${s.toLowerCase()}-color`)));
    const radii = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(px) as [number, number, number, number];
    const card = !control && borders.length === 4 && radii.some((x) => x > 0);
    const boxed = borders.length > 0 || !transparent(cs.backgroundColor) || cs.backgroundImage !== 'none';
    if (!control && !card && !text) continue;

    // The surface it sits on: the nearest floating or sticky box (itself included) or the nearest box that clips or scrolls
    // what is inside it. Boxes of different surfaces are not compared: a row scrolled under a panel's header is not touching it.
    let layer = 0;
    for (let p: Element | null = el; p && p !== document.body; p = p.parentElement) {
      const pcs = getComputedStyle(p);
      if (surface(pcs) || (p !== el && (pcs.overflowX !== 'visible' || pcs.overflowY !== 'visible'))) {
        if (!ids.has(p)) ids.set(p, ids.size + 1);
        layer = ids.get(p)!;
        break;
      }
    }
    if (!ids.has(el)) ids.set(el, ids.size + 1);
    const parents: number[] = [];
    for (let p = el.parentElement; p; p = p.parentElement) {
      const id = ids.get(p);
      if (id !== undefined) parents.push(id);
    }

    const chain: LayoutSnapshot['nodes'][number]['chain'] = [];
    if (control && !floats(cs)) {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const pcs = getComputedStyle(p);
        if (pcs.display === 'contents') continue;
        const pr = p.getBoundingClientRect();
        const ox = pcs.overflowX;
        const scrolls = ox === 'auto' || ox === 'scroll';
        const row = (pcs.display.includes('flex') && pcs.flexDirection.startsWith('row') && pcs.flexWrap === 'nowrap') || (pcs.display.includes('grid') && pcs.gridAutoFlow.startsWith('column'));
        const clip = ox === 'hidden' || ox === 'clip' ? 'clip' : scrolls ? (row ? 'strip' : 'scroll') : 'none';
        const layerStep = floats(pcs);
        chain.push({
          rect: { left: pr.left + px(pcs.borderLeftWidth), top: pr.top + px(pcs.borderTopWidth), right: pr.right - px(pcs.borderRightWidth), bottom: pr.bottom - px(pcs.borderBottomWidth) },
          where: describe(p),
          clip,
          layer: layerStep,
        });
        if (clip !== 'none' || layerStep) break;
      }
    }

    nodes.push({
      id: ids.get(el)!,
      where: describe(el),
      text: (text || el.getAttribute('aria-label') || (el instanceof HTMLSelectElement ? (el.selectedOptions[0]?.text ?? '') : '') || el.getAttribute('placeholder') || '').slice(0, 60),
      rect: box(r),
      control,
      card,
      boxed,
      radii,
      layer,
      parents,
      positioned: floats(cs),
      truncateOk: !!el.closest('[data-truncate-ok]'),
      touchOk: !!el.closest('[data-touch-ok]'),
      hasText: !!text,
      ellipsis: cs.textOverflow === 'ellipsis',
      clamp: cs.webkitLineClamp !== 'none' && cs.webkitLineClamp !== '',
      hidesOverflow: /(hidden|clip)/.test(cs.overflowX) || /(hidden|clip)/.test(cs.overflowY),
      leaf: el.children.length === 0,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      chain,
    });
  }
  return { viewport: { width: innerWidth, height: innerHeight }, nodes };
}

/** The boxes of what the page shows now. */
export function snapshotLayout(page: Page): Promise<LayoutSnapshot> {
  return page.evaluate(measure, { controls: CONTROLS });
}

/** The layout faults of what the page shows now. */
export async function findLayoutFaults(page: Page): Promise<LayoutFault[]> {
  return layoutFaults(await snapshotLayout(page));
}

/**
 * Runs `fn` with the page switched to another theme, then switches back. It sets `data-theme` on the root as the app does
 * (App.tsx), with colour transitions turned off for the moment, so `fn` measures the final colours and switching back starts
 * no transition either. The themes differ only in colours (theme/tokens.css), so the boxes stay where they are.
 */
export async function measureInTheme<T>(page: Page, theme: 'dark' | 'light', fn: () => Promise<T>): Promise<T> {
  const previous = await page.evaluate((next) => {
    const style = document.createElement('style');
    style.id = 'layout-scan-no-transition';
    style.textContent = '*, *::before, *::after { transition: none !important; }';
    document.head.append(style);
    const root = document.documentElement;
    const was = root.dataset.theme ?? null;
    root.dataset.theme = next;
    return was;
  }, theme);
  try {
    return await fn();
  } finally {
    await page.evaluate((was) => {
      const root = document.documentElement;
      if (was === null) delete root.dataset.theme;
      else root.dataset.theme = was;
      // Settle the styles while transitions are still off, then turn them back on.
      void document.body.getBoundingClientRect();
      document.querySelectorAll('#layout-scan-no-transition').forEach((s) => s.remove());
    }, previous);
  }
}
