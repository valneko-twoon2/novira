// Removing the background of a gallery picture from the viewer: run it, find the result next to the original and open it.
import { expect, openApp, test } from './fixtures';

test('the background of a picture is removed from the viewer, and the result opens next to the original', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('seed-fixed').click();
  await page.getByTestId('positive-prompt').fill('a lighthouse on a cliff at dusk');
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);

  await page.getByTestId('viewer-cutout').click();
  await expect(page.getByTestId('cutout-stage')).toBeVisible();
  await expect(page.getByTestId('cutout-run')).toBeEnabled();

  await page.getByTestId('cutout-run').click();
  await expect(page.getByTestId('cutout-done')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(2);

  await page.getByTestId('cutout-open').click();
  await expect(page.getByTestId('cutout-stage')).toBeHidden();
  await expect(page.getByTestId('viewer-compare')).toBeVisible();
});
