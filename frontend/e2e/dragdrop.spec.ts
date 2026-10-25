// Dragging pictures onto image targets: gallery to reference images and the upscale input, a canvas layer to a
// reference image (saved to the gallery on drop).
import { expect, openApp, test } from './fixtures';

test('a gallery picture dropped on the reference row adds a reference image with a model', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('ref-image')).toHaveCount(0);
  await page.getByTestId('gallery-thumb').first().dragTo(page.locator('.pp-refs:visible'));
  await expect(page.getByTestId('ref-image')).toHaveCount(1);
  await expect(page.getByTestId('ref-image').locator('img')).toBeVisible();
  // The mock has an SDXL IP-Adapter for the SDXL main model, so the card has no warning.
  await expect(page.locator('.pp-ref__warn')).toHaveCount(0);
});

test('a gallery picture dropped on the upscale input becomes the picture to enlarge', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('tab-upscaling').click();
  await page.getByTestId('gallery-thumb').first().dragTo(page.locator('.pp-upimg'));
  await expect(page.getByTestId('upscale-initial-image')).toBeVisible();
});

test('a canvas layer dragged onto the reference row is added as another reference image', async ({ page }) => {
  await openApp(page);
  const before = await page.getByTestId('gallery-thumb').count();
  await page.getByTestId('gallery-thumb').first().dragTo(page.locator('.pp-refs:visible'));
  await page.getByTestId('ref-image').click();
  await page.getByTestId('ref-to-canvas').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('canvas-entity')).toHaveCount(1);
  // An untouched layer that is one gallery picture is reused, so the gallery does not grow.
  await page.getByTestId('canvas-entity').first().locator('.canvas-entity__row').dragTo(page.locator('.pp-refs:visible'));
  await expect(page.getByTestId('ref-image')).toHaveCount(2);
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(before);
});

test('the reference settings explain a missing model and offer image to image on the canvas', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('gallery-thumb').first().dragTo(page.locator('.pp-refs:visible'));
  await page.getByTestId('ref-image').click();
  await expect(page.getByTestId('ref-no-models')).toHaveCount(0);
  await page.getByTestId('ref-to-canvas').click();
  await expect(page.getByTestId('tab-canvas')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('canvas-entity')).toHaveCount(1);
});
