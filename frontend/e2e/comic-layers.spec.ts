// Painting on a comic page: the toolbar's switch starts painting with the layers panel always shown, a stroke drawn on the
// page lands in a raster layer of its own, whose stroke the page's own undo takes back and brings again, and which the
// Canvas layers panel hides and puts under the panels (and undo back over them). The stroke stays with its page across
// another page and a reload (the mock keeps its comics in the session storage).
import type { Locator, Page } from '@playwright/test';
import { chooseFirstModel, expect, msg, openApp, showTab, test } from './fixtures';

/** Makes a comic from the foot of the comic chooser's list, named in its dialog. */
async function newComic(page: Page, name: string) {
  await page.getByTestId('comic-project-picker').click();
  await page.getByTestId('comic-new').click();
  await page.getByTestId('name-dialog-input').fill(name);
  await page.getByTestId('name-dialog-ok').click();
  await chooseFirstModel(page);
}

/** A press dragged across an element, between two points given as shares of its box. */
async function drag(page: Page, target: Locator, from: [number, number], to: [number, number]) {
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(box.x + box.width * (from[0] + ((to[0] - from[0]) * i) / 10), box.y + box.height * (from[1] + ((to[1] - from[1]) * i) / 10));
  }
  await page.mouse.up();
}

/** How many pixels of a canvas are not see-through. */
const paintedPixels = (canvas: Locator) =>
  canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) n++;
    return n;
  });

/** The order of the user's raster layer and the panels on the page, bottom first. */
const pageOrder = (page: Page) =>
  page.locator('[data-testid="comic-layer-raster"], [data-testid="comic-layer-panels"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));

test('a stroke painted on a page is a layer of it: hidden, ordered, undone, and kept across pages and a reload', async ({ page }) => {
  test.slow();
  await openApp(page, '?scenario=empty');
  await showTab(page, 'comic');
  await newComic(page, 'Paint');

  // The layers panel is there with the page; the switch starts painting with a new raster layer over the balloons and the panels.
  const rows = page.getByTestId('canvas-layers').getByTestId('canvas-entity');
  await expect(rows).toHaveCount(2);
  await page.getByTestId('comic-mode-paint').click();
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1)).toContainText(msg('comic.layers.balloons'));
  await expect(rows.nth(2)).toContainText(msg('comic.layers.panels'));
  // No panel handles while painting, and the page's own tools are put away.
  await expect(page.getByTestId('comic-delete')).toHaveCount(0);

  await drag(page, page.getByTestId('canvas-embedded-stage'), [0.2, 0.15], [0.8, 0.5]);
  const content = page.getByTestId('canvas-embedded-content');
  await expect.poll(() => paintedPixels(content)).toBeGreaterThan(100);

  // The page's own undo takes the stroke back (the layer stays), and redo brings it again.
  await page.getByTestId('canvas-undo').click();
  await expect.poll(() => paintedPixels(content)).toBe(0);
  await expect(rows).toHaveCount(3);
  await page.getByTestId('canvas-redo').click();
  await expect.poll(() => paintedPixels(content)).toBeGreaterThan(100);

  // Hidden from the layers panel: the page no longer shows the layer.
  const raster = rows.nth(0);
  await raster.getByRole('button', { name: msg('canvas.entity.hide'), exact: true }).click();
  await expect(page.getByTestId('comic-layer-raster')).toHaveCount(0);
  await raster.getByRole('button', { name: msg('canvas.entity.show'), exact: true }).click();
  await expect(page.getByTestId('comic-layer-raster')).toHaveCount(1);

  // Under the panels and back over them.
  await expect.poll(() => pageOrder(page)).toEqual(['comic-layer-panels', 'comic-layer-raster']);
  await raster.locator('.canvas-entity__row').click({ button: 'right' });
  // The submenu opens by the keyboard: at the window's edge a pointer path to it is not reliable.
  await page.getByRole('menuitem', { name: msg('canvas.entityMenu.arrange') }).press('ArrowRight');
  await page.getByRole('menuitem', { name: msg('canvas.entityMenu.moveToBottom') }).press('Enter');
  await expect(rows.nth(2)).not.toContainText(msg('comic.layers.panels'));
  await expect.poll(() => pageOrder(page)).toEqual(['comic-layer-raster', 'comic-layer-panels']);
  await page.getByTestId('canvas-undo').click();
  await expect.poll(() => pageOrder(page)).toEqual(['comic-layer-panels', 'comic-layer-raster']);

  // Choosing the panels row goes back to the page, which shows the stroke as a layer of its own.
  await rows.filter({ hasText: msg('comic.layers.panels') }).locator('.canvas-entity__row').click();
  await expect(page.getByTestId('canvas-embedded-stage')).toHaveCount(0);
  await expect(page.getByTestId('comic-layer-canvas')).toHaveCount(1);

  // Another page has no stroke; back on the first one, it is there.
  await page.getByTestId('comic-page-add').click();
  await expect(page.getByTestId('comic-layer-canvas')).toHaveCount(0);
  await page.getByTestId('comic-page-1').click();
  await expect(page.getByTestId('comic-layer-canvas')).toHaveCount(1);

  // Saved: a reload brings the stroke back.
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.locator('.app')).toBeVisible({ timeout: 20_000 });
  await showTab(page, 'comic');
  await expect(page.getByTestId('comic-layer-canvas')).toHaveCount(1);
});
