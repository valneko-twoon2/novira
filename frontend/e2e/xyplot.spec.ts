// The comparison grid: two settings vary, every combination is drawn, and one labelled table lands in the gallery.
import { expect, msg, openApp, test } from './fixtures';

test('a comparison grid is made from two varying settings and saved as one picture', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('seed-fixed').click();
  await page.getByTestId('positive-prompt').fill('a lighthouse on a cliff at dusk');

  await page.getByRole('button', { name: msg('params.invoke.moreOptions') }).click();
  await page.getByRole('menuitem', { name: msg('xyplot.menu') }).click();
  await expect(page.getByTestId('xyplot-dialog')).toBeVisible();
  // Nothing varies yet.
  await expect(page.getByTestId('xyplot-problem')).toContainText(msg('xyplot.problem.noAxis'));
  await expect(page.getByTestId('xyplot-run')).toBeDisabled();

  const pick = async (axis: 'x' | 'y', label: string, values: string) => {
    await page.getByTestId(`xyplot-${axis}`).getByRole('combobox').click();
    await page.getByRole('option', { name: label }).click();
    await page.getByTestId(`xyplot-${axis}-values`).fill(values);
  };
  await pick('x', msg('xyplot.axis.cfgScale'), '3, 6');
  await pick('y', msg('xyplot.axis.steps'), '10, 20');
  await expect(page.getByTestId('xyplot-summary')).toContainText(msg('xyplot.summary', { columns: 2, rows: 2, count: 4 }));

  await page.getByTestId('xyplot-run').click();
  await expect(page.getByTestId('xyplot-done')).toBeVisible({ timeout: 90_000 });
  // The four cells and the table.
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(5);
});

test('the same setting cannot vary on both axes, and a bad value is reported', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('positive-prompt').fill('a lighthouse');
  await page.getByRole('button', { name: msg('params.invoke.moreOptions') }).click();
  await page.getByRole('menuitem', { name: msg('xyplot.menu') }).click();

  for (const axis of ['x', 'y'] as const) {
    await page.getByTestId(`xyplot-${axis}`).getByRole('combobox').click();
    await page.getByRole('option', { name: msg('xyplot.axis.steps') }).click();
  }
  await expect(page.getByTestId('xyplot-problem')).toContainText(msg('xyplot.problem.sameAxis'));

  await page.getByTestId('xyplot-y').getByRole('combobox').click();
  await page.getByRole('option', { name: msg('xyplot.axis.cfgScale') }).click();
  await page.getByTestId('xyplot-y-values').fill('3, abc');
  await expect(page.getByTestId('xyplot-dialog').getByRole('alert')).toContainText(msg('xyplot.error.invalid'));
  await expect(page.getByTestId('xyplot-run')).toBeDisabled();
});
