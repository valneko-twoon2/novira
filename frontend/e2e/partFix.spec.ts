// "Select and fix a part" on the mock backend: the picture opens on the canvas with an empty inpaint mask and the
// brush, the painted part is cut out into the gallery, erased into staging or redrawn from an instruction.
import type { Page } from '@playwright/test';
import { expect, msg, openApp, test } from './fixtures';

async function openPartFix(page: Page) {
  await openApp(page);
  await page.getByTestId('gallery-thumb').first().click();
  await page.getByRole('tab', { name: msg('app.views.viewer'), exact: true }).click();
  await page.getByTestId('viewer-segment').click();
  await expect(page.getByTestId('canvas-stage')).toBeVisible();
}

async function paint(page: Page) {
  const box = (await page.getByTestId('canvas-stage').boundingBox())!;
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(cx - 40, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 40, cy + 10, { steps: 8 });
  await page.mouse.up();
}

test('a part painted on the canvas is cut out into the gallery and erased into staging', async ({ page }) => {
  await openPartFix(page);
  await expect(page.getByTestId('canvas-entity')).toHaveCount(2);
  await expect(page.getByTestId('canvas-tool-brush')).toHaveAttribute('aria-pressed', 'true');

  // Nothing painted yet: the mask says so and sends nothing.
  await page.getByTestId('canvas-mask-erase').click();
  await expect(page.getByText(msg('canvas.partFix.empty'))).toBeVisible();

  await paint(page);

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

test('a finished result stays on its page while the next ones are made, and the progress shows on the last page', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('novira.settings', JSON.stringify({ state: { mockStepDelay: 120 }, version: 0 })));
  await openPartFix(page);
  await paint(page);
  const iterations = page.getByLabel(msg('params.invoke.iterations'), { exact: true }).locator('visible=true').first();
  await iterations.fill('3');
  await iterations.press('Tab');
  await page.getByTestId('canvas-mask-redraw').click();

  // The first result is in; the view stays on the generating page, where nothing can be accepted yet.
  const count = page.getByTestId('canvas-staging-count');
  await expect(count).toHaveText('2/2', { timeout: 20_000 });
  await expect(page.getByTestId('canvas-staging-accept')).toBeDisabled();
  await page.getByTestId('canvas-staging-next').click();
  await expect(count).toHaveText('1/2');
  await expect(page.getByTestId('canvas-staging-accept')).toBeEnabled();
  // The others arrive without moving the view off the first result.
  await expect(count).toHaveText('1/3', { timeout: 30_000 });
  await expect(page.getByTestId('canvas-staging-accept')).toBeEnabled();
});

test('a painted part is redrawn from a written instruction into staging', async ({ page }) => {
  await openPartFix(page);
  await paint(page);
  await page.getByTestId('canvas-mask-instruction').fill('a blue ribbon');
  await page.getByTestId('canvas-mask-redraw').click();
  await expect(page.getByText(msg('canvas.partFix.redrawing'))).toBeVisible();
  await expect(page.getByTestId('canvas-staging-accept')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('canvas-staging-accept').click();
  await expect(page.getByTestId('canvas-entity')).toHaveCount(3);
});
