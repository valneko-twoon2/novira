// Making a pose: the stick figure is bent, saved as a picture and added to the canvas as a control layer.
import { expect, msg, openApp, test } from './fixtures';

test('a pose is made and added to the canvas as a control layer with a model that can read it', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('tab-canvas').click();
  await page.getByTestId('canvas-add-layer').click();
  await page.getByRole('menuitem', { name: msg('pose.menu') }).click();
  await expect(page.getByTestId('pose-dialog')).toBeVisible();

  // Raise the right wrist with the keyboard and mirror the figure.
  const wrist = page.getByTestId('pose-joint-rightWrist');
  await wrist.focus();
  await wrist.press('ArrowUp');
  await page.getByTestId('pose-mirror').click();
  await page.getByTestId('pose-use').click();

  await expect(page.getByTestId('pose-dialog')).toBeHidden({ timeout: 15_000 });
  await expect(page.getByTestId('canvas-group-control')).toBeVisible();
  await expect(page.getByTestId('canvas-entity')).toHaveCount(1);
  // A pose is followed only when the layer is strong: full weight, for the whole generation.
  const layers = page.getByTestId('canvas-layers');
  await expect(layers.getByRole('spinbutton', { name: msg('canvas.control.weight') })).toHaveValue('1.00');
  await expect(layers.getByRole('spinbutton', { name: msg('canvas.control.end') })).toHaveValue('1.00');
});
