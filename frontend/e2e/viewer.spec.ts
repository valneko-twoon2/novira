// Zooming and panning a still image in the viewer, with the canvas's gestures and shortcuts.
import type { Page } from '@playwright/test';
import { expect, msg, openApp, test } from './fixtures';

async function generate(page: Page, prompt: string): Promise<void> {
  await page.getByTestId('positive-prompt').fill(prompt);
  await expect(page.getByTestId('invoke-button')).toBeEnabled();
  await page.getByTestId('invoke-button').click();
}

const percentOf = (text: string | null) => Number((text ?? '').replace('%', ''));

test('the viewer zooms with the wheel, keys and buttons, and fits again on another image', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('seed-fixed').click();
  await generate(page, 'a lighthouse on a cliff at dusk');
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);
  await generate(page, 'a red fox in the snow');
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(2);

  const zoom = page.getByTestId('viewer-zoom');
  const surface = page.getByTestId('viewer-zoom-surface');
  const frame = surface.locator('.vzoom__frame');
  await expect(page.getByTestId('viewer-image')).toBeVisible();
  const fit = await zoom.textContent();
  expect(percentOf(fit)).toBeGreaterThan(0);

  // Wheel up over the image zooms in around the cursor.
  const box = (await surface.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -400);
  await expect(zoom).not.toHaveText(fit!);
  expect(percentOf(await zoom.textContent())).toBeGreaterThan(percentOf(fit));

  // Canvas shortcuts: Ctrl+0 fits, Ctrl+1 is 100%, + / - step (Ctrl with them zooms the whole app).
  await page.keyboard.press('Control+0');
  await expect(zoom).toHaveText(fit!);
  await page.keyboard.press('Control+1');
  await expect(zoom).toHaveText('100%');
  await page.keyboard.press('=');
  await expect(zoom).toHaveText('125%');
  await page.keyboard.press('-');
  await expect(zoom).toHaveText('100%');

  // Dragging pans the magnified image.
  const before = await frame.evaluate((el) => (el as HTMLElement).style.transform);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => frame.evaluate((el) => (el as HTMLElement).style.transform)).not.toBe(before);

  // The fit button and double-click toggle between fit and 100%.
  await page.getByRole('button', { name: `${msg('gallery.viewer.zoomFit')} (Ctrl+0)` }).click();
  await expect(zoom).toHaveText(fit!);
  await surface.dblclick({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(zoom).toHaveText('100%');

  // Moving to another image with the arrow keys shows it fitted again.
  const name = await page.getByTestId('viewer-info').locator('.viewer__name').textContent();
  await page.mouse.move(0, 0);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('viewer-info').locator('.viewer__name')).not.toHaveText(name!);
  await expect(zoom).toHaveText(fit!);
});

test('the metadata panel copies selected text with Ctrl+C and closes on a press outside', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openApp(page, '?scenario=empty');
  await generate(page, 'a lighthouse on a cliff at dusk');
  await expect(page.getByTestId('viewer-image')).toBeVisible();
  await page.getByTestId('toggle-metadata').click();
  const panel = page.getByTestId('viewer-metadata');
  await expect(panel).toBeVisible();

  // Select the prompt by dragging from inside the panel to outside it: the panel stays, Ctrl+C copies the text.
  const prompt = panel.getByText('a lighthouse on a cliff at dusk').first();
  const box = (await prompt.boundingBox())!;
  // A point outside the panel: the prompt box of the left panel.
  const outside = (await page.getByTestId('positive-prompt').boundingBox())!;
  const away = { x: outside.x + outside.width / 2, y: outside.y + outside.height / 2 };
  await page.mouse.move(box.x + 1, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(away.x, away.y, { steps: 5 });
  await page.mouse.up();
  await expect(panel).toBeVisible();
  const selected = await page.evaluate(() => window.getSelection()?.toString() ?? '');
  expect(selected.trim().length).toBeGreaterThan(0);
  await page.evaluate(() => navigator.clipboard.writeText('before'));
  await page.keyboard.press('Control+C');
  // The clipboard holds the selection (the browser's own text form spaces table-like rows its own way).
  const words = (text: string) => text.replace(/\s+/g, ' ').trim();
  await expect.poll(async () => words(await page.evaluate(() => navigator.clipboard.readText()))).toBe(words(selected));

  // A press outside the panel closes it.
  await page.mouse.click(away.x, away.y);
  await expect(panel).toBeHidden();
});
