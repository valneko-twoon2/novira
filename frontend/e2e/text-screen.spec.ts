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

test('a laid-out scene is saved as a template and put back on an emptied sheet', async ({ page }) => {
  await openText(page);
  await page.getByTestId('text-add-text').click();
  await page.getByTestId('text-content').fill('TITLE');
  await page.getByTestId('text-add-bubble').click();
  await page.getByRole('menuitem', { name: msg('text.shape.round') }).click();
  await expect(page.getByTestId('text-layers').locator('li')).toHaveCount(2);

  // Saved from the card at the top of the left column, under its own name.
  const card = page.getByTestId('text-templates');
  await expect(card).toContainText(msg('text.template'));
  await card.getByTestId('preset-quick-save').click();
  await page.getByTestId('name-dialog-input').fill('Title card');
  await page.getByTestId('name-dialog-ok').click();
  await expect(card).toContainText('Title card');

  // Emptied and put back: both layers return, with the words they had.
  await page.getByTestId('text-layers').getByText(msg('text.layers.clear')).click();
  await expect(page.getByTestId('text-layers').locator('li')).toHaveCount(0);
  await card.getByTestId('preset-trigger').click();
  await page.getByTestId('preset-list').getByText('Title card').click();
  await expect(page.getByTestId('text-layers').locator('li')).toHaveCount(2);
  await expect(page.getByTestId('text-layers')).toContainText('TITLE');

  // One undo takes the template back off.
  await page.getByTestId('text-canvas').getByRole('button', { name: msg('text.undo') }).click();
  await expect(page.getByTestId('text-layers').locator('li')).toHaveCount(0);
});

test('a picture saved from the Text tab opens its layers again from the gallery', async ({ page }) => {
  await openText(page);
  await page.getByTestId('text-add-text').click();
  await page.getByTestId('text-content').fill('SAVED WORDS');
  await page.getByTestId('text-save').click();
  await expect(page.getByText(msg('text.saved'))).toBeVisible();

  // The name the picture was saved under is the one the layers are kept for.
  const saved = await page.evaluate(() => {
    const sources: { imageName: string }[] = JSON.parse(localStorage.getItem('novira.textSources') ?? '{}').state?.sources ?? [];
    return sources.at(-1)?.imageName ?? '';
  });
  expect(saved).not.toBe('');

  await page.getByTestId('text-layers').getByText(msg('text.layers.clear')).click();
  await expect(page.getByTestId('text-layers').locator('li')).toHaveCount(0);
  // A picture saved from the Text tab is an asset (category user), so it is in the assets view.
  await page.getByTestId('gallery-view-assets').click();
  await page.locator(`[data-testid="gallery-thumb"][data-image-name="${saved}"]`).click({ button: 'right' });
  await page.getByRole('menuitem', { name: msg('gallery.menu.editInText') }).click();
  await expect(page.getByTestId('text-layers')).toContainText('SAVED WORDS');

  // A picture that did not come from the Text tab has no such item.
  await page.getByTestId('gallery-view-images').click();
  await page.locator(`[data-testid="gallery-thumb"]:not([data-image-name="${saved}"])`).first().click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: msg('gallery.menu.sendToText') })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: msg('gallery.menu.editInText') })).toHaveCount(0);
});
