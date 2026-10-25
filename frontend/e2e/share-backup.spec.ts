// Export for sharing (gallery menu, browser downloads in the mock) and the backup section of the settings.
import { expect, msg, openApp, test } from './fixtures';

test('pictures chosen in the gallery are exported as clean JPEG downloads', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('gallery-thumb').nth(0).click();
  await page.getByTestId('gallery-thumb').nth(1).click({ modifiers: ['Control'] });
  await page.getByTestId('gallery-thumb').nth(1).click({ button: 'right' });
  await page.getByRole('menuitem', { name: msg('share.menu') }).click();
  await expect(page.getByTestId('share')).toBeVisible();
  await page.getByTestId('share-format-jpeg').click();
  const downloads: string[] = [];
  page.on('download', (d) => downloads.push(d.suggestedFilename()));
  await page.getByTestId('share-run').click();
  await expect(page.getByTestId('share-done')).toContainText(msg('share.downloaded'));
  await expect.poll(() => downloads.length).toBe(2);
  expect(downloads.every((name) => name.endsWith('.jpg'))).toBe(true);
});

test('an export with the watermark switch is found again by the check, which leads to the original', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('gallery-thumb').nth(0).click({ button: 'right' });
  await page.getByRole('menuitem', { name: msg('share.menu') }).click();
  await page.getByRole('switch', { name: msg('share.watermark') }).click();
  await expect(page.getByText(msg('share.watermarkNote'))).toBeVisible();
  await page.getByTestId('share-run').click();
  await expect(page.getByTestId('share-done')).toContainText(msg('share.doneWatermarked.one', { count: 1 }));
  await page.keyboard.press('Escape');
  await page.getByTestId('gallery-thumb').nth(0).click({ button: 'right' });
  await page.getByRole('menuitem', { name: msg('share.check.title') }).click();
  await page.getByTestId('wm-check-pick').click();
  await expect(page.getByTestId('wm-check-watermark')).toBeVisible();
  await expect(page.getByTestId('wm-check-original')).toContainText(msg('share.check.showOriginal'));
  await page.getByTestId('wm-check-show-original').click();
  await expect(page.getByTestId('wm-check')).toBeHidden();
});

test('a backup downloads, and a restore stops at the confirmation in the mock', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: msg('app.nav.settingsMenu') }).click();
  await page.getByRole('menuitem', { name: msg('app.nav.settings') }).click();
  // The backup lives in the Data pane of the settings.
  await page.getByTestId('settings-tab-data').click();
  const download = page.waitForEvent('download');
  await page.getByTestId('backup-create').click();
  expect((await download).suggestedFilename()).toMatch(/^novira-backup-\d{8}-\d{4}\.json$/);

  await page.getByTestId('backup-restore').click();
  await expect(page.getByTestId('restore-confirm')).toBeVisible();
  await page.getByTestId('restore-confirm-run').click();
  await expect(page.getByText(msg('share.backup.mockRestore'))).toBeVisible();
  await expect(page.getByTestId('restore-confirm')).toHaveCount(0);
});
