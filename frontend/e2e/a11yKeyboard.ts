// The page side of the keyboard checks (a11yKeyboard.spec.ts): what has focus now, how it is drawn, and which controls a
// person could reach with Tab. Each function runs in the browser, so it uses nothing from outside its own body.
import type { Page } from '@playwright/test';

export interface FocusInfo {
  /** A stable name of the element: test id, label, class or text. */
  key: string;
  /** Position of the element among all elements of the document, in DOM order. */
  order: number;
  top: number;
  left: number;
  /** True when focus shows: an outline or a box-shadow is drawn on the element or on its focus ring parent. */
  indicator: boolean;
  tabindex: number | null;
  /** True when the element is inside an open dialog, menu, popover or listbox. */
  inLayer: boolean;
}

/** The focused element now, or null when focus is on the page itself. */
export function readFocus(page: Page): Promise<FocusInfo | null> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return null;
    const id = el.getAttribute('data-testid');
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean)[0] ?? '' : '';
    const label = el.getAttribute('aria-label') || (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 24);
    const key = `${el.tagName.toLowerCase()}${id ? `[${id}]` : cls ? `.${cls}` : ''}${!id && label ? `"${label}"` : ''}`;
    const drawn = (e: Element) => {
      const cs = getComputedStyle(e);
      const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      const shadow = cs.boxShadow !== 'none';
      return outline || shadow;
    };
    // A checkbox or a radio draws its focus on the box beside it, a native input hidden on purpose.
    const sibling = el.nextElementSibling;
    // A field may draw its focus on the box that wraps it (:focus-within), as the search and count fields do.
    const wrapped = (e: Element) => { for (let p = e.parentElement, n = 0; p && n < 3; p = p.parentElement, n++) if (p.matches(':focus-within') && drawn(p)) return true; return false; };
    const indicator = drawn(el) || (el instanceof HTMLInputElement && !!sibling && drawn(sibling)) || wrapped(el);
    const r = el.getBoundingClientRect();
    const all = document.getElementsByTagName('*');
    let order = 0;
    for (let i = 0; i < all.length; i++) if (all[i] === el) order = i;
    const tab = el.getAttribute('tabindex');
    return {
      key,
      order,
      top: Math.round(r.top),
      left: Math.round(r.left),
      indicator,
      tabindex: tab === null ? null : Number(tab),
      inLayer: !!el.closest('[role="dialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]'),
    };
  });
}

/** The keys of the controls on the page a person would expect Tab to reach: visible, enabled, not taken out of the order on purpose. */
export function expectedTabStops(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const sel = 'button, a[href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';
    for (const el of document.querySelectorAll(sel)) {
      if ((el as HTMLButtonElement).disabled) continue;
      if (el.getAttribute('tabindex') === '-1') continue;
      // A tab list or toolbar is a roving group: its items take the focus, not the group itself.
      if (el.matches('[role="tablist"], [role="toolbar"], [role="radiogroup"], [role="menu"], [role="listbox"]')) continue;
      if (el.closest('[inert], [aria-hidden="true"], [hidden]')) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      let hiddenAncestor = false;
      for (let p: Element | null = el; p; p = p.parentElement) if (getComputedStyle(p).display === 'none') hiddenAncestor = true;
      if (hiddenAncestor) continue;
      // A checkbox drawn as a box beside a 0-size native input is still the stop.
      if ((r.width < 1 || r.height < 1) && !(el instanceof HTMLInputElement)) continue;
      const id = el.getAttribute('data-testid');
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean)[0] ?? '' : '';
      const label = el.getAttribute('aria-label') || (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 24);
      out.push(`${el.tagName.toLowerCase()}${id ? `[${id}]` : cls ? `.${cls}` : ''}${!id && label ? `"${label}"` : ''}`);
    }
    return out;
  });
}

/** The keys of visible buttons, links and fields that were taken out of the Tab order with tabindex="-1" and are not an item of a group that moves by arrow keys. */
export function tabbedOutControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const group = '[role="tablist"], [role="toolbar"], [role="radiogroup"], [role="menu"], [role="listbox"], [role="tree"], [role="grid"], [role="slider"], [role="combobox"], [data-radix-collection-item]';
    for (const el of document.querySelectorAll('button[tabindex="-1"], a[href][tabindex="-1"], input[tabindex="-1"], select[tabindex="-1"], textarea[tabindex="-1"]')) {
      if ((el as HTMLButtonElement).disabled) continue;
      if (el.closest(group) || el.closest('[inert], [aria-hidden="true"], [hidden]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || getComputedStyle(el).visibility === 'hidden') continue;
      const id = el.getAttribute('data-testid');
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean)[0] ?? '' : '';
      const label = el.getAttribute('aria-label') || (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 24);
      out.push(`${el.tagName.toLowerCase()}${id ? `[${id}]` : cls ? `.${cls}` : ''}${!id && label ? `"${label}"` : ''}`);
    }
    return out;
  });
}
