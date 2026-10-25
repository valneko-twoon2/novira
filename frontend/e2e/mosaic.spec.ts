// The mosaic tool of the canvas: painting over a picture turns that part into flat blocks, and a mask layer refuses it.
import { expect, msg, openApp, test } from './fixtures';

/** The longest run of identical neighbouring pixels along one row of the stage canvas. */
async function longestRun(page: import('@playwright/test').Page, y: number, x0: number, x1: number) {
  return page.evaluate(
    ([row, from, to]) => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="canvas-stage"] canvas, canvas[data-testid="canvas-stage"]');
      if (!canvas) throw new Error('no stage canvas');
      const r = canvas.getBoundingClientRect();
      const ratio = canvas.width / r.width;
      const data = canvas.getContext('2d')!.getImageData(Math.round((from! - r.left) * ratio), Math.round((row! - r.top) * ratio), Math.round((to! - from!) * ratio), 1).data;
      let best = 1;
      let run = 1;
      for (let i = 4; i < data.length; i += 4) {
        const same = data[i] === data[i - 4] && data[i + 1] === data[i - 3] && data[i + 2] === data[i - 2];
        run = same ? run + 1 : 1;
        best = Math.max(best, run);
      }
      return best;
    },
    [y, x0, x1],
  );
}

test('the mosaic tool turns the painted part of a picture into blocks', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('gallery-thumb').first().dragTo(page.locator('.pp-refs'));
  await page.getByTestId('ref-image').click();
  await page.getByTestId('ref-to-canvas').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('canvas-entity')).toHaveCount(1);

  const stage = page.getByTestId('canvas-stage');
  const box = (await stage.boundingBox())!;
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
  const before = await longestRun(page, cy, cx - 60, cx + 60);

  await page.getByTestId('canvas-tool-mosaic').click();
  const block = page.getByLabel(msg('canvas.toolbar.mosaicBlock'));
  await block.fill('48');
  await block.press('Enter');
  await page.mouse.move(cx - 80, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 80, cy, { steps: 6 });
  await page.mouse.up();

  const after = await longestRun(page, cy, cx - 60, cx + 60);
  expect(after).toBeGreaterThan(Math.max(12, before * 2));
  // One undo takes the mosaic away again.
  await page.keyboard.press('Control+z');
  await expect.poll(() => longestRun(page, cy, cx - 60, cx + 60)).toBeLessThanOrEqual(before);
});

test('a mask layer has no picture to pixelate, so the mosaic tool says so', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('tab-canvas').click();
  await page.getByTestId('canvas-add-layer').click();
  await page.getByRole('menuitem', { name: msg('canvas.add.inpaint') }).click();
  await page.getByTestId('canvas-tool-mosaic').click();
  const box = (await page.getByTestId('canvas-stage').boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByText(msg('canvas.toast.mosaicLayer'))).toBeVisible();
});
