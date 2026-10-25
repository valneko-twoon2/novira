// The high-resolution fix (a second pass of text to image) and wildcard lists in prompts, on the mock backend.
import { expect, msg, openApp, test } from './fixtures';

test('the high-resolution fix makes a larger picture from the Generate tab', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByRole('button', { name: msg('params.hires.title') }).click();
  await page.getByRole('switch', { name: msg('params.hires.enable') }).click();
  await expect(page.getByTestId('hires-output')).toContainText('1536×1536');
  await page.getByTestId('positive-prompt').fill('a lighthouse on a cliff at dusk');
  await page.getByTestId('invoke-button').click();
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1);
  await expect(page.getByTestId('viewer-info')).toContainText('1536');
});

test('an unknown wildcard blocks Invoke until its list exists', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('positive-prompt').fill('1girl, __hair-color__, __pose__');
  await expect(page.getByTestId('invoke-button')).toBeDisabled();
  await expect(page.getByTestId('generation-reason')).toHaveText(msg('params.readiness.wildcardUnknown', { name: '__pose__' }));

  await page.getByTestId('dynamic-prompts').click();
  await page.getByTestId('open-wildcards').click();
  await expect(page.getByTestId('wildcards-dialog')).toBeVisible();
  await page.getByTestId('wildcard-new').click();
  await page.getByTestId('wildcard-name').fill('pose');
  await page.getByTestId('wildcard-name').press('Enter');
  await page.getByTestId('wildcard-text').fill('standing\nsitting');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('invoke-button')).toBeEnabled();

  // 7 hair colours x 2 poses.
  await page.getByTestId('dynamic-prompts').click();
  await expect(page.getByTestId('dynamic-prompts-list').locator('li')).toHaveCount(14);
});
