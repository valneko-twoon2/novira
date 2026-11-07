// The Text screen laid out like the other screens: layers are added from the canvas toolbar and listed in the right column
// under the gallery, the run button is the first thing in the left column, and the candidates sit under the canvas.
import { expect, msg, openApp, test } from './fixtures';

async function openText(page: Parameters<typeof openApp>[0]) {
  await openApp(page);
  await page.getByTestId('tab-generate').click();
  await page.getByTestId('media-text').click();
  await expect(page.getByTestId('text-panel')).toBeVisible();
}

test('layers are added in the canvas toolbar and listed in the right column', async ({ page }) => {
  await openText(page);
  const canvas = page.getByTestId('text-canvas');
  const layers = page.getByTestId('text-layers');
  await expect(layers).toBeVisible();
  // The stack is not in the left column any more.
  await expect(page.getByTestId('text-panel').getByTestId('text-layers')).toHaveCount(0);

  await canvas.getByTestId('text-add-text').click();
  await canvas.getByTestId('text-add-bubble').click();
  await page.getByRole('menuitem', { name: msg('text.shape.cloud') }).click();
  await expect(layers.locator('li')).toHaveCount(2);

  // A press on the bubble's row (the newest is on top) selects it: the left column shows its settings and the AI run waits for a text layer.
  await layers.locator('li').first().getByRole('button').first().click();
  await expect(page.getByTestId('text-props')).toBeVisible();
  await expect(page.getByTestId('text-rich-run')).toBeDisabled();
  await expect(page.getByText(msg('text.rich.select'))).toBeVisible();

  await layers.getByText(msg('text.layers.clear')).click();
  await expect(layers.locator('li')).toHaveCount(0);
});

test('the run button comes first in the left column and the candidates appear under the canvas', async ({ page }) => {
  await openText(page);
  await page.getByTestId('text-add-text').click();
  const run = page.getByTestId('text-rich-run');
  const panel = page.getByTestId('text-panel');
  // Above the layer's own settings: no scrolling to reach it.
  const runBox = await run.boundingBox();
  const propsBox = await panel.getByTestId('text-props').boundingBox();
  expect(runBox!.y).toBeLessThan(propsBox!.y);

  await expect(page.getByTestId('text-candidates')).toHaveCount(0);
  await run.click();
  const strip = page.getByTestId('text-candidates');
  await expect(strip).toBeVisible({ timeout: 30_000 });
  const stripBox = await strip.boundingBox();
  const canvasBox = await page.getByTestId('text-overlay').boundingBox();
  expect(stripBox!.y).toBeGreaterThan(canvasBox!.y + canvasBox!.height - 1);
  await expect(page.getByTestId('text-rich-candidate')).toHaveCount(2);

  // The strip belongs to the selected layer: clearing the selection hides it.
  await page.getByTestId('text-layers').getByText(msg('text.layers.clear')).click();
  await expect(strip).toHaveCount(0);
});

test('the quick bar sits over the selected layer, edits it, and steps aside while the layer is dragged', async ({ page }) => {
  await openText(page);
  await page.getByTestId('text-add-text').click();
  const bar = page.getByTestId('text-bar');
  await expect(bar).toBeVisible();

  // Over the layer: the bar's bottom edge is above the letters' center, which is the center of the sheet.
  const sheet = await page.getByTestId('text-overlay').boundingBox();
  const barBox = await bar.boundingBox();
  expect(barBox!.y + barBox!.height).toBeLessThan(sheet!.y + sheet!.height / 2);

  // A size typed in the bar is the size in the layer's own settings.
  const quick = bar.getByRole('spinbutton', { name: msg('text.size') });
  await quick.fill('200');
  await quick.blur();
  await expect(page.getByTestId('text-props').getByRole('spinbutton', { name: msg('text.size') })).toHaveValue('200');

  // Dragging hides the bar until the pointer is released.
  const x = sheet!.x + sheet!.width / 2;
  const y = sheet!.y + sheet!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 30, { steps: 4 });
  await expect(bar).toHaveCount(0);
  await page.mouse.up();
  await expect(bar).toBeVisible();

  // Duplicate and delete are in the bar too.
  await bar.getByRole('button', { name: msg('text.layer.duplicate') }).click();
  await expect(page.getByTestId('text-layers').locator('li')).toHaveCount(2);
  await page.getByTestId('text-bar').getByRole('button', { name: msg('text.layer.delete') }).click();
  await expect(page.getByTestId('text-layers').locator('li')).toHaveCount(1);
});
