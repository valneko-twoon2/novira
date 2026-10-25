// A model loaded in parts (Anima) arrives without its text encoder and VAE: the app offers to install them right away, and
// when the offer is dismissed the Generate panel keeps a one-click button for exactly the missing files.
import { expect, msg, openApp, test } from './fixtures';

test('offers the missing files after an Anima model is installed, and keeps a button in the Generate panel', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('tab-models').click();
  await page.getByTestId('mm-import').click();
  await page.getByRole('tab', { name: msg('models.install.tab.starter') }).click();
  await page.getByTestId('mm-starter').filter({ hasText: 'Anima Base 1.0' }).getByRole('button', { name: msg('models.install.install') }).click();

  // The model arrives and the app offers its two missing files with their sizes.
  const dialog = page.getByTestId('model-parts-dialog');
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('model-parts-item')).toHaveCount(2);
  await expect(dialog).toContainText(msg('params.parts.total', { size: '1.4 GB' }));

  // Not now: the Generate panel says what is missing and offers the same install without a screen change.
  await page.getByTestId('model-parts-later').click();
  await expect(dialog).toBeHidden();
  await page.keyboard.press('Escape');
  await page.getByTestId('tab-generate').click();
  await page.getByTestId('model-picker').click();
  await page.getByTestId('model-picker-list').locator('.pp-picker__item').filter({ hasText: 'Anima Base 1.0' }).click();
  const reason = page.getByTestId('generation-reason');
  await expect(reason).toContainText('qwen_3_06b_base');
  const button = page.getByTestId('install-model-parts');
  await expect(button).toHaveText(msg('params.readiness.installParts', { size: '1.4 GB' }));
  await button.click();
  await expect(button).toHaveText(msg('params.readiness.installingParts'));

  // When both files are in, the reason goes away.
  await expect(reason).toBeHidden({ timeout: 60_000 });
});
