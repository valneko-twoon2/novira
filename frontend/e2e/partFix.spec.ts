// "Select and fix a part" on the mock backend: the picture opens on the canvas with an empty inpaint mask and the
// brush, the painted part is cut out into the gallery and erased into staging.
import { expect, msg, openApp, test } from './fixtures';

test('a part painted on the canvas is cut out into the gallery and erased into staging', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('gallery-thumb').first().click();
  await page.getByRole('tab', { name: msg('app.views.viewer'), exact: true }).click();
  await page.getByTestId('viewer-segment').click();

  await expect(page.getByTestId('canvas-stage')).toBeVisible();
  await expect(page.getByTestId('canvas-entity')).toHaveCount(2);
  await expect(page.getByTestId('canvas-tool-brush')).toHaveAttribute('aria-pressed', 'true');

  // Nothing painted yet: the mask says so and sends nothing.
  await page.getByTestId('canvas-mask-erase').click();
  await expect(page.getByText(msg('canvas.partFix.empty'))).toBeVisible();

  const box = (await page.getByTestId('canvas-stage').boundingBox())!;
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(cx - 40, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 40, cy + 10, { steps: 8 });
  await page.mouse.up();

  // A cut-out is an uploaded picture, so it lands among the assets.
  await page.getByTestId('gallery-view-assets').click();
  const before = await page.getByTestId('gallery-thumb').count();
  await page.getByTestId('canvas-mask-cutout').click();
  await expect(page.getByText(msg('canvas.partFix.cutOut'))).toBeVisible();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(before + 1);

  await page.getByTestId('canvas-mask-erase').click();
  await expect(page.getByTestId('canvas-staging-accept')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('canvas-staging-accept').click();
  await expect(page.getByTestId('canvas-entity')).toHaveCount(3);
});
