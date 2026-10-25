// Raster filters (blur, grayscale, invert) and the bucket, as actions on the chosen raster layer, on the Image tab and in the
// comic page's paint mode (mock backend): each is one undo step of the store it acts on.
import type { Locator, Page } from '@playwright/test';
import { chooseFirstModel, expect, msg, openApp, openCanvas, showTab, test } from './fixtures';

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

test('on a comic page, blur spreads the painted pixels and the bucket fills the empty region, each undone by one undo', async ({ page }) => {
  test.slow();
  await openApp(page, '?scenario=empty');
  await showTab(page, 'comic');
  await page.getByTestId('comic-project-picker').click();
  await page.getByTestId('comic-new').click();
  await page.getByTestId('name-dialog-input').fill('Filters');
  await page.getByTestId('name-dialog-ok').click();
  await chooseFirstModel(page);
  await page.getByTestId('comic-mode-paint').click();

  const stage = page.getByTestId('canvas-embedded-stage');
  const content = page.getByTestId('canvas-embedded-content');
  await page.getByTestId('canvas-tool-brush').click();
  await drag(page, stage, [0.2, 0.3], [0.8, 0.3]);
  await expect.poll(() => paintedPixels(content)).toBeGreaterThan(100);
  const stroked = await paintedPixels(content);

  // A blur: the layer becomes one picture and its soft edge covers more pixels.
  await page.getByTestId('canvas-filter').click();
  await page.getByLabel(msg('canvas.rasterFilter.radius')).fill('12');
  await page.getByLabel(msg('canvas.rasterFilter.radius')).blur();
  await page.getByTestId('canvas-filter-apply').click();
  await expect.poll(() => paintedPixels(content)).toBeGreaterThan(stroked);
  await page.getByTestId('canvas-undo').click();
  await expect.poll(() => paintedPixels(content)).toBe(stroked);

  // The bucket: a press on the empty page fills all of it up to the stroke, and a press on the stroke fills the stroke.
  await page.getByTestId('canvas-tool-bucket').click();
  await page.getByLabel(msg('canvas.toolbar.bucketTolerance')).fill('0');
  await page.getByLabel(msg('canvas.toolbar.bucketTolerance')).blur();
  const box = (await stage.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.12);
  await expect.poll(() => paintedPixels(content)).toBeGreaterThan(stroked * 20);
  await page.getByTestId('canvas-undo').click();
  await expect.poll(() => paintedPixels(content)).toBe(stroked);
});

test('on the Image tab, a filter changes the chosen layer and one undo takes it back', async ({ page }) => {
  await openCanvas(page);
  await page.getByTestId('canvas-tool-brush').click();
  const stage = page.getByTestId('canvas-stage');
  await drag(page, stage, [0.3, 0.4], [0.7, 0.5]);
  await expect(page.getByTestId('canvas-entity')).toHaveCount(1);
  await expect(page.getByTestId('canvas-filter')).toBeEnabled();
  await page.mouse.move(0, 0);
  const before = await stage.screenshot();
  await page.getByTestId('canvas-filter').click();
  await page.getByTestId('canvas-filter-kind-invert').click();
  await page.getByTestId('canvas-filter-apply').click();
  await expect.poll(async () => (await stage.screenshot()).equals(before)).toBe(false);
  await page.getByTestId('canvas-undo').click();
  await page.mouse.move(0, 0);
  await expect.poll(async () => (await stage.screenshot()).equals(before)).toBe(true);

  // The bucket is a tool here too, with its tolerance.
  await page.getByTestId('canvas-tool-bucket').click();
  await expect(page.getByLabel(msg('canvas.toolbar.bucketTolerance'))).toBeVisible();
});
