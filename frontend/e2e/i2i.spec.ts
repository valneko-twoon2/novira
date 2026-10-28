// Image to image on the Generate tab: a gallery picture put in its section is drawn over, at the trained size nearest
// its shape (and enlarged by the high-resolution fix when it is on), and the reference image settings send a picture there too.
import { expect, msg, openApp, test } from './fixtures';

test('a gallery picture dropped on the image to image section is drawn over at a size of its shape', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: msg('params.i2i.title'), exact: true }).click();
  // The strength can be set before a picture is put in.
  const slider = page.getByRole('slider', { name: msg('params.image.strength') });
  await expect(slider).toBeEnabled();
  await slider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(slider).toHaveAttribute('aria-valuenow', '0.69');
  const before = await page.getByTestId('gallery-thumb').count();
  await page.getByTestId('gallery-thumb').first().dragTo(page.locator('[data-testid="i2i-section"] .pp-upimg'));
  await expect(page.getByTestId('i2i-image')).toBeVisible();
  // The size follows the picture's shape, as one of the sizes the model was trained on.
  const width = Number(await page.getByRole('spinbutton', { name: msg('common.width') }).inputValue());
  const height = Number(await page.getByRole('spinbutton', { name: msg('common.height') }).inputValue());
  expect([1024, 1152, 1216, 1344, 1536, 896, 832, 768, 640]).toContain(width);
  expect([1024, 1152, 1216, 1344, 1536, 896, 832, 768, 640]).toContain(height);

  await page.getByTestId('positive-prompt').fill('the same scene at night');
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(before + 1);
  await expect(page.getByTestId('viewer-info')).toContainText(`${width}`);

  await page.getByTestId('i2i-clear').click();
  await expect(page.getByTestId('i2i-image')).toHaveCount(0);
});

test('the high-resolution fix enlarges the picture drawn over a source', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: msg('params.hires.title') }).click();
  await page.getByRole('switch', { name: msg('params.hires.enable') }).click();
  await page.getByRole('button', { name: msg('params.i2i.title'), exact: true }).click();
  const before = await page.getByTestId('gallery-thumb').count();
  await page.getByTestId('gallery-thumb').first().dragTo(page.locator('[data-testid="i2i-section"] .pp-upimg'));
  await expect(page.getByTestId('i2i-image')).toBeVisible();
  const width = Number(await page.getByRole('spinbutton', { name: msg('common.width') }).inputValue());
  const height = Number(await page.getByRole('spinbutton', { name: msg('common.height') }).inputValue());
  const enlarged = (v: number) => Math.round((v * 1.5) / 8) * 8;
  await expect(page.getByTestId('hires-output')).toContainText(`${enlarged(width)}×${enlarged(height)}`);

  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(before + 1);
  await expect(page.getByTestId('viewer-info')).toContainText(`${enlarged(width)}`);
});

test('the reference image settings put the picture in the image to image section', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('gallery-thumb').first().dragTo(page.locator('.pp-refs:visible'));
  await page.getByTestId('ref-image').click();
  await page.getByTestId('ref-to-i2i').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('i2i-image')).toBeVisible();
});
