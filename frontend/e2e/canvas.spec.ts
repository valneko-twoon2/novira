// Canvas generation on the mock backend: a mask painted over a picture goes out with the job (the pixels of the
// source, the mask and the outpaint fill are rendered in the browser) and the result is staged on the canvas.
import { expect, msg, openApp, test } from './fixtures';

test('a mask painted over a picture is redrawn and the result is staged on the canvas', async ({ page }) => {
  await openApp(page);
  // A gallery picture on the canvas, through the reference row's "to canvas" (the reference image stays enabled).
  await page.getByTestId('gallery-thumb').first().dragTo(page.locator('.pp-refs'));
  await page.getByTestId('ref-image').click();
  await page.getByTestId('ref-to-canvas').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('canvas-entity')).toHaveCount(1);

  await page.getByTestId('canvas-add-layer').click();
  await page.getByRole('menuitem', { name: msg('canvas.add.inpaint') }).click();
  await expect(page.getByTestId('canvas-entity')).toHaveCount(2);
  await page.getByTestId('canvas-tool-brush').click();
  const box = (await page.getByTestId('canvas-stage').boundingBox())!;
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(cx - 40, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 40, cy + 10, { steps: 8 });
  await page.mouse.up();

  await expect(page.getByTestId('invoke-button')).toBeEnabled();
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('canvas-staging-accept')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('tab-queue').click();
  await expect(page.getByTestId('queue-item').first()).toHaveAttribute('data-status', 'completed');
});

test('the pose tool places a pose on a new control layer and R gives it a new random shape', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('tab-canvas').click();
  await page.getByTestId('canvas-tool-pose').click();
  const box = (await page.getByTestId('canvas-stage').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('canvas-entity')).toHaveCount(1);
  const thumb = () => page.getByTestId('canvas-stage').screenshot();
  const before = await thumb();
  await page.keyboard.press('r');
  await expect.poll(async () => Buffer.compare(await thumb(), before) !== 0).toBe(true);
  // The new shape, the placed pose and the new layer are one undo step each.
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('canvas-entity')).toHaveCount(0);
});

test('the pose tool queues one generation per random pose', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('tab-canvas').click();
  await page.getByTestId('canvas-tool-pose').click();
  const count = page.getByLabel(msg('canvas.pose.batchCount'));
  await count.fill('3');
  await count.press('Enter');
  await page.getByTestId('canvas-pose-batch').click();
  await expect(page.getByTestId('canvas-entity')).toHaveCount(1);
  await page.getByTestId('tab-queue').click();
  await expect(page.getByTestId('queue-item')).toHaveCount(3);
});

test('a picture from the gallery is read as a pose and put on the canvas', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('gallery-thumb').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: msg('canvas.poseFromImage.menu') }).click();
  await page.getByTestId('pose-from-image-run').click();
  await expect(page.getByTestId('pose-from-image-result')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('pose-from-image-replace').click();
  await expect(page.getByTestId('canvas-stage')).toBeVisible();
  await expect(page.getByTestId('canvas-entity')).toHaveCount(1);
});

test('a ready-made pose from the pose tool puts a figure on a new control layer', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('tab-canvas').click();
  await page.getByTestId('canvas-tool-pose').click();
  await page.getByTestId('canvas-pose-presets').click();
  await page.getByTestId('canvas-pose-category-action').click();
  await page.getByTestId('canvas-pose-preset-highKick').click();
  await expect(page.getByTestId('canvas-entity')).toHaveCount(1);
  // The menu closes after the choice; the pose and the new layer are one undo step each.
  await expect(page.getByTestId('canvas-pose-preset-highKick')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('canvas-entity')).toHaveCount(0);
});

test('a composition from the pose dialog puts two people on a new control layer', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('tab-canvas').click();
  await page.getByTestId('canvas-tool-pose').click();
  await page.getByTestId('canvas-pose-presets').click();
  await expect(page.getByTestId('canvas-pose-preset-bustUp')).toBeVisible();
  await page.getByTestId('canvas-pose-category-panel.two').click();
  await expect(page.getByTestId('canvas-pose-preset-faceToFace').locator('svg')).toBeVisible();
  await page.getByTestId('canvas-pose-preset-faceToFace').click();
  await expect(page.getByTestId('canvas-pose-preset-faceToFace')).toHaveCount(0);
  await expect(page.getByTestId('canvas-entity')).toHaveCount(1);
});

test('the 3D editor turns a pose to the side and applies it as a pose with depth', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('tab-canvas').click();
  await page.getByTestId('canvas-tool-pose').click();
  const box = (await page.getByTestId('canvas-stage').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('canvas-entity')).toHaveCount(1);
  const flat = () => page.getByTestId('canvas-stage').screenshot();
  const before = await flat();
  await page.getByTestId('canvas-pose-3d').click();
  await expect(page.getByTestId('pose3d-dialog')).toBeVisible();
  await expect(page.getByTestId('pose3d-apply')).toBeEnabled({ timeout: 20_000 });
  // Turn the body a quarter round with the side view, then apply: the pose seen from the side is thin.
  await page.getByTestId('pose3d-view-side').click();
  await page.getByTestId('pose3d-apply').click();
  await expect(page.getByTestId('pose3d-dialog')).toHaveCount(0);
  await expect(page.getByTestId('canvas-entity')).toHaveCount(1);
  await expect.poll(async () => Buffer.compare(await flat(), before) !== 0).toBe(true);
  // One undo takes the turned pose back.
  await page.keyboard.press('Control+z');
  await expect.poll(async () => Buffer.compare(await flat(), before) === 0).toBe(true);
});

test('a shape drawn with the lasso goes into the layer as one step that can be undone', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('tab-canvas').click();
  await page.getByTestId('canvas-add-layer').click();
  await page.getByRole('menuitem', { name: msg('canvas.add.inpaint') }).click();
  await expect(page.getByTestId('canvas-entity')).toHaveCount(1);
  await page.getByTestId('canvas-tool-lasso').click();
  const box = (await page.getByTestId('canvas-stage').boundingBox())!;
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(cx - 60, cy + 40);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 50, { steps: 6 });
  await page.mouse.move(cx + 60, cy + 40, { steps: 6 });
  await page.mouse.up();
  // The shape is one history step: two undos remove it and then the layer itself.
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('canvas-entity')).toHaveCount(0);
});
