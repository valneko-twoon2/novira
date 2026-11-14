// The phone's canvas editor (the `phone` projects, against the mock backend): a picture opens from its menu on the
// canvas, a mosaic is painted on it, a part is painted and erased, then redrawn from an instruction, each result is taken
// or discarded at the foot, and the edited picture is saved to the gallery. Two fingers zoom the view without painting.
import type { Page } from '@playwright/test';
import { expect, msg, test } from './fixtures';

/** Opens the first picture of the board on the canvas; returns how many pictures the board has. */
async function openEditor(page: Page): Promise<number> {
  await page.goto('/');
  await expect(page.getByTestId('phone-shell')).toBeVisible({ timeout: 20_000 });
  // A redraw is a generation: it needs a model, chosen on the Generate tab.
  await page.getByTestId('model-picker').tap();
  await page.getByTestId('model-picker-list').locator('.pp-picker__item').first().tap();
  await page.getByTestId('phone-nav-images').tap();
  await page.getByTestId('phone-thumb').first().tap();
  const count = await boardCount(page);
  await page.getByTestId('phone-view-menu').tap();
  await page.getByRole('menuitem', { name: msg('canvas.phone.edit') }).tap();
  await expect(page.getByTestId('phone-canvas')).toBeVisible();
  await expect(page.getByTestId('phone-view')).toHaveCount(0);
  return count;
}

/** The number of pictures in the board, from the place of the picture shown full screen. */
async function boardCount(page: Page): Promise<number> {
  const place = (await page.getByTestId('phone-view-place').textContent()) ?? '';
  return Number(place.split('/')[1]?.trim());
}

/** Closes every notice (the phone shows the newest; the older wait under it). */
async function closeNotices(page: Page): Promise<void> {
  const close = page.locator('.toast:visible .toast__close');
  while ((await close.count()) > 0) await close.first().tap();
}

/** A stroke across the middle of the stage. */
async function paint(page: Page, dy = 0): Promise<void> {
  const box = (await page.getByTestId('canvas-stage').boundingBox())!;
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2 + dy];
  await page.mouse.move(cx - 50, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 50, cy + 10, { steps: 8 });
  await page.mouse.up();
}

test('paints a mosaic, erases and redraws a painted part, takes the results and saves the picture', { tag: ['@scenario'] }, async ({ page }) => {
  const before = await openEditor(page);
  expect(before).toBeGreaterThan(0);
  // The mosaic is in hand first, with its width and block size.
  await expect(page.getByTestId('phone-canvas-tool-mosaic')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('slider', { name: msg('canvas.toolbar.mosaicBlock') })).toBeVisible();
  await expect(page.getByTestId('phone-canvas-undo')).toBeDisabled();
  await paint(page, -60);
  await expect(page.getByTestId('phone-canvas-undo')).toBeEnabled();

  // The part to change is painted with the mask's brush; nothing painted yet says so.
  await page.getByTestId('phone-canvas-tool-mask').tap();
  await expect(page.getByTestId('phone-canvas-tool-mask')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('phone-canvas-erase').tap();
  await expect(page.getByText(msg('canvas.partFix.empty'))).toBeVisible();
  await paint(page, 40);

  // Erase: the result waits at the foot, in place of the tools, until it is taken.
  await page.getByTestId('phone-canvas-erase').tap();
  await expect(page.getByTestId('phone-canvas-staging')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('phone-canvas-save')).toBeDisabled();
  await expect(page.getByTestId('phone-canvas-tool-mask')).toHaveCount(0);
  await page.getByTestId('phone-canvas-accept').tap();
  await expect(page.getByTestId('phone-canvas-staging')).toHaveCount(0);
  // The painted part is done: the mask is wiped, so nothing is left to erase.
  await expect(page.getByTestId('phone-canvas-tool-mask')).toHaveAttribute('aria-pressed', 'true');
  await closeNotices(page);
  await page.getByTestId('phone-canvas-erase').tap();
  await expect(page.getByText(msg('canvas.partFix.empty'))).toBeVisible();

  // Redraw from an instruction: discarded once, then taken.
  await paint(page, 40);
  await page.getByTestId('phone-canvas-instruction').fill('a blue ribbon');
  await page.getByTestId('phone-canvas-redraw').tap();
  await expect(page.getByText(msg('canvas.partFix.redrawing'))).toBeVisible();
  await expect(page.getByTestId('phone-canvas-accept')).toBeEnabled({ timeout: 20_000 });
  await page.getByTestId('phone-canvas-discard').tap();
  await expect(page.getByTestId('phone-canvas-staging')).toHaveCount(0);
  await page.getByTestId('phone-canvas-redraw').tap();
  await expect(page.getByTestId('phone-canvas-accept')).toBeEnabled({ timeout: 20_000 });
  await page.getByTestId('phone-canvas-accept').tap();

  // The edited picture goes to the gallery; closing returns to it.
  await page.getByTestId('phone-canvas-save').tap();
  await expect(page.getByText(msg('canvas.toast.savedToGallery'))).toBeVisible();
  await page.getByTestId('phone-canvas-close').tap();
  await expect(page.getByTestId('phone-canvas')).toHaveCount(0);
  await page.getByTestId('phone-thumb').first().tap();
  await expect.poll(() => boardCount(page)).toBe(before + 1);
});

test('two fingers zoom the picture and paint nothing', { tag: ['@scenario'] }, async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Touch points are sent through the Chromium protocol');
  await openEditor(page);
  const stage = page.getByTestId('canvas-stage');
  const box = (await stage.boundingBox())!;
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
  const shot = await stage.screenshot();
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', spread: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints:
        type === 'touchEnd'
          ? []
          : [
              { x: cx - spread, y: cy, id: 1 },
              { x: cx + spread, y: cy, id: 2 },
            ],
    });
  await touch('touchStart', 30);
  for (const spread of [50, 80, 110, 140]) await touch('touchMove', spread);
  await touch('touchEnd', 0);
  // The view is larger now, and nothing was painted (there is nothing to undo).
  await expect.poll(async () => (await stage.screenshot()).equals(shot)).toBe(false);
  await expect(page.getByTestId('phone-canvas-undo')).toBeDisabled();
  // The page itself did not zoom.
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
});
