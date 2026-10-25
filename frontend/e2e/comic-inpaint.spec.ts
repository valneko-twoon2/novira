// Inpainting on a comic page on the mock backend: a mask painted on the page in paint mode, the box tool, and the
// button that queues the page under the box with the mask. The result waits on the page that asked for it, even when the
// user has gone to another page, and is accepted into a new raster layer of that page.
import type { Locator, Page } from '@playwright/test';
import { chooseFirstModel, expect, msg, openApp, showTab, test } from './fixtures';

async function newComic(page: Page, name: string) {
  await page.getByTestId('comic-project-picker').click();
  await page.getByTestId('comic-new').click();
  await page.getByTestId('name-dialog-input').fill(name);
  await page.getByTestId('name-dialog-ok').click();
  await chooseFirstModel(page);
}

async function drag(page: Page, target: Locator, from: [number, number], to: [number, number]) {
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(box.x + box.width * (from[0] + ((to[0] - from[0]) * i) / 10), box.y + box.height * (from[1] + ((to[1] - from[1]) * i) / 10));
  }
  await page.mouse.up();
}

test('a mask painted on a page is inpainted under the box and the result is accepted into a new layer, even from another page', async ({ page }) => {
  test.slow();
  await openApp(page, '?scenario=empty');
  await showTab(page, 'comic');
  await newComic(page, 'Inpaint');
  const rows = page.getByTestId('canvas-layers').getByTestId('canvas-entity');
  await page.getByTestId('comic-mode-paint').click();
  await expect(rows).toHaveCount(3);

  // Without a mask the button says what is missing and queues nothing.
  await page.getByTestId('comic-inpaint-run').click();
  await expect(page.getByText(msg('comic.inpaint.noMask'))).toBeVisible();

  // Only raster layers and inpaint masks can be added on a page.
  await page.getByTestId('canvas-add-layer').click();
  await expect(page.getByRole('menuitem', { name: msg('canvas.add.control') })).toHaveCount(0);
  await page.getByRole('menuitem', { name: msg('canvas.add.inpaint') }).click();
  await expect(rows).toHaveCount(4);
  await expect(page.getByTestId('comic-mode-paint')).toHaveAttribute('aria-pressed', 'true');

  // Paint the mask, then size the box with the box tool: it cannot leave the page.
  const stage = page.getByTestId('canvas-embedded-stage');
  await page.getByTestId('canvas-tool-brush').click();
  await drag(page, stage, [0.3, 0.3], [0.6, 0.35]);
  await page.getByTestId('canvas-tool-bbox').click();
  await drag(page, stage, [0.5, 0.5], [0.99, 0.99]);
  await page.getByTestId('canvas-tool-brush').click();

  await page.getByTestId('comic-inpaint-run').click();
  await expect(page.getByTestId('canvas-staging-accept')).toBeVisible({ timeout: 20_000 });

  // Another page is open when a second result arrives: it waits on the first page.
  await page.getByTestId('canvas-staging-accept').click();
  await expect(rows).toHaveCount(5);
  await page.getByTestId('comic-inpaint-run').click();
  await page.getByTestId('comic-page-add').click();
  await expect(page.getByTestId('canvas-staging')).toHaveCount(0);
  await expect(page.getByText(msg('comic.inpaint.readyElsewhere'))).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('comic-page-1').click();
  await page.getByTestId('comic-mode-paint').click();
  await expect(page.getByTestId('canvas-staging-accept')).toBeVisible();
  await page.getByTestId('canvas-staging-accept').click();
  await expect(rows).toHaveCount(6);
});
