// A check that text fits where the app shows it, run in the page: nothing is cut off and nothing is pushed out of its box.
// It reads the real layout (the browser measures it), so it needs no knowledge of which message sits where.
import type { Page } from '@playwright/test';

export interface FitProblem {
  /** What is wrong: `clipped` (text is hidden by overflow), `outside` (text sticks out of its control), `broken` (a short label wraps), `offscreen` (a tooltip, menu or dialog is partly outside the window). */
  kind: 'clipped' | 'outside' | 'broken' | 'offscreen';
  /** The element, as `tag.class` plus a `data-testid` when there is one. */
  where: string;
  text: string;
}

/**
 * Elements that show one short label on one line: buttons, tabs, radios, menu items, badges, headings of sections.
 * A long sentence may wrap, so only labels of up to `SHORT` characters count as `broken` when they wrap.
 */
const LABELS = 'button, [role="tab"], [role="radio"], [role="menuitem"], [role="option"], [role="combobox"], label, th, .ui-badge, .ui-btn__label, summary';
const SHORT = 16;

interface FitArgs {
  labels: string;
  short: number;
  /** Limits the check to that selector and what is inside it (a tooltip that just opened). */
  root: string | null;
}

/** The check itself. Runs in the page, so it uses nothing from outside its own body. */
function fitProblemsInPage({ labels, short, root }: FitArgs): FitProblem[] {
  const out: { kind: 'clipped' | 'outside' | 'broken' | 'offscreen'; where: string; text: string }[] = [];
  const seen = new Set<string>();
  const describe = (el: Element) => {
    const id = el.getAttribute('data-testid');
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${id ? `[${id}]` : ''}`;
  };
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const ownText = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  const add = (kind: 'clipped' | 'outside' | 'broken' | 'offscreen', el: Element, text: string) => {
    const key = `${kind}|${describe(el)}|${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, where: describe(el), text: text.slice(0, 60) });
  };
  /** The most lines one run of text takes: a text node of the element that wraps (icons and other boxes are not text). */
  const lineCount = (el: Element) => {
    let most = 0;
    for (const node of el.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE || !(node.textContent ?? '').trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const tops = new Set<number>();
      for (const r of range.getClientRects()) if (r.width > 0) tops.add(Math.round(r.top / 4));
      most = Math.max(most, tops.size);
    }
    return most;
  };

  // Floating surfaces must be inside the window.
  /**
   * The box around the text of an element: its text nodes only, so a hidden form input or an icon does not count, and
   * not text inside a child that is cut to "…" or scrolled on purpose.
   */
  const textRect = (el: Element) => {
    let box: { left: number; top: number; right: number; bottom: number } | null = null;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!(node.textContent ?? '').trim()) continue;
      let skip = false;
      for (let p = node.parentElement; p && p !== el.parentElement; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none' || /(hidden|clip|auto|scroll)/.test(cs.overflowX) || cs.position === 'absolute' || cs.position === 'fixed') {
          if (p !== el) skip = true;
          break;
        }
      }
      if (skip) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      if (r.width === 0) continue;
      box = box ? { left: Math.min(box.left, r.left), top: Math.min(box.top, r.top), right: Math.max(box.right, r.right), bottom: Math.max(box.bottom, r.bottom) } : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }
    return box;
  };

  // Floating surfaces must be inside the window.
  for (const el of document.querySelectorAll('.ui-tooltip, [role="menu"], [role="dialog"], [role="listbox"]')) {
    if (!visible(el) || (root && !el.matches(`${root}, ${root} *`))) continue;
    const r = el.getBoundingClientRect();
    if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) add('offscreen', el, ownText(el));
  }

  for (const el of document.querySelectorAll(root ? `${root}, ${root} *` : 'body *')) {
    if (!visible(el) || el.closest('[aria-hidden="true"], svg, canvas, .sr-only, [data-fit-ignore]')) continue;
    const text = ownText(el);
    if (!text) continue;
    const cs = getComputedStyle(el);
    const hidesOverflow = /(hidden|clip)/.test(cs.overflowX) || /(hidden|clip)/.test(cs.overflowY);
    const ellipsis = cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none';

    // Text cut off by the box itself (not meant to be shortened with "…" or scrolled).
    if (hidesOverflow && !ellipsis && el.children.length === 0) {
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) add('clipped', el, text);
    }
    if (!el.matches(labels)) continue;
    // A control whose text sticks out of the control.
    const box = el.getBoundingClientRect();
    const rect = textRect(el);
    if (rect && (rect.right > box.right + 1.5 || rect.bottom > box.bottom + 1.5 || rect.left < box.left - 1.5 || rect.top < box.top - 1.5) && !ellipsis) add('outside', el, text);
    // A short label that wraps reads as broken (a word cut in two).
    if ([...text].length <= short && lineCount(el) > 1 && !el.querySelector('br')) add('broken', el, text);
  }
  return out;
}

