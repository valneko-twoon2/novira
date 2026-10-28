// Trimming the transparent margin of a cut-out picture from the gallery's context menu.
import { expect, msg, openApp, test } from './fixtures';

/** A 200 x 100 transparent PNG with one opaque 60 x 40 rectangle at (30, 20). */
async function transparentPicture(page: import('@playwright/test').Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 200;
    c.height = 100;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#cc3366';
    ctx.fillRect(30, 20, 60, 40);
    return c.toDataURL('image/png');
  });
  return Buffer.from(dataUrl.split(',')[1]!, 'base64');
}

test('the transparent margin of a picture is trimmed and saved as a new picture', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('gallery-panel').locator('input[type="file"]').setInputFiles({ name: 'cutout.png', mimeType: 'image/png', buffer: await transparentPicture(page) });
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);

  await page.getByTestId('gallery-thumb').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: msg('gallery.menu.trim') }).click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(2, { timeout: 15_000 });
  await expect(page.getByText(msg('gallery.trim.saved', { width: 60, height: 40 }))).toBeVisible();
});

test('a picture without a transparent margin is left alone and says so', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('positive-prompt').fill('a lighthouse on a cliff at dusk');
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);

  await page.getByTestId('gallery-thumb').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: msg('gallery.menu.trim') }).click();
  await expect(page.getByText(msg('gallery.trim.nothing'))).toBeVisible();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);
});
