// Registering a picture as a character from the viewer, then using it from the Generate tab.
import { expect, openApp, test } from './fixtures';

test('a picture is registered as a character and then sets up a reference image and the look words', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('seed-fixed').click();
  await page.getByTestId('positive-prompt').fill('a girl in a blue skirt');
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);

  await page.getByTestId('viewer-character').click();
  await expect(page.getByTestId('character-dialog')).toBeVisible();
  await page.getByTestId('character-name').fill('Mia');
  await page.getByTestId('character-tags').fill('brown hair, blue skirt');
  await page.getByTestId('character-save').click();
  await expect(page.getByTestId('character-dialog')).toBeHidden({ timeout: 20_000 });
  // The white-background copy made for the reference is a new picture next to the original.
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(2);

  await page.getByTestId('positive-prompt').fill('sitting in a cafe');
  await page.getByTestId('character-trigger').click();
  await page.getByTestId('character-item').filter({ hasText: 'Mia' }).locator('button.pp-picker__item').click();
  await expect(page.locator('.pp-refs__card, .pp-refs img').first()).toBeVisible();
  await expect(page.getByTestId('positive-prompt')).toHaveValue('brown hair, blue skirt, sitting in a cafe');
});

test('several pictures selected in the gallery are registered as one character', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('positive-prompt').fill('a girl in a blue skirt');
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('gallery-thumb').first()).toBeVisible();
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(2, { timeout: 30_000 });

  await page.getByTestId('gallery-thumb').nth(0).click();
  await page.getByTestId('gallery-thumb').nth(1).click({ modifiers: ['Control'] });
  await page.getByTestId('character-trigger').click();
  await page.getByTestId('character-register').click();
  await expect(page.getByTestId('character-dialog')).toBeVisible();
  await expect(page.getByTestId('character-picture')).toHaveCount(2);
  await page.getByTestId('character-name').fill('Duo');
  await page.getByTestId('character-save').click();
  await expect(page.getByTestId('character-dialog')).toBeHidden({ timeout: 30_000 });

  await page.getByTestId('character-trigger').click();
  await page.getByTestId('character-item').filter({ hasText: 'Duo' }).locator('button.pp-picker__item').click();
  await expect(page.getByTestId('ref-image')).toHaveCount(2);
});
