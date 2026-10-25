// Presets on a generator screen: save the music settings, change the form, apply the preset back, and find it again
// after a reload.
import { expect, msg, openApp, test } from './fixtures';

test('a music preset is saved, applied back over changed settings and kept after a reload', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('media-music').click();
  const bar = page.getByTestId('music-presets');
  const tags = page.getByTestId('music-tags');
  const lyrics = page.getByTestId('music-lyrics');

  await tags.fill('synthwave, retro, analog synth');
  await bar.getByTestId('preset-quick-save').click();
  await page.getByTestId('name-dialog-input').fill('Retro night');
  await page.getByTestId('name-dialog-ok').click();
  await expect(bar.getByTestId('preset-trigger')).toContainText('Retro night');

  // Change the style and write lyrics: applying the preset brings the style back and leaves the lyrics alone.
  await tags.fill('jazz, piano trio');
  await lyrics.fill('la la la');
  await bar.getByTestId('preset-trigger').click();
  const list = page.getByTestId('preset-list');
  await expect(list).toContainText(msg('presets.group.mine'));
  await expect(list).toContainText(msg('presets.group.builtin'));
  await page.getByLabel(msg('presets.search')).fill('retro');
  await expect(list.getByTestId('preset-item')).toHaveCount(1);
  await list.getByText('Retro night').click();
  await expect(list).toHaveCount(0);
  await expect(tags).toHaveValue('synthwave, retro, analog synth');
  await expect(lyrics).toHaveValue('la la la');

  await page.reload();
  await expect(page.locator('.app')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('media-music').click();
  await expect(page.getByTestId('music-presets').getByTestId('preset-trigger')).toContainText('Retro night');
});
