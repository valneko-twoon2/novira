// A draft whose finished picture was cancelled can be drawn to the end again, and so can one whose picture is gone.
import { expect, msg, openApp, showTab, test } from './fixtures';

test('cancelling the finished picture of a draft leaves the draft usable: it is finished again', async ({ page }) => {
  test.slow();
  // Slow steps, so the finished picture is still waiting or drawing when it is cancelled.
  await page.addInitScript(() => localStorage.setItem('novira.settings', JSON.stringify({ state: { mockStepDelay: 1000 }, version: 0 })));
  await openApp(page, '?scenario=empty');
  await page.getByTestId('positive-prompt').fill('a red fox in the snow');
  await page.getByTestId('view-drafts').click();
  await page.getByTestId('drafts-start').click();
  const cells = page.getByTestId('draft-cell');
  await expect(cells).toHaveCount(4);
  // All four drafts are drawn before one is finished, so the finished picture is the only job left to cancel.
  await expect(cells.locator('img')).toHaveCount(4, { timeout: 90_000 });
  await expect(page.getByTestId('draft-cell').locator('.dv-busy')).toHaveCount(0);

  const first = cells.first();
  await first.getByRole('button', { name: /^seed / }).click();
  await page.getByTestId('drafts-finish').click();
  await expect(first).toContainText(msg('drafts.badge.finishing'));

  // Cancel it in the queue before it is drawn.
  await showTab(page, 'queue');
  const cancel = page.getByRole('button', { name: msg('common.cancel'), exact: true });
  await expect(cancel.first()).toBeVisible();
  await cancel.first().click();
  await showTab(page, 'generate');
  await page.getByTestId('view-drafts').click();
  await expect(first).toContainText(msg('drafts.badge.failed'), { timeout: 20_000 });

  // The draft is still good: choose it and finish it again.
  await first.getByRole('button', { name: /^seed / }).click();
  await expect(page.getByTestId('drafts-finish')).toBeEnabled();
  await page.getByTestId('drafts-finish').click();
  // The finished picture lands in the gallery (the view switches to it); back on the Drafts tab the cell says finished.
  await expect(page.getByTestId('gallery-thumb')).toHaveCount(1, { timeout: 90_000 });
  await page.getByTestId('view-drafts').click();
  await expect(first).toContainText(msg('drafts.badge.finished'));
});
