// The "i" beside a label shows the control's explanation; the settings keep only the text that has to stay in view.
import { expect, msg, openApp, test } from './fixtures';

test('a generation parameter has an i that shows its explanation', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  const steps = page.locator('.ui-field', { hasText: msg('params.generation.steps') }).first();
  await expect(steps.locator('.ui-field__label')).toHaveText(msg('params.generation.steps'));
  await steps.getByTestId('info-mark').hover();
  await expect(page.getByRole('tooltip')).toHaveText(msg('params.generation.stepsInfo'));
});

test('the settings rows have an i instead of a sub text, and a plain row has neither', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: msg('app.nav.settingsMenu') }).click();
  await page.getByRole('menuitem', { name: msg('app.nav.settings') }).click();
  await expect(page.getByTestId('settings-modal')).toBeVisible();
  await page.getByTestId('settings-tab-generation').click();
  const lowMemory = page.locator('.st-row', { hasText: msg('settings.lowMemory.label') });
  await expect(lowMemory.locator('.st-row__help')).toHaveCount(0);
  await lowMemory.getByTestId('info-mark').focus();
  await expect(page.getByRole('tooltip')).toHaveText(msg('settings.lowMemory.help'));
  // The draft count is plain: no i, no sub text.
  const drafts = page.locator('.st-row', { hasText: msg('settings.draftCount.label') });
  await expect(drafts.getByTestId('info-mark')).toHaveCount(0);
  await expect(drafts.locator('.st-row__help')).toHaveCount(0);
});
