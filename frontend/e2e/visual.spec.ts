// Visual regression: screenshots of the main screens and dialogs, in the dark (default) and light themes.
// Runs as the `visual` Playwright project. Update the baselines with `npm run e2e:visual -- --update-snapshots`.
// Stability: fixed viewport and scale (project settings), a frozen clock, the mock's deterministic images, animations
// off, fonts loaded, the pointer parked away from tooltips, and time-dependent text masked.
import type { Locator, Page } from '@playwright/test';
import { expect, msg, openApp, showTab, test } from './fixtures';

const THEMES = ['dark', 'light'] as const;
type Theme = (typeof THEMES)[number];

/** Every `Date.now()` in the page returns this, so dates and times on screen never change between runs. */
const FIXED_TIME = new Date('2026-01-15T10:00:00+09:00');

/** Starts the page in a theme by seeding the persisted settings before the app reads them. */
async function useTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((t) => {
    localStorage.setItem('novira.settings', JSON.stringify({ state: { theme: t }, version: 0 }));
  }, theme);
}

/** Text that depends on the wall clock or on generated ids, hidden from every screenshot. */
function timeMasks(page: Page): Locator[] {
  return [page.locator('.qt-time'), page.locator('.qt-mono'), page.locator('.lp-recent__date')];
}

/** Waits until the page is still: no toasts, fonts loaded, images decoded, and the pointer away from anything with a tooltip. */
async function settle(page: Page): Promise<void> {
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

async function snap(page: Page, name: string): Promise<void> {
  await settle(page);
  await expect(page).toHaveScreenshot(name, { mask: timeMasks(page), animations: 'disabled', caret: 'hide' });
}

const TABS = ['generate', 'canvas', 'comic', 'upscaling', 'workflows', 'models', 'browse', 'queue'] as const;

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.clock.setFixedTime(FIXED_TIME);
      await useTheme(page, theme);
    });

    for (const tab of TABS) {
      test(`${tab} tab`, async ({ page }) => {
        await openApp(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await showTab(page, tab);
        if (tab === 'browse') {
          // Search results arrive after a short mock delay, and each cover picture loads on its own.
          await expect(page.getByTestId('browse-card').first()).toBeVisible();
          await expect(page.locator('.browse-skeleton')).toHaveCount(0);
        }
        await snap(page, `${theme}-tab-${tab}.png`);
      });
    }

    test('generated image in the viewer', async ({ page }) => {
      await openApp(page, '?scenario=empty');
      await page.getByTestId('seed-fixed').click();
      await page.getByTestId('positive-prompt').fill('a lighthouse on a cliff at dusk');
      await page.getByTestId('invoke-button').click();
      await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);
      await expect(page.getByTestId('image-viewer')).toBeVisible();
      // Wait until the queue is idle again, so the invoke button is back to its resting look.
      await expect(page.getByTestId('invoke-button')).toHaveText(msg('params.invoke.invoke'));
      await snap(page, `${theme}-generated-viewer.png`);
    });

    test('settings dialog', async ({ page }) => {
      await openApp(page);
      await page.getByRole('button', { name: msg('app.nav.settingsMenu') }).click();
      await page.getByRole('menuitem', { name: msg('app.nav.settings') }).click();
      await expect(page.getByTestId('settings-modal')).toBeVisible();
      await snap(page, `${theme}-settings-dialog.png`);
      // The dialog dims the side bar, and the colour threshold (0.2) lets a change of the bar under the dim pass, so the bar is
      // also checked on its own with a strict threshold.
      await settle(page);
      await expect(page.locator('.sidenav')).toHaveScreenshot(`${theme}-settings-dialog-sidebar.png`, { animations: 'disabled', caret: 'hide', threshold: 0 });
    });

    test.describe('phone layout', () => {
      // A phone held upright, at scale 1 like every other shot here.
      test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

      test('generate tab', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('phone-generate')).toBeVisible({ timeout: 20_000 });
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await snap(page, `${theme}-phone-generate.png`);
      });

      test('images tab and a picture full screen', async ({ page }) => {
        await page.goto('/');
        await page.getByTestId('phone-nav-images').tap();
        await expect(page.getByTestId('phone-thumb').first()).toBeVisible();
        await snap(page, `${theme}-phone-images.png`);
        await page.getByTestId('phone-thumb').nth(1).tap();
        await page.getByTestId('phone-view-info').tap();
        await expect(page.getByTestId('phone-view-meta')).toBeVisible();
        await snap(page, `${theme}-phone-picture.png`);
      });

      test('queue tab and drafts tab', async ({ page }) => {
        // Drafts take seeds of their own: a fixed sequence of random numbers gives them the same seeds, so the same pictures.
        await page.addInitScript(() => {
          let state = 1;
          Math.random = () => (state = (state * 16807) % 2147483647) / 2147483647;
        });
        await page.goto('/?scenario=empty');
        await expect(page.getByTestId('phone-generate')).toBeVisible({ timeout: 20_000 });
        await page.getByTestId('model-picker').tap();
        await page.getByTestId('model-picker-list').locator('.pp-picker__item').first().tap();
        await page.getByTestId('seed-fixed').tap();
        // One job that fails, with its error, and one that makes a picture.
        for (const prompt of ['[fail] a lighthouse', 'a lighthouse on a cliff at dusk']) {
          await page.getByTestId('positive-prompt').fill(prompt);
          await page.getByTestId('invoke-button').tap();
        }
        await page.getByTestId('phone-nav-queue').tap();
        await expect(page.locator('[data-testid="phone-queue-item"][data-status="failed"]')).toBeVisible();
        await expect(page.locator('[data-testid="phone-queue-item"][data-status="completed"] img')).toBeVisible();
        await snap(page, `${theme}-phone-queue.png`);
        await page.getByTestId('phone-nav-drafts').tap();
        await page.getByTestId('drafts-start').tap();
        await expect(page.getByTestId('draft-open')).toHaveCount(4);
        await expect(page.getByTestId('phone-queue-badge')).toHaveCount(0);
        await snap(page, `${theme}-phone-drafts.png`);
      });

      test('assistant chat', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('phone-generate')).toBeVisible({ timeout: 20_000 });
        // Signing in is the PC's: by widening the window, then narrowing it back.
        const phoneSize = page.viewportSize() ?? { width: 412, height: 915 };
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.getByTestId('agent-open').tap();
        await page.getByTestId('agent-choose-claude').tap();
        await expect(page.getByTestId('agent-input')).toBeVisible({ timeout: 10_000 });
        await page.getByTestId('agent-window').getByRole('button', { name: msg('agent.close') }).tap();
        await page.setViewportSize(phoneSize);
        await page.getByTestId('phone-chat-open').tap();
        const chat = page.getByTestId('phone-chat');
        await chat.getByRole('button', { name: msg('agent.suggestion.anime') }).tap();
        await expect(chat.locator('[data-testid="agent-msg-assistant"]:not(.agent-msg--thinking)')).toHaveCount(1, { timeout: 15_000 });
        await snap(page, `${theme}-phone-chat.png`);
      });
    });
  });
}
