// Colour contrast of text on a solid background, in the dark and the light theme, on the mock backend. axe leaves contrast out
// (gradients and pictures behind text), so a11yContrast.ts reads only text whose background is a plain colour all the way up
// (the ratio from computed styles: 4.5, or 3 for large text) and skips the rest. A screen that still has low-contrast text is
// listed in a11yContrastKnown.ts with the most elements (distinct tag, class and test id) it may report; the list only gets
// shorter. The palette is in src/theme/tokens.css, the only place to fix a colour.
import type { Page } from '@playwright/test';
import { expect, msg, openApp, showTab, test } from './fixtures';
import { measureInTheme } from './layoutScan';
import { measureContrast, type LowContrast } from './a11yContrast';
import { KNOWN_CONTRAST } from './a11yContrastKnown';

const TABS = ['generate', 'comic', 'canvas', 'upscaling', 'workflows', 'models', 'browse', 'queue'] as const;
/** Fewest pieces of text a screen must offer for the measurement to count (a blank screen would pass for nothing). */
const MIN_MEASURED = 15;

/** The distinct elements that fail, worst first. */
function distinct(low: LowContrast[]): LowContrast[] {
  const worst = new Map<string, LowContrast>();
  for (const l of low) {
    const k = `${l.key}@${l.needed}`;
    const was = worst.get(k);
    if (!was || l.ratio < was.ratio) worst.set(k, l);
  }
  return [...worst.values()].sort((a, b) => a.ratio - b.ratio);
}

async function check(page: Page, surface: string): Promise<void> {
  for (const theme of ['dark', 'light'] as const) {
    await measureInTheme(page, theme, async () => {
      const { low, measured, skipped } = await measureContrast(page);
      const found = distinct(low);
      const name = `${surface} (${theme})`;
      if (process.env.A11Y_REPORT) {
        console.log(`A11Y-CONTRAST | ${name} | measured ${measured}, skipped ${skipped}, failing ${found.length}`);
        for (const f of found.slice(0, 8)) console.log(`A11Y-CONTRAST-WORST | ${name} | ${f.ratio}:1 (needs ${f.needed}) ${f.key} "${f.text}"`);
      }
      expect(measured, `too little text measured on "${name}" (most of it sits on gradients or pictures?)`).toBeGreaterThanOrEqual(MIN_MEASURED);
      const most = KNOWN_CONTRAST[name] ?? 0;
      expect(found.length, `elements with low-contrast text on "${name}" (most allowed: a11yContrastKnown.ts); worst: ${found.slice(0, 5).map((f) => `${f.key} ${f.ratio}:1 "${f.text}"`).join(' | ')}`).toBeLessThanOrEqual(most);
    });
  }
}

for (const tab of TABS) {
  test(`${tab} tab: text on solid backgrounds has enough contrast in both themes`, async ({ page }) => {
    test.setTimeout(60_000);
    await openApp(page);
    await showTab(page, tab);
    await page.waitForTimeout(400);
    await check(page, tab);
  });
}

test('settings dialog: text on solid backgrounds has enough contrast in both themes', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: msg('app.nav.settingsMenu') }).click();
  await page.getByRole('menuitem', { name: msg('app.nav.settings') }).click();
  await expect(page.getByTestId('settings-modal')).toBeVisible();
  await page.waitForTimeout(400);
  await check(page, 'settings dialog');
});
