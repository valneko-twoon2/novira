// The Starter Models tab shows the models and the model packs as cards, by purpose on the left and family in the toolbar:
// a family brings its parts along, the purposes stay put, and a pack (the logo model) is installed from the same cards.
import { expect, msg, openApp, test } from './fixtures';

test('narrows the starter models by family and purpose, and installs a model pack from the list', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('tab-models').click();
  await page.getByTestId('mm-import').click();
  await page.getByRole('tab', { name: msg('models.install.tab.starter') }).click();
  const rows = page.getByTestId('mm-starter');
  await expect(rows.first()).toBeVisible();

  // Anima: its model and the encoder and VAE it loads.
  await page.getByTestId('mm-starter-family').click();
  await page.getByRole('option', { name: 'Anima', exact: true }).click();
  await expect(rows.locator('.mm-card-item__name')).toHaveText(['Anima Base 1.0', 'qwen_3_06b_base', 'qwen_image_vae']);
  await expect(page.getByTestId('mm-starter-pack')).toHaveCount(0);
  await expect(page.getByTestId('mm-starter-purpose-video').locator('.mm-rail__count')).toHaveText('0');

  // Logos: the logo model pack, installed from here.
  await page.getByTestId('mm-starter-family').click();
  await page.getByRole('option', { name: msg('models.starter.allFamilies') }).click();
  await page.getByTestId('mm-starter-purpose-logo').click();
  await expect(rows).toHaveCount(0);
  const pack = page.getByTestId('mm-starter-pack');
  await expect(pack).toHaveCount(1);
  await expect(pack).toContainText(msg('pack.title.logo'));
  await page.getByTestId('mm-starter-pack-install-logo').click();
  await expect(pack.getByTestId('install-state-progress').or(pack.getByTestId('install-state-installed'))).toBeVisible();
});
