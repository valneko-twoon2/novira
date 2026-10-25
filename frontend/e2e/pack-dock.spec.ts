// The download dock: model and extension downloads show their progress, wherever you are.
import { expect, msg, openApp, test } from './fixtures';

test('a model download shows in the download dock until it is done', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('media-video').click();
  await page.getByTestId('video-pack-install').click();

  const dock = page.getByTestId('pack-dock');
  await expect(dock).toBeVisible();
  await expect(dock.getByTestId('pack-dock-item').first()).toContainText(msg('pack.title.video'));
  await expect(dock.getByTestId('pack-dock-item').first()).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });

  // A finished entry is dismissed from the dock.
  await dock.getByRole('button', { name: msg('browse.dock.clear') }).click();
  await expect(dock).toBeHidden();
});
