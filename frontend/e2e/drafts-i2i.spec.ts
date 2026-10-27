// Drafts from image to image: with a picture in the i2i section the drafts draw over it, and a finished one too.
import { expect, msg, openApp, test } from './fixtures';

test('drafts start from the image to image source and a chosen one is finished over it', async ({ page }) => {
  test.slow();
  await openApp(page);
  await page.getByRole('button', { name: msg('params.i2i.title'), exact: true }).click();
  await page.getByTestId('gallery-thumb').first().dragTo(page.locator('[data-testid="i2i-section"] .pp-upimg'));
  await expect(page.getByTestId('i2i-image')).toBeVisible();
  await page.getByTestId('positive-prompt').fill('the same scene at night');
  const before = await page.getByTestId('gallery-thumb').count();

  await page.getByTestId('view-drafts').click();
  await page.getByTestId('drafts-start').click();
  const cells = page.getByTestId('draft-cell');
  await expect(cells).toHaveCount(4);
  await expect(cells.locator('img')).toHaveCount(4, { timeout: 90_000 });
  await expect(page.getByText(msg('drafts.failed'))).toHaveCount(0);

  const first = cells.first();
  await first.getByRole('button', { name: /^seed / }).click();
  await page.getByTestId('drafts-finish').click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(before + 1, { timeout: 90_000 });
  await page.getByTestId('view-drafts').click();
  await expect(first).toContainText(msg('drafts.badge.finished'));
});
