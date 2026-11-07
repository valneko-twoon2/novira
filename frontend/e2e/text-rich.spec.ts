// "AI で仕上げる" on the Text screen: a look is chosen and the run paints the letters; the candidates, the stale notice after a text
// change, undo, going back to the plain fill, a failed run and saving a picture that has the AI fill.
import { expect, msg, openApp, test } from './fixtures';

async function openText(page: Parameters<typeof openApp>[0]) {
  await openApp(page);
  await page.getByTestId('tab-generate').click();
  await page.getByTestId('media-text').click();
  await expect(page.getByTestId('text-panel')).toBeVisible();
  await page.getByTestId('text-add-text').click();
  await expect(page.getByTestId('text-rich')).toBeVisible();
}

test('finishing a text layer makes candidates, and a changed text asks for a new run', async ({ page }) => {
  await openText(page);
  await page.getByTestId('text-rich-look-gold').click();
  await expect(page.getByTestId('text-rich-look-gold')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('text-rich-run').click();
  const candidates = page.getByTestId('text-rich-candidate');
  await expect(candidates).toHaveCount(2, { timeout: 30_000 });
  await expect(candidates.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('text-rich-stale')).toHaveCount(0);

  // Another candidate becomes the fill.
  await candidates.nth(1).click();
  await expect(candidates.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(candidates.first()).toHaveAttribute('aria-pressed', 'false');

  // A new text is a new lettering: the picture is not used, and the section says so.
  await page.getByTestId('text-content').fill('NOVIRA');
  await expect(page.getByTestId('text-rich-stale')).toBeVisible();

  // Undoing the edit brings the picture back with no new job.
  await page.getByTestId('text-canvas').getByRole('button', { name: msg('text.undo') }).click();
  await expect(page.getByTestId('text-rich-stale')).toHaveCount(0);
  await expect(candidates).toHaveCount(2);

  // Back to the plain fill removes the AI picture from the layer.
  await page.getByTestId('text-rich-clear').click();
  await expect(candidates).toHaveCount(0);
});

test('the picture can be saved with the AI fill and a failed run changes nothing', async ({ page }) => {
  await openText(page);
  await page.getByTestId('text-rich-run').click();
  await expect(page.getByTestId('text-rich-candidate')).toHaveCount(2, { timeout: 30_000 });
  await page.getByTestId('text-save').click();
  await expect(page.getByText(msg('text.saved'))).toBeVisible();

  await page.getByTestId('text-rich-clear').click();
  await page.getByTestId('text-rich-words').fill('[fail]');
  await page.getByTestId('text-rich-run').click();
  await expect(page.getByText(msg('text.rich.failed'))).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('text-rich-candidate')).toHaveCount(0);
  await expect(page.getByTestId('text-rich-run')).toBeEnabled();
});
