// Fixing the faces of a picture from the viewer: the result is saved next to the original and can be compared with it.
import { expect, msg, openApp, test } from './fixtures';

test('the faces of a picture are redrawn from the viewer and the result is saved next to it', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('seed-fixed').click();
  await page.getByTestId('positive-prompt').fill('a girl with brown hair standing in a field');
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);

  await page.getByTestId('viewer-facefix').click();
  await expect(page.getByTestId('facefix-dialog')).toBeVisible();
  // The picture's own prompt is the starting point.
  await expect(page.getByTestId('facefix-prompt')).toHaveValue('a girl with brown hair standing in a field');
  await page.getByTestId('facefix-run').click();
  await expect(page.getByTestId('facefix-done')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(2);

  await page.getByTestId('facefix-open').click();
  await expect(page.getByTestId('facefix-dialog')).toBeHidden();
  await expect(page.getByTestId('viewer-compare')).toBeVisible();
});

test('the context menu of a picture offers to fix its face', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('positive-prompt').fill('a girl');
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);
  await page.getByTestId('gallery-thumb').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: msg('facefix.menu') }).click();
  await expect(page.getByTestId('facefix-dialog')).toBeVisible();
});
