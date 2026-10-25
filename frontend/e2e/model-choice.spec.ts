// "This needs a model" as a choice: the video screen offers both models with how well they fit this PC.
import { expect, msg, openApp, test } from './fixtures';

test('the video screen offers both models with their fit and a recommendation, and a pick sets the model', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('media-video').click();

  const card = page.getByTestId('video-pack');
  await expect(card).toBeVisible();
  // The mock reports a 12 GB card: both models fit, and the first one is recommended.
  await expect(page.getByTestId('choice-gpu')).toContainText('12 GB');
  await expect(card.getByText(msg('media.choice.fit.comfortable'))).toHaveCount(2);
  await expect(card.getByText(msg('media.choice.recommended'))).toHaveCount(1);
  await expect(page.getByTestId('video-pack-video')).toContainText(msg('media.choice.recommended'));

  await page.getByTestId('video-pack-turbo').click();
  await expect(page.getByTestId('video-pack-turbo')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('video-pack-video')).toHaveAttribute('aria-checked', 'false');

  // Downloading the fast model finishes in the mock and the card goes away.
  await page.getByTestId('turbo-pack-install').click();
  await expect(card).toBeHidden({ timeout: 30_000 });
});
