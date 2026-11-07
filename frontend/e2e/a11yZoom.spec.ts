// UI zoom on the mock backend. The desktop app zooms the WebView (backend.setUiZoom, src/state/uiZoom.ts), so the page sees a
// window of (window size / zoom) CSS pixels; a browser run cannot set it, so the viewport stands in for it. At the smallest
// and the largest level, and at the smallest window the shell allows (backend/src-tauri/tauri.conf.json), the page must not
// scroll sideways and the controls a person needs to move around must lie inside the window. A fault that exists today is listed
// in a11yZoomKnown.ts; the list only gets shorter (an entry that no longer happens fails the run until it is removed).
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { findLayoutFaults } from './layoutScan';
import { UI_ZOOM_STEPS } from '../src/state/uiZoom';
import { KNOWN_ZOOM } from './a11yZoomKnown';

/** The window the shell opens with, and its smallest size (tauri.conf.json), in physical pixels. */
const WINDOW = { width: 1600, height: 960 };
const SMALLEST_WINDOW = { width: 720, height: 600 };
const LOWEST = UI_ZOOM_STEPS[0];
const HIGHEST = UI_ZOOM_STEPS[UI_ZOOM_STEPS.length - 1]!;

interface Case {
  name: string;
  size: { width: number; height: number };
}

/** The page seen at zoom z of a window: its CSS pixels are the window divided by z. */
const at = (window: { width: number; height: number }, z: number) => ({ width: Math.round(window.width / z), height: Math.round(window.height / z) });

const CASES: Case[] = [
  { name: `zoom ${LOWEST} of the default window`, size: at(WINDOW, LOWEST) },
  { name: 'zoom 2 of the default window', size: at(WINDOW, 2) },
  { name: `zoom ${HIGHEST} of the default window`, size: at(WINDOW, HIGHEST) },
  { name: 'zoom 1 of the smallest window', size: at(SMALLEST_WINDOW, 1) },
  { name: `zoom ${HIGHEST} of the smallest window`, size: at(SMALLEST_WINDOW, HIGHEST) },
];

/** Problems of the page now, as keys: sideways scroll, and navigation controls outside the window. Runs in the browser. */
function problems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const w = innerWidth;
    const h = innerHeight;
    const root = document.scrollingElement!;
    if (root.scrollWidth > w + 1) out.push(`page scrolls sideways (${root.scrollWidth} > ${w})`);
    if (document.body.scrollWidth > w + 1) out.push(`body scrolls sideways (${document.body.scrollWidth} > ${w})`);
    // The ways around the app: the side bar tabs on the desktop, the bottom bar on the phone layout.
    for (const el of document.querySelectorAll('[data-testid^="tab-"], [data-testid^="phone-nav-"]')) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (el.closest('[aria-hidden="true"], [hidden]') || getComputedStyle(el).visibility === 'hidden') continue;
      // Out of the window but inside a box that scrolls to it: reachable.
      let scrolls = false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight) scrolls = true;
        if (/(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth) scrolls = true;
      }
      if (scrolls) continue;
      if (r.left < -1 || r.right > w + 1 || r.top < -1 || r.bottom > h + 1) out.push(`${el.getAttribute('data-testid')} lies outside the window`);
    }
    return out;
  });
}

for (const c of CASES) {
  test(`${c.name} (${c.size.width}x${c.size.height}): no sideways scroll, navigation and controls stay in the window`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(c.size);
    // Under 768 CSS pixels the app shows its phone layout instead of the desktop shell.
    await page.goto('/');
    await expect(page.locator('.app, [data-testid="phone-shell"]').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('splash')).toHaveCount(0);
    await page.waitForTimeout(400);
    // Controls that stick out of their box or out of the window (the layout scan's own rules, so the same exceptions hold), counted.
    const sticking = (await findLayoutFaults(page)).filter((f) => f.kind === 'offscreen' || f.kind === 'overflow');
    const counts = { overflow: sticking.filter((f) => f.kind === 'overflow').length, offscreen: sticking.filter((f) => f.kind === 'offscreen').length };
    const found = [...new Set(await problems(page))].sort();
    if (process.env.A11Y_REPORT) {
      for (const k of found) console.log(`A11Y-ZOOM | ${c.name} | ${k}`);
      for (const f of sticking) console.log(`A11Y-ZOOM-FAULT | ${c.name} | ${f.kind} ${f.where} ${f.text}`);
    }
    const known = new Set(KNOWN_ZOOM[c.name]?.problems ?? []);
    const most = KNOWN_ZOOM[c.name]?.most ?? {};
    for (const kind of ['overflow', 'offscreen'] as const) expect(counts[kind], `controls with an ${kind} fault at "${c.name}" (most allowed: a11yZoomKnown.ts)`).toBeLessThanOrEqual(most[kind] ?? 0);
    expect(found.filter((k) => !known.has(k)), `"${c.name}" beyond a11yZoomKnown.ts`).toEqual([]);
    expect([...known].filter((k) => !found.includes(k)), `known fault of "${c.name}" that no longer happens (delete the entry)`).toEqual([]);
  });
}
