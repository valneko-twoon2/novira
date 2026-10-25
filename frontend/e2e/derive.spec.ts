// Deriving pictures from a finished one in one click: same settings with new seeds, from the viewer toolbar.
import { expect, msg, openApp, test } from './fixtures';

test('a picture is derived into more pictures from the viewer, with its own settings', async ({ page }) => {
  // The mock makes the four pictures one after another; a slow CI machine needs more than the default 30 s.
  test.setTimeout(60_000);
  await openApp(page, '?scenario=empty');
  await page.getByTestId('seed-fixed').click();
  await page.getByTestId('positive-prompt').fill('a lighthouse on a cliff at dusk');
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);

  // The form is changed afterwards: the derived pictures use the stored settings, not the form.
  await page.getByTestId('positive-prompt').fill('something else entirely');
  await page.getByTestId('gallery-thumb').first().click();
  await page.getByTestId('viewer-derive').click();
  await page.getByRole('menuitem', { name: msg('gallery.derive.variation', { count: 4 }) }).click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(5, { timeout: 30_000 });
  await expect(page.getByTestId('positive-prompt')).toHaveValue('something else entirely');
});

test('a picture is redone from itself with a strength chosen on a slider', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('positive-prompt').fill('a lighthouse on a cliff at dusk');
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);

  await page.getByTestId('gallery-thumb').first().click();
  await page.getByTestId('viewer-derive').click();
  await page.getByRole('menuitem', { name: msg('gallery.derive.custom') }).click();
  await expect(page.getByTestId('derive-dialog')).toBeVisible();
  await page.getByTestId('derive-create').click();
  await expect(page.getByTestId('derive-dialog')).toBeHidden();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(2, { timeout: 30_000 });
});
