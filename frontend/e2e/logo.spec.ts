// The logo screen of the Generate tab: install the logo model, make logos, find them in the assets and lay text over one.
import { expect, msg, openApp, test } from './fixtures';

test('logos are made on their own screen, kept as assets, and taken to the text editor', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('media-logo').click();
  const start = page.getByTestId('invoke-button');

  // Without the model and the text the button is disabled, and the panel names the first thing that is missing: the text,
  // then (once it is typed) the model.
  await expect(start).toBeDisabled();
  await expect(page.getByTestId('logo-problems')).toContainText(msg('logo.problem.text'));
  await page.getByTestId('logo-text').fill('NOVA');
  await expect(page.getByTestId('logo-problems')).toContainText(msg('logo.problem.pack'));
  await page.getByTestId('logo-pack').getByRole('button', { name: msg('pack.install') }).click();
  await expect(page.getByTestId('logo-pack')).toBeHidden({ timeout: 20_000 });
  await page.getByTestId('logo-size-wide').click();
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page.getByTestId('logo-card')).toHaveCount(2, { timeout: 20_000 });

  // They are assets: the gallery shows them under the assets tab, not among the images.
  await expect(page.getByRole('tab', { name: msg('gallery.view.assets') })).toHaveAttribute('aria-selected', 'true');

  await page.getByTestId('logo-lay-text').first().click();
  await expect(page.getByTestId('media-text')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('text-background').getByRole('button', { name: msg('text.bg.image') })).toHaveAttribute('aria-pressed', 'true');
});
