// Reduced motion on the mock backend: with the person's "reduce motion" preference on, no screen may run a CSS animation that
// repeats, or an animation or transition longer than a short bound, on anything that is shown. A fault that exists today is listed
// in a11yMotionKnown.ts; the list only gets shorter (an entry that no longer happens fails the run until it is removed).
import type { Page } from '@playwright/test';
import { expect, openApp, showTab, test } from './fixtures';
import { KNOWN_MOTION } from './a11yMotionKnown';

const TABS = ['generate', 'comic', 'canvas', 'upscaling', 'workflows', 'models', 'browse', 'queue'] as const;
/** The longest animation or transition, in seconds, that is not "motion" for a person who asked for less of it. */
const SHORT = 0.2;

/** What moves on the page now, as sorted unique keys: `<element> <kind> <detail>`. Runs in the browser. */
function findMotion(page: Page, short: number): Promise<string[]> {
  return page.evaluate((limit) => {
    const found = new Set<string>();
    const name = (el: Element) => {
      const id = el.getAttribute('data-testid');
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean)[0] ?? '' : '';
      return `${el.tagName.toLowerCase()}${id ? `[${id}]` : cls ? `.${cls}` : ''}`;
    };
    const secs = (v: string) => v.split(',').map((x) => (x.trim().endsWith('ms') ? parseFloat(x) / 1000 : parseFloat(x) || 0));
    for (const el of document.querySelectorAll('body, body *')) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if ((r.width < 1 && r.height < 1) || cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
      const names = cs.animationName.split(',').map((x) => x.trim());
      const durations = secs(cs.animationDuration);
      const counts = cs.animationIterationCount.split(',').map((x) => x.trim());
      names.forEach((n, i) => {
        if (n === 'none') return;
        const d = durations[i % durations.length]!;
        const c = counts[i % counts.length]!;
        if (c === 'infinite') found.add(`${name(el)} infinite animation ${n}`);
        else if (d > limit) found.add(`${name(el)} animation ${n} ${d}s`);
      });
      const props = cs.transitionProperty.split(',').map((x) => x.trim());
      const tds = secs(cs.transitionDuration);
      props.forEach((p, i) => {
        if (p === 'none') return;
        const d = tds[i % tds.length]!;
        if (d > limit) found.add(`${name(el)} transition ${p} ${d}s`);
      });
    }
    return [...found].sort();
  }, short);
}

for (const tab of TABS) {
  test(`${tab} tab: nothing longer than ${SHORT * 1000} ms moves under reduced motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openApp(page);
    await showTab(page, tab);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'the preference is not on').toBe(true);
    const found = await findMotion(page, SHORT);
    if (process.env.A11Y_REPORT) for (const k of found) console.log(`A11Y-MOTION | ${tab} | ${k}`);
    const known = new Set(KNOWN_MOTION[tab] ?? []);
    expect(found.filter((k) => !known.has(k)), `motion on "${tab}" beyond a11yMotionKnown.ts`).toEqual([]);
    expect([...known].filter((k) => !found.includes(k)), `known motion on "${tab}" that no longer happens (delete the entry)`).toEqual([]);
  });
}
