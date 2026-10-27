// The Starter Models tab sorts the models and the model packs by purpose and family: a family brings its parts along,
// and a pack (the logo model) is installed from the same list.
import { expect, msg, openApp, test } from './fixtures';

test('narrows the starter models by family and purpose, and installs a model pack from the list', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('tab-models').click();
  await page.getByTestId('mm-import').click();
  await page.getByRole('tab', { name: msg('models.install.tab.starter') }).click();
  const rows = page.getByTestId('mm-starter');
  await expect(rows.first()).toBeVisible();

  // Anima: its model and the encoder and VAE it loads.
  await page.getByTestId('mm-starter-family-anima').click();
  await expect(rows.locator('.mm-item__name')).toHaveText(['Anima Base 1.0', 'qwen_3_06b_base', 'qwen_image_vae']);
  await expect(page.getByTestId('mm-starter-pack')).toHaveCount(0);
  await expect(page.getByTestId('mm-starter-purpose-video')).toHaveCount(0);

  // Logos: the logo model pack, installed from here.
  await page.getByTestId('mm-starter-family-all').click();
  await page.getByTestId('mm-starter-purpose-logo').click();
  await expect(rows).toHaveCount(0);
  const pack = page.getByTestId('mm-starter-pack');
  await expect(pack).toHaveCount(1);
  await expect(pack).toContainText(msg('pack.title.logo'));
  await page.getByTestId('mm-starter-pack-install-logo').click();
  await expect(pack.getByTestId('install-state-progress').or(pack.getByTestId('install-state-installed'))).toBeVisible();
});
