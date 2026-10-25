// The developer log (on by default in development builds): a failed job shows up as an error line.
import { expect, openApp, test } from './fixtures';

test('a failed job appears in the developer log', async ({ page }) => {
  await openApp(page, '?scenario=empty');
  await page.getByTestId('positive-prompt').fill('a broken picture [fail]');
  await page.getByTestId('invoke-button').click();
  const open = page.getByTestId('devlog-open');
  await expect(open.locator('.sidenav__count')).toHaveText('1');
  await open.click();
  const rows = page.getByTestId('devlog').getByTestId('devlog-row');
  await expect(rows.filter({ hasText: 'failed' })).toHaveCount(1);
  await expect(rows.filter({ hasText: 'failed' })).toHaveClass(/is-error/);
});
