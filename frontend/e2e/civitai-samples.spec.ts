// Two things taken from Civitai: the settings of a model's example pictures (put into the Generate form from the Browse
// detail) and the notice that an installed model has a newer version (a tag on the card, a row in the detail).
import { expect, msg, openApp, showTab, test } from './fixtures';

test('the detail lists the example settings and one button puts them into the Generate form', async ({ page }) => {
  await openApp(page);
  await showTab(page, 'browse');
  await page.getByTestId('browse-card').first().click();
  const samples = page.getByTestId('browse-samples');
  await expect(samples).toBeVisible();
  await expect(page.getByTestId('browse-sample')).toHaveCount(3);

  // The first example: its settings are shown, its LoRA is not installed.
  const first = page.getByTestId('browse-sample').first();
  await expect(first).toContainText('DPM++ 2M Karras');
  await expect(first).toContainText('832×1216');
  await expect(first.getByTitle(msg('browse.samples.notInstalled'))).toHaveCount(1);

  await first.getByTestId('browse-sample-use').click();
  await expect(page.getByTestId('tab-generate')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('positive-prompt')).toHaveValue(/a cozy cafe by the window/);
  await expect(page.getByTestId('negative-prompt')).toHaveValue('blurry, lowres, watermark');
  // The notice names what could not be applied.
  await expect(page.getByText(msg('browse.samples.applied'))).toBeVisible();
});

test('a model with a newer version shows a tag on its card and a row in its detail', async ({ page }) => {
  await openApp(page, '?updates');
  await showTab(page, 'models');
  // Asked for when the screen opens; the notice comes once.
  await expect(page.getByText(msg('models.updates.found', { count: 1 }))).toBeVisible();
  const card = page.locator('.mm-card-item', { hasText: 'Juggernaut XL v9' }).first();
  await expect(card.getByTestId('mm-update-tag')).toBeVisible();
  await expect(page.locator('.mm-card-item', { hasText: 'Dreamshaper 8' }).getByTestId('mm-update-tag')).toHaveCount(0);

  await card.click();
  const row = page.getByTestId('mm-update');
  await expect(row).toBeVisible();
  await expect(row).toContainText('v10');
  await row.getByTestId('mm-update-open').click();
  await expect(page.getByText(msg('browse.toast.openMock'))).toBeVisible();

  // The toolbar asks again; nothing new, so no second notice.
  await page.getByTestId('mm-check-updates').click();
  await expect(page.getByTestId('mm-check-updates')).toBeEnabled();
  await expect(page.getByText(msg('models.updates.found', { count: 1 }))).toHaveCount(0);
});

test('without an update there is no tag and no row', async ({ page }) => {
  await openApp(page);
  await showTab(page, 'models');
  await expect(page.locator('.mm-card-item').first()).toBeVisible();
  await expect(page.getByTestId('mm-update-tag')).toHaveCount(0);
  await page.locator('.mm-card-item', { hasText: 'Juggernaut XL v9' }).first().click();
  await expect(page.getByTestId('mm-model-view')).toBeVisible();
  await expect(page.getByTestId('mm-update')).toHaveCount(0);
});
