// Image generation through the queue on the mock backend: success, determinism and failure.
// Every test starts from `?scenario=empty`, so the gallery count is exact (no seeded images, no virtualised rows).
import type { Page } from '@playwright/test';
import { expect, msg, openApp, test } from './fixtures';

async function generate(page: Page, prompt: string): Promise<void> {
  await page.getByTestId('positive-prompt').fill(prompt);
  await expect(page.getByTestId('invoke-button')).toBeEnabled();
  await page.getByTestId('invoke-button').click();
}

/** SHA-256 of the image behind a thumbnail, read inside the page (the mock serves blob: URLs). */
async function thumbnailHash(page: Page, index: number): Promise<string> {
  const src = await page.getByTestId('gallery-thumb').nth(index).locator('img').getAttribute('src');
  expect(src).toBeTruthy();
  return page.evaluate(async (url) => {
    const bytes = await (await fetch(url)).arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }, src!);
}

test('empty scenario starts with an empty gallery', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  const grid = page.getByTestId('gallery-grid');
  await expect(grid).toBeVisible();
  await expect(grid.locator('.ui-empty__title')).toHaveText(msg('gallery.empty.noImages'));
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(0);
});

test('invoking adds the image to the gallery, the viewer and the queue', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await generate(page, 'a lighthouse on a cliff at dusk');

  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);
  await expect(page.getByTestId('gallery-grid').locator('.ui-empty')).toHaveCount(0);
  // Auto-switch selects the new image and opens it in the viewer.
  await expect(page.getByTestId('gallery-thumb').first()).toHaveClass(/is-selected/);
  await expect(page.getByTestId('view-viewer')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('image-viewer')).toBeVisible();
  await expect(page.getByTestId('viewer-info')).toContainText('1024');

  await page.getByTestId('tab-queue').click();
  const item = page.getByTestId('queue-item');
  await expect(item).toHaveCount(1);
  await expect(item).toHaveAttribute('data-status', 'completed');
  await expect(item).toContainText('a lighthouse on a cliff at dusk');
  await expect(page.getByTestId('queue-stats').locator('[data-status="completed"] .qt-stat__value')).toHaveText('1');
});

test('the same seed and prompt give the same image; another prompt gives a different one', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('seed-fixed').click();
  await expect(page.getByTestId('seed-fixed')).toHaveAttribute('aria-pressed', 'true');

  await generate(page, 'a red fox in the snow');
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);
  await generate(page, 'a red fox in the snow');
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(2);
  await generate(page, 'a blue whale in the deep sea');
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(3);

  // Newest first: [whale, fox, fox].
  const [whale, fox2, fox1] = [await thumbnailHash(page, 0), await thumbnailHash(page, 1), await thumbnailHash(page, 2)];
  expect(fox2).toBe(fox1);
  expect(whale).not.toBe(fox1);
});

test('a picture being drawn is a cell of the gallery and opens large in the viewer', async ({ page }) => {
  // Slow steps, so the job is still running when the cell is pressed.
  await page.addInitScript(() => localStorage.setItem('novira.settings', JSON.stringify({ state: { mockStepDelay: 500 }, version: 0 })));
  await openApp(page, '?scenario=empty');
  await generate(page, 'a lighthouse on a cliff at dusk');

  const cell = page.getByTestId('gallery-live-thumb');
  await expect(cell).toBeVisible();
  await cell.click();
  await expect(page.getByTestId('viewer-live')).toBeVisible();

  // When the job ends the cell goes, and the finished picture takes the viewer.
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);
  await expect(cell).toHaveCount(0);
  await expect(page.getByTestId('viewer-live')).toHaveCount(0);
  await expect(page.getByTestId('viewer-zoom-surface')).toBeVisible();
});

test('a prompt containing [fail] fails in the queue and adds nothing to the gallery', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await generate(page, 'a broken render [fail]');

  await page.getByTestId('tab-queue').click();
  const item = page.getByTestId('queue-item');
  await expect(item).toHaveCount(1);
  await expect(item).toHaveAttribute('data-status', 'failed');
  await expect(page.getByTestId('queue-stats').locator('[data-status="failed"] .qt-stat__value')).toHaveText('1');
  // A failed item offers a retry.
  await expect(item.getByRole('button', { name: msg('queue.action.retry') })).toBeVisible();

  await page.getByTestId('tab-generate').click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(0);
});

test('a prompt containing [oom] runs out of memory and offers a smaller retry and low-memory mode', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await generate(page, 'a huge poster [oom]');

  // The gallery keeps the failure with what to do about it.
  const notice = page.getByTestId('gallery-generating').getByTestId('oom-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(msg('queue.oom.title'));
  await expect(notice.getByTestId('oom-low-memory')).toBeVisible();
  await notice.getByTestId('oom-retry-smaller').click();

  // The retry runs at about 75% of the area (1024x1024 -> 888x888) with the same prompt, and fails again in the mock.
  await page.getByTestId('tab-queue').click();
  const items = page.getByTestId('queue-item');
  await expect(items).toHaveCount(2);
  await expect(items.nth(1)).toContainText('888×888');
  await expect(items.nth(1)).toHaveAttribute('data-status', 'failed');

  // Low-memory mode from the queue's notice: the switch in Settings follows.
  await items.nth(1).getByTestId('oom-low-memory').click();
  await expect(page.getByTestId('oom-low-memory')).toHaveCount(0);
  await page.getByRole('button', { name: msg('app.nav.settingsMenu') }).click();
  await page.getByRole('menuitem', { name: msg('app.nav.settings') }).click();
  // The switch is on the Generation tab of the settings.
  await page.getByTestId('settings-tab-generation').click();
  await expect(page.getByRole('switch', { name: msg('settings.lowMemory.label') })).toHaveAttribute('aria-checked', 'true');
});
