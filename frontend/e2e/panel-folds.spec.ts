// The prompt and IP-Adapter sections of the left panel fold like the others, and what must reach them opens them.
import { expect, openApp, test } from './fixtures';

test('the prompt folds, keeps its text, and Alt+A opens it again', async ({ page }) => {
  await openApp(page);
  const prompts = page.getByTestId('prompts');
  await page.getByTestId('positive-prompt').fill('a quiet harbour');
  await prompts.locator('.ui-section__toggle').click();
  await expect(page.getByTestId('positive-prompt')).toHaveCount(0);
  await page.keyboard.press('Alt+a');
  await expect(page.getByTestId('positive-prompt')).toHaveValue('a quiet harbour');
  await expect(page.getByTestId('positive-prompt')).toBeFocused();
});

test('IP-Adapter folds, and a picture dropped on the folded section opens it', async ({ page }) => {
  await openApp(page);
  const section = page.locator('.pp-refs:visible');
  await section.locator('.ui-section__toggle').click();
  await expect(page.getByTestId('add-ref-image')).toHaveCount(0);
  await page.getByTestId('gallery-thumb').first().dragTo(section);
  await expect(page.getByTestId('add-ref-image')).toBeVisible();
});
