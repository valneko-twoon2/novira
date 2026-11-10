// What every visual regression spec shares (`e2e/visual/<screen>.spec.ts`, the `visual` Playwright project). One spec per
// screen, each in the dark (default) and the light theme; a shot is the whole screen or one part of it. A baseline is
// `e2e/__screenshots__/visual/<screen>/<theme>/<shot>-<platform>.png` (`snapshotPathTemplate` of the project).
// Update the baselines with `npm run e2e:visual -- --update-snapshots` and look at the new pictures before committing them.
// Stability: fixed viewport and scale (project settings), a frozen clock, the mock's deterministic images, animations off,
// fonts loaded, the pointer parked away from tooltips, and time-dependent text masked.
import type { Locator, Page } from '@playwright/test';
import { expect, openApp, test } from '../fixtures';

export const THEMES = ['dark', 'light'] as const;
export type Theme = (typeof THEMES)[number];

/** Every `Date.now()` in the page returns this, so dates and times on screen never change between runs. */
const FIXED_TIME = new Date('2026-01-15T10:00:00+09:00');

/** Starts the page in a theme by seeding the persisted settings before the app reads them. */
async function useTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((t) => {
    localStorage.setItem('novira.settings', JSON.stringify({ state: { theme: t }, version: 0 }));
  }, theme);
}

/** Defines `define` once for each theme: the clock frozen and the theme chosen before the page starts. */
export function inEachTheme(define: (theme: Theme) => void): void {
  for (const theme of THEMES) {
    test.describe(`${theme} theme`, () => {
      test.beforeEach(async ({ page }) => {
        await page.clock.setFixedTime(FIXED_TIME);
        await useTheme(page, theme);
      });
      define(theme);
    });
  }
}

/** Text that depends on the wall clock or on generated ids, hidden from every screenshot. */
function timeMasks(page: Page): Locator[] {
  return [page.locator('.qt-time'), page.locator('.qt-mono'), page.locator('.lp-recent__date')];
}

/** Waits until the page is still: no toasts, fonts loaded, images decoded, and the pointer away from anything with a tooltip. */
export async function settle(page: Page): Promise<void> {
  // Toasts close on their own timer, so whether one is still up at capture time would vary: close them all.
  await page.locator('.toast__close').evaluateAll((buttons) => buttons.forEach((b) => (b as HTMLButtonElement).click()));
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.mouse.move(0, 0);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images)
        .filter((img) => img.src)
        .map((img) => img.decode().catch(() => undefined)),
    );
  });
}

/** Checks the page, or `part` of it, against the baseline `<screen>/<theme>/<shot>`. */
export async function snap(page: Page, screen: string, theme: Theme, shot: string, part?: Locator): Promise<void> {
  await settle(page);
  await expect(part ?? page).toHaveScreenshot([screen, theme, `${shot}.png`], { mask: timeMasks(page), animations: 'disabled', caret: 'hide' });
}

/**
 * Opens the app as the desktop app looks: the browser mock hides the side bar's network item unless the page is opened with
 * `?lan` (a closed home network, nothing polled), and a baseline without it would miss one item of the real side bar.
 */
export async function openDesktop(page: Page, query = ''): Promise<void> {
  await openApp(page, /(^|[?&])lan(=|&|$)/.test(query) ? query : query ? `${query}&lan` : '?lan');
}

export { expect, test };