/** Finds text that does not fit in what is visible on the page now. */
/** `root` limits the check to that selector and what is inside it (a tooltip that just opened). */
export async function findFitProblems(page: Page, root?: string): Promise<FitProblem[]> {
  return page.evaluate(fitProblemsInPage, { labels: LABELS, short: SHORT, root: root ?? null });
}

/** What the tooltip sweep found: the faults, and the text of every tooltip it measured. */
export interface TooltipSweep {
  problems: FitProblem[];
  shown: string[];
}

/**
 * Shows every tooltip of the page, one at a time, and checks each. Runs in the page (one call for the whole screen): a
 * Radix tooltip opens at once when its trigger takes focus (hover waits 400 ms) and closes when it loses it, so each
 * trigger is focused (a span gets a `tabindex` for the moment), the tooltip is measured once it is placed, and the trigger
 * is blurred. A trigger counts only when a pointer could reach it (the topmost element at its centre is it or inside it),
 * as with hovering. Every trigger is shown, also one whose label another has (two fields of one name can show different
 * tooltips). `fit` is `fitProblemsInPage`, passed in as source.
 */
async function sweepTooltipsInPage(fit: (args: FitArgs) => FitProblem[], { labels, short, skip }: { labels: string; short: number; skip: string | null }): Promise<TooltipSweep> {
  const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  /** The open tooltip, once Radix has placed it (it parks the box at translate(0, -200%) until then). */
  const placed = () => {
    const tip = document.querySelector('.ui-tooltip');
    const wrap = tip?.closest<HTMLElement>('[data-radix-popper-content-wrapper]');
    return tip && !(wrap?.style.transform ?? '').includes('-200%') ? tip : null;
  };
  const triggers: HTMLElement[] = [];
  for (const el of document.querySelectorAll<HTMLElement>('[data-state="closed"]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    if (el.closest('.ui-tooltip, [role="dialog"] [role="dialog"]') || (el as HTMLButtonElement).disabled || (skip && el.closest(skip))) continue;
    const x = Math.min(Math.max((Math.max(r.left, 0) + Math.min(r.right, innerWidth)) / 2, 0), innerWidth - 1);
    const y = Math.min(Math.max((Math.max(r.top, 0) + Math.min(r.bottom, innerHeight)) / 2, 0), innerHeight - 1);
    const hit = document.elementFromPoint(x, y);
    if (!hit || !el.contains(hit)) continue;
    triggers.push(el);
  }
  const problems: FitProblem[] = [];
  const shown: string[] = [];
  for (const el of triggers) {
    if (!el.isConnected || el.getAttribute('data-state') !== 'closed') continue;
    const tabbed = !el.hasAttribute('tabindex') && el.tabIndex < 0;
    if (tabbed) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
    let tip: Element | null = null;
    for (let i = 0; i < 10 && !tip; i++) {
      await frame();
      tip = placed();
      // Not a tooltip trigger (a popover or a section toggle): nothing opens on focus.
      if (!tip && i >= 2 && !document.querySelector('.ui-tooltip')) break;
    }
    if (tip) {
      await frame();
      shown.push((tip.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60));
      problems.push(...fit({ labels, short, root: '.ui-tooltip' }));
    }
    el.blur();
    if (tabbed) el.removeAttribute('tabindex');
    for (let i = 0; i < 10 && document.querySelector('.ui-tooltip'); i++) await frame();
  }
  return { problems, shown };
}

/** Shows every tooltip the page offers now and checks each (see sweepTooltipsInPage); `skip` leaves out the triggers inside it. */
export async function sweepTooltips(page: Page, skip?: string): Promise<TooltipSweep> {
  const arg = JSON.stringify({ labels: LABELS, short: SHORT, skip: skip ?? null });
  return page.evaluate(`(${sweepTooltipsInPage.toString()})(${fitProblemsInPage.toString()}, ${arg})`) as Promise<TooltipSweep>;
}

/** The faults of every tooltip the page offers now. */
export async function checkTooltips(page: Page): Promise<FitProblem[]> {
  return (await sweepTooltips(page)).problems;
}

/**
 * Waits in the page until it has settled: at least `min` ms, then until nothing in the page changed for `quiet` frames in
 * a row and no floating box is still waiting for its place, but never longer than `max` ms. The mock answers a call after
 * 60 ms, so `min` 150 lets two calls in a row land, and every answer that changes the page restarts the quiet frames.
 */
async function settleInPage({ min, quiet, max }: { min: number; quiet: number; max: number }): Promise<void> {
  const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const start = performance.now();
  let changed = false;
  const watch = new MutationObserver(() => (changed = true));
  watch.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  let still = 0;
  while (performance.now() - start < max) {
    await frame();
    const parked = [...document.querySelectorAll<HTMLElement>('[data-radix-popper-content-wrapper]')].some((w) => w.style.transform.includes('-200%'));
    still = changed || parked ? 0 : still + 1;
    changed = false;
    if (still >= quiet && performance.now() - start >= min) break;
  }
  watch.disconnect();
}

/**
 * Opens every menu, popover and picker the page offers (and the listed extra buttons), checking each; `skip` leaves out
 * the openers inside it. An opener repeated down a list (the menu of every model row, the tag of every card) is opened
 * once: openers count as the same when their own label (test id, accessible name or text) and the test id of the nearest
 * marked box around them are the same, so two fields of one name in different boxes are both opened.
 */
export async function checkOpeners(page: Page, extra: string[] = [], { skip, limit = 24 }: { skip?: string; limit?: number } = {}): Promise<FitProblem[]> {
  const problems: FitProblem[] = [];
  const selector = ['[aria-haspopup]:not([aria-haspopup="false"])', '[aria-expanded="false"]', ...extra].join(', ');
  for (let n = 0; n < limit; n++) {
    // The first opener not tried yet (opening a section changes what matches, so the list is read again each time).
    const found = await page.evaluate(
      ({ sel, skip }) => {
        document.querySelectorAll('[data-fit-current]').forEach((e) => e.removeAttribute('data-fit-current'));
        const key = (e: HTMLElement) => {
          let box = '';
          for (let p = e.parentElement; p && !box; p = p.parentElement) box = p.getAttribute('data-testid') ?? '';
          const own = e.getAttribute('data-testid') || e.getAttribute('aria-label') || (e.textContent ?? '').trim().slice(0, 40) || e.tagName;
          return `${own}@${box}`;
        };
        const tried = new Set([...document.querySelectorAll<HTMLElement>('[data-fit-opened]')].map(key));
        const el = [...document.querySelectorAll<HTMLElement>(sel)].find((e) => {
          const r = e.getBoundingClientRect();
          return !e.hasAttribute('data-fit-opened') && r.width > 0 && r.height > 0 && !(e as HTMLButtonElement).disabled && !e.closest('[aria-hidden="true"]') && !(skip && e.closest(skip)) && !tried.has(key(e));
        });
        if (!el) return false;
        el.setAttribute('data-fit-opened', '1');
        el.setAttribute('data-fit-current', '1');
        return true;
      },
      { sel: selector, skip: skip ?? null },
    );
    if (!found) break;
    try {
      await page.locator('[data-fit-current]').first().click({ timeout: 1500 });
    } catch {
      continue;
    }
    await page.evaluate(settleInPage, { min: 150, quiet: 4, max: 250 });
    problems.push(...(await findFitProblems(page)));
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.mouse.move(0, 0);
    await page.evaluate(settleInPage, { min: 0, quiet: 2, max: 100 });
  }
  return problems;
}
