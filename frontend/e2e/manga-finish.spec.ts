// The manga finish is a step of the image viewer, not of drawing: the dialog tries the values on the open picture and saves the
// page as a new picture next to it. Opening and using it must not scroll the page itself (the old checkbox left the lower
// half of the window blank).
import type { Page } from '@playwright/test';
import { expect, openApp, test } from './fixtures';

const scrollTop = (page: Page) => page.evaluate(() => document.scrollingElement!.scrollTop);

test('a picture is finished as a manga page from the viewer and saved as a new picture', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('positive-prompt').fill('a girl with brown hair');
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);

  await page.getByTestId('viewer-manga').click();
  await expect(page.getByTestId('manga-dialog')).toBeVisible();
  // The pack is not installed in the mock: the dialog says so, offers the install, and nothing can run yet.
  await expect(page.getByTestId('manga-pack-needs')).toBeVisible();
  await expect(page.getByTestId('manga-save')).toBeDisabled();
  await page.getByTestId('manga-pack-install').click();
  await page.getByTestId('manga-pack-restart').click();
  await expect(page.getByTestId('manga-pack-needs')).toBeHidden({ timeout: 30_000 });

  await page.getByTestId('manga-try-run').click();
  await expect(page.getByTestId('manga-try-result')).toBeVisible({ timeout: 30_000 });
  // A try is hidden: the gallery still holds only the original.
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);

  await page.getByTestId('manga-save').click();
  await expect(page.getByTestId('manga-done')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(2);
  expect(await scrollTop(page)).toBe(0);

  await page.getByTestId('manga-open').click();
  await expect(page.getByTestId('manga-dialog')).toBeHidden();
  expect(await scrollTop(page)).toBe(0);
});
